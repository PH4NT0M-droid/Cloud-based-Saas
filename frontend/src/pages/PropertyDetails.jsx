import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import propertyService from '../services/propertyService';
import inventoryService from '../services/inventoryService';
import roomService from '../services/roomService';
import useAuth from '../hooks/useAuth';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorBanner from '../components/ErrorBanner';
import InventoryGrid from '../components/InventoryGrid';
import PricingGrid from '../components/PricingGrid';
import Modal from '../components/Modal';
import TextInput from '../components/forms/TextInput';
import PropertyForm from '../components/PropertyForm';
import { useToast } from '../components/ToastProvider';

const buildDateRange = (days = 14) => {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + days - 1);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
};

const formatDateKey = (date) => new Date(date).toISOString().split('T')[0];

let ratePlanDraftSeed = 0;
const nextRatePlanDraftId = () => {
  ratePlanDraftSeed += 1;
  return `rate-plan-draft-${ratePlanDraftSeed}`;
};

const createRatePlanDraft = (ratePlan = {}) => ({
  _draftId: ratePlan._draftId || ratePlan.id || nextRatePlanDraftId(),
  mealPlanName: String(ratePlan.mealPlanName || '').trim().toUpperCase(),
  basePrice: String(ratePlan.basePrice ?? ''),
  extraBedPrice: String(ratePlan.extraBedPrice ?? ''),
  isDefault: Boolean(ratePlan.isDefault),
});

const upsertByDate = (items = [], targetDate, patch) => {
  let found = false;
  const next = items.map((item) => {
    if (formatDateKey(item.date) === targetDate) {
      found = true;
      return { ...item, ...patch };
    }

    return item;
  });

  if (!found) {
    next.push({
      id: patch.id || `${targetDate}`,
      date: targetDate,
      ...patch,
    });
  }

  return next;
};

const normalizeRatePlans = (ratePlans = []) =>
  ratePlans
    .map((ratePlan) => createRatePlanDraft(ratePlan))
    .filter((ratePlan) => ratePlan.mealPlanName.length > 0);

const createEmptyRatePlan = (mealPlanName = '') => ({
  _draftId: nextRatePlanDraftId(),
  mealPlanName,
  basePrice: '',
  extraBedPrice: '',
  isDefault: false,
});

const ensureDefaultRatePlan = (ratePlans) => {
  if (ratePlans.some((ratePlan) => ratePlan.isDefault)) {
    return ratePlans;
  }

  return ratePlans.map((ratePlan, index) => (index === 0 ? { ...ratePlan, isDefault: true } : ratePlan));
};

const roomTypeToForm = (roomType = null) => {
  const ratePlans = roomType?.ratePlans?.length
    ? roomType.ratePlans
    : [
        {
          mealPlanName: 'EP',
          basePrice: roomType?.basePrice ?? 0,
          extraBedPrice: roomType?.extraPersonPrice ?? 0,
          isDefault: true,
        },
      ];

  return {
    name: roomType?.name || '',
    baseCapacity: String(roomType?.baseCapacity ?? 1),
    maxCapacity: String(roomType?.maxCapacity ?? roomType?.maxOccupancy ?? 1),
    roomInventory: String(roomType?.roomInventory ?? roomType?.baseInventory ?? 1),
    ratePlans: ensureDefaultRatePlan(normalizeRatePlans(ratePlans)),
  };
};

const canEditProperty = (user) => {
  if (!user) {
    return false;
  }

  if (user.role === 'ADMIN' || user.role === 'admin') {
    return true;
  }

  const permissions = user.permissions;
  if (Array.isArray(permissions)) {
    return permissions.includes('MANAGE_PROPERTY') || permissions.includes('EDIT_PROPERTY');
  }

  return Boolean(
    permissions?.canManageProperties ||
      permissions?.MANAGE_PROPERTY ||
      permissions?.manage_property ||
      permissions?.EDIT_PROPERTY ||
      permissions?.edit_property,
  );
};

function PropertyDetails() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [range, setRange] = useState(buildDateRange());
  const [loading, setLoading] = useState(true);
  const [savingRoomTypeId, setSavingRoomTypeId] = useState(null);
  const [savingPricingRowKey, setSavingPricingRowKey] = useState(null);
  const [error, setError] = useState(null);
  const [property, setProperty] = useState(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [inventoryBulkModalOpen, setInventoryBulkModalOpen] = useState(false);
  const [priceBulkModalOpen, setPriceBulkModalOpen] = useState(false);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [propertySaving, setPropertySaving] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({
    name: '',
    baseCapacity: '1',
    maxCapacity: '2',
    roomInventory: '1',
    ratePlans: [createEmptyRatePlan('EP')],
  });
  const [inventoryBulkForm, setInventoryBulkForm] = useState({
    roomTypeId: '',
    operation: 'set',
    value: '0',
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const [priceBulkForm, setPriceBulkForm] = useState({
    roomTypeId: '',
    ratePlanId: 'ALL',
    operation: 'set',
    value: '0',
    startDate: range.startDate,
    endDate: range.endDate,
  });
  const [propertyForm, setPropertyForm] = useState({});

  const loadProperty = async (nextRange = range) => {
    try {
      setLoading(true);
      setError(null);
      const overview = await propertyService.getOverview(propertyId, nextRange);
      setProperty(overview);
      setPropertyForm({
        name: overview.name || '',
        fullAddress: overview.fullAddress || overview.location || '',
        pinCode: overview.pinCode || '',
        city: overview.city || '',
        state: overview.state || '',
        mobileNumber: overview.mobileNumber || '',
        landlineNumber: overview.landlineNumber || '',
        email: overview.email || '',
        website: overview.website || '',
        gstNumber: overview.gstNumber || '',
        propertyLogo: overview.propertyLogo || '',
        description: overview.description || '',
        longDescription: overview.longDescription || '',
      });
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const dates = useMemo(() => {
    const result = [];
    const current = new Date(range.startDate);
    const end = new Date(range.endDate);
    while (current <= end) {
      result.push(formatDateKey(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [range]);

  const roomTypes = property?.roomTypes || [];
  const canEditPropertyInfo = canEditProperty(user);

  const inventoryMatrix = useMemo(() => {
    const matrix = {};
    roomTypes.forEach((roomType) => {
      matrix[roomType.id] = {};
      roomType.inventories.forEach((inventory) => {
        matrix[roomType.id][formatDateKey(inventory.date)] = inventory;
      });

      dates.forEach((dateKey) => {
        if (!matrix[roomType.id][dateKey]) {
          matrix[roomType.id][dateKey] = {
            date: dateKey,
            availableRooms: roomType.baseInventory ?? 0,
          };
        }
      });
    });
    return matrix;
  }, [dates, roomTypes]);

  const pricingMatrix = useMemo(() => {
    const matrix = {};
    roomTypes.forEach((roomType) => {
      const pricingRows = Array.isArray(roomType.roomPricings) ? roomType.roomPricings : [];
      (roomType.ratePlans || []).forEach((ratePlan) => {
        const rowKey = `${roomType.id}:${ratePlan.id}`;
        matrix[rowKey] = {};

        dates.forEach((dateKey) => {
          const priceRow = pricingRows.find(
            (row) => row.ratePlanId === ratePlan.id && formatDateKey(row.date) === dateKey,
          );
          matrix[rowKey][dateKey] = Number(priceRow?.price ?? 0);
        });
      });
    });

    return matrix;
  }, [dates, roomTypes]);

  const handleInventorySave = async ({ roomTypeId, date, availableRooms }) => {
    try {
      setSavingRoomTypeId(roomTypeId);
      const updated = await inventoryService.update({ roomTypeId, date, availableRooms });
      setProperty((current) => ({
        ...current,
        roomTypes: current.roomTypes.map((roomType) => {
          if (roomType.id !== roomTypeId) {
            return roomType;
          }

          return {
            ...roomType,
            inventories: upsertByDate(roomType.inventories, date, {
              id: updated.id,
              availableRooms: updated.availableRooms,
            }),
          };
        }),
      }));
      pushToast({ type: 'success', title: 'Inventory saved', message: `${updated.availableRooms} rooms available on ${date}` });
    } catch (saveError) {
      pushToast({ type: 'error', title: 'Inventory save failed', message: saveError.response?.data?.message || saveError.message });
      throw saveError;
    } finally {
      setSavingRoomTypeId(null);
    }
  };

  const handlePricingSave = async ({ roomTypeId, ratePlanId, date, price }) => {
    try {
      setSavingPricingRowKey(`${roomTypeId}:${ratePlanId}`);
      await roomService.bulkUpdate({
        roomTypeId,
        type: 'price',
        operation: 'set',
        ratePlanId,
        applyToAll: false,
        startDate: date,
        endDate: date,
        value: Number(price),
      });
      setProperty((current) => ({
        ...current,
        roomTypes: current.roomTypes.map((roomType) => {
          if (roomType.id !== roomTypeId) {
            return roomType;
          }

          const nextRoomPricings = upsertByDate(
            (roomType.roomPricings || []).filter((row) => row.ratePlanId === ratePlanId),
            date,
            {
              roomTypeId,
              ratePlanId,
              price: Number(price),
            },
          );

          const untouched = (roomType.roomPricings || []).filter(
            (row) => row.ratePlanId !== ratePlanId || formatDateKey(row.date) !== date,
          );

          return {
            ...roomType,
            roomPricings: [...untouched, ...nextRoomPricings],
          };
        }),
      }));
      pushToast({ type: 'success', title: 'Pricing saved', message: `Date-wise pricing updated for ${date}.` });
    } catch (saveError) {
      pushToast({ type: 'error', title: 'Pricing save failed', message: saveError.response?.data?.message || saveError.message });
      throw saveError;
    } finally {
      setSavingPricingRowKey(null);
    }
  };

  const openCreateRoomModal = () => {
    setEditingRoom(null);
    setRoomForm(roomTypeToForm());
    setRoomModalOpen(true);
  };

  const openEditRoomModal = (roomType) => {
    setEditingRoom(roomType);
    setRoomForm(roomTypeToForm(roomType));
    setRoomModalOpen(true);
  };

  const addRatePlanRow = () => {
    setRoomForm((current) => ({
      ...current,
      ratePlans: [...current.ratePlans, createEmptyRatePlan()],
    }));
  };

  const updateRatePlanRow = (index, field, value) => {
    setRoomForm((current) => ({
      ...current,
      ratePlans: current.ratePlans.map((ratePlan, currentIndex) =>
        currentIndex === index
          ? {
              ...ratePlan,
              [field]: value,
            }
          : ratePlan,
      ),
    }));
  };

  const removeRatePlanRow = (index) => {
    setRoomForm((current) => {
      const nextRatePlans = current.ratePlans.filter((_, currentIndex) => currentIndex !== index);
      return {
        ...current,
        ratePlans: ensureDefaultRatePlan(nextRatePlans.length > 0 ? nextRatePlans : [createEmptyRatePlan('EP')]),
      };
    });
  };

  const setDefaultRatePlanRow = (index) => {
    setRoomForm((current) => ({
      ...current,
      ratePlans: current.ratePlans.map((ratePlan, currentIndex) => ({
        ...ratePlan,
        isDefault: currentIndex === index,
      })),
    }));
  };

  const submitInventoryBulkUpdate = async (event) => {
    event.preventDefault();
    try {
      await roomService.bulkUpdate({
        roomTypeId: inventoryBulkForm.roomTypeId,
        type: 'inventory',
        operation: inventoryBulkForm.operation,
        value: Number(inventoryBulkForm.value),
        startDate: inventoryBulkForm.startDate,
        endDate: inventoryBulkForm.endDate,
      });

      setInventoryBulkModalOpen(false);
      pushToast({
        type: 'success',
        title: 'Bulk update applied',
        message: 'Inventory updated for the selected date range.',
      });
      await loadProperty(range);
    } catch (bulkError) {
      pushToast({ type: 'error', title: 'Bulk update failed', message: bulkError.response?.data?.message || bulkError.message });
    }
  };

  const submitPriceBulkUpdate = async (event) => {
    event.preventDefault();
    try {
      const applyToAll = priceBulkForm.ratePlanId === 'ALL';
      await roomService.bulkUpdate({
        roomTypeId: priceBulkForm.roomTypeId,
        type: 'price',
        operation: priceBulkForm.operation,
        ratePlanId: applyToAll ? 'ALL' : priceBulkForm.ratePlanId,
        applyToAll,
        startDate: priceBulkForm.startDate,
        endDate: priceBulkForm.endDate,
        value: Number(priceBulkForm.value),
      });

      setPriceBulkModalOpen(false);
      pushToast({
        type: 'success',
        title: 'Bulk update applied',
        message: 'Pricing updated for the selected date range.',
      });
      await loadProperty(range);
    } catch (bulkError) {
      pushToast({ type: 'error', title: 'Bulk update failed', message: bulkError.response?.data?.message || bulkError.message });
    }
  };

  const submitRoom = async (event) => {
    event.preventDefault();

    const normalizedRatePlans = ensureDefaultRatePlan(normalizeRatePlans(roomForm.ratePlans)).map((ratePlan) => ({
      mealPlanName: ratePlan.mealPlanName,
      basePrice: ratePlan.basePrice === '' ? undefined : Number(ratePlan.basePrice),
      extraBedPrice: ratePlan.extraBedPrice === '' ? undefined : Number(ratePlan.extraBedPrice),
      isDefault: ratePlan.isDefault,
    }));

    try {
      if (editingRoom) {
        await roomService.update(editingRoom.id, {
          name: roomForm.name,
          baseCapacity: Number(roomForm.baseCapacity),
          maxCapacity: Number(roomForm.maxCapacity),
          roomInventory: Number(roomForm.roomInventory),
          ratePlans: normalizedRatePlans,
        });
        pushToast({ type: 'success', title: 'Room updated', message: `${roomForm.name} was updated.` });
      } else {
        await roomService.create({
          propertyId,
          name: roomForm.name,
          baseCapacity: Number(roomForm.baseCapacity),
          maxCapacity: Number(roomForm.maxCapacity),
          roomInventory: Number(roomForm.roomInventory),
          ratePlans: normalizedRatePlans,
        });
        pushToast({ type: 'success', title: 'Room added', message: `${roomForm.name} is now available.` });
      }

      setRoomModalOpen(false);
      await loadProperty(range);
    } catch (roomError) {
      pushToast({ type: 'error', title: 'Room save failed', message: roomError.response?.data?.message || roomError.message });
    }
  };

  const deleteRoom = async (roomType) => {
    try {
      await roomService.remove(roomType.id);
      pushToast({ type: 'success', title: 'Room deleted', message: `${roomType.name} was removed.` });
      await loadProperty(range);
    } catch (roomError) {
      pushToast({ type: 'error', title: 'Delete failed', message: roomError.response?.data?.message || roomError.message });
    }
  };

  const savePropertyInfo = async (payload) => {
    try {
      setPropertySaving(true);
      const updated = await propertyService.update(propertyId, payload);

      setProperty((current) => ({
        ...current,
        ...updated,
      }));
      setPropertyForm({
        name: updated.name || '',
        fullAddress: updated.fullAddress || updated.location || '',
        pinCode: updated.pinCode || '',
        city: updated.city || '',
        state: updated.state || '',
        mobileNumber: updated.mobileNumber || '',
        landlineNumber: updated.landlineNumber || '',
        email: updated.email || '',
        website: updated.website || '',
        gstNumber: updated.gstNumber || '',
        propertyLogo: updated.propertyLogo || '',
        description: updated.description || '',
        longDescription: updated.longDescription || '',
      });
      setPropertyModalOpen(false);

      pushToast({ type: 'success', title: 'Property updated', message: 'Property information was saved successfully.' });
    } catch (updateError) {
      const firstValidationError = updateError.response?.data?.errors?.[0]?.message;
      pushToast({ type: 'error', title: 'Update failed', message: firstValidationError || updateError.response?.data?.message || updateError.message });
    } finally {
      setPropertySaving(false);
    }
  };

  const deletePropertyInfo = async () => {
    if (!window.confirm('Delete this property? This action cannot be undone.')) {
      return;
    }

    try {
      await propertyService.remove(propertyId);
      pushToast({ type: 'success', title: 'Property deleted', message: 'Property was deleted successfully.' });
      navigate('/properties');
    } catch (deleteError) {
      pushToast({ type: 'error', title: 'Delete failed', message: deleteError.response?.data?.message || deleteError.message });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-28 rounded-3xl" />
        <LoadingSkeleton className="h-96 rounded-3xl" />
        <LoadingSkeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/properties')} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
        ← Back to properties
      </button>

      <ErrorBanner message={error} />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">Property workspace</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{property?.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{property?.fullAddress || property?.location} · {property?.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEditPropertyInfo ? (
              <button
                onClick={() => setPropertyModalOpen(true)}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Edit Property
              </button>
            ) : null}
            {user?.role === 'ADMIN' ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">Managers</p>
                <p>{property?.managers?.map((manager) => manager.name).join(', ') || 'Unassigned'}</p>
              </div>
            ) : null}
          </div>
        </div>

      </section>

      {canEditPropertyInfo ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900">Edit property information</h3>
              <p className="text-sm text-slate-500">Update core details, contacts, branding, and descriptions.</p>
            </div>
            <button onClick={() => setPropertyModalOpen(true)} className="rounded-2xl bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800">
              Open edit form
            </button>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Address</p>
              <p className="mt-1 text-slate-700">{property?.fullAddress || property?.location || 'Not set'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pin Code</p>
              <p className="mt-1 text-slate-700">{property?.pinCode || 'Not set'}</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Email</p>
              <p className="mt-1 text-slate-700">{property?.email || 'Not set'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mobile</p>
              <p className="mt-1 text-slate-700">{property?.mobileNumber || 'Not set'}</p>
            </div>
          </div>
          {user?.role === 'ADMIN' ? (
            <button type="button" onClick={deletePropertyInfo} className="mt-4 rounded-2xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700">
              Delete property
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900">Room management</h3>
            <p className="text-sm text-slate-500">Add, edit, and delete room types plus shared inventory and rate plans.</p>
          </div>
          <button onClick={openCreateRoomModal} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Add Room
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {roomTypes.map((roomType) => (
            <div key={roomType.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{roomType.name}</p>
              <p className="mt-1 text-xs text-slate-500">Capacity {roomType.baseCapacity} to {roomType.maxCapacity}</p>
              <p className="mt-1 text-xs text-slate-500">Room inventory {roomType.roomInventory ?? roomType.baseInventory ?? 0}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(roomType.ratePlans || []).map((ratePlan) => (
                  <span
                    key={ratePlan.id || `${roomType.id}-${ratePlan.mealPlanName}`}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ratePlan.isDefault ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {ratePlan.mealPlanName}{ratePlan.isDefault ? ' • default' : ''}
                  </span>
                ))}
                {!(roomType.ratePlans || []).length ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    EP
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => openEditRoomModal(roomType)} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
                  Edit room
                </button>
                <button onClick={() => deleteRoom(roomType)} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                  Delete room
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Start date</span>
            <input
              type="date"
              value={range.startDate}
              onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">End date</span>
            <input
              type="date"
              value={range.endDate}
              onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
          <button
            onClick={() => loadProperty(range)}
            className="self-end rounded-2xl bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800"
          >
            Refresh grids
          </button>
        </div>
      </section>

      <InventoryGrid
        roomTypes={roomTypes}
        dates={dates}
        dataByRoomType={inventoryMatrix}
        onSave={handleInventorySave}
        loadingRoomTypeId={savingRoomTypeId}
        actionButton={{
          label: 'Bulk Inventory Update',
          onClick: () => {
            setInventoryBulkForm({
              roomTypeId: roomTypes[0]?.id || '',
              operation: 'set',
              value: '0',
              startDate: range.startDate,
              endDate: range.endDate,
            });
            setInventoryBulkModalOpen(true);
          },
        }}
      />
      <PricingGrid
        roomTypes={roomTypes}
        dates={dates}
        dataByRoomPlan={pricingMatrix}
        onSave={handlePricingSave}
        loadingRowKey={savingPricingRowKey}
        actionButton={{
          label: 'Bulk Price Update',
          onClick: () => {
            setPriceBulkForm({
              roomTypeId: roomTypes[0]?.id || '',
              ratePlanId: 'ALL',
              operation: 'set',
              value: '0',
              startDate: range.startDate,
              endDate: range.endDate,
            });
            setPriceBulkModalOpen(true);
          },
        }}
      />

      <Modal open={roomModalOpen} title={editingRoom ? 'Edit room' : 'Add room'} onClose={() => setRoomModalOpen(false)} panelClassName="max-w-6xl">
        <form className="space-y-4" onSubmit={submitRoom}>
          <TextInput
            label="Room name"
            value={roomForm.name}
            onChange={(event) => setRoomForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <TextInput
            label="Base capacity"
            type="number"
            min="1"
            value={roomForm.baseCapacity}
            onChange={(event) => setRoomForm((current) => ({ ...current, baseCapacity: event.target.value }))}
            required
          />
          <TextInput
            label="Max capacity"
            type="number"
            min="1"
            value={roomForm.maxCapacity}
            onChange={(event) => setRoomForm((current) => ({ ...current, maxCapacity: event.target.value }))}
            required
          />
          <TextInput
            label="Room inventory"
            type="number"
            min="0"
            value={roomForm.roomInventory}
            onChange={(event) => setRoomForm((current) => ({ ...current, roomInventory: event.target.value }))}
            required
          />

          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Rate Plans</p>
                <p className="text-xs text-slate-500">Inventory stays shared at room type level. Add one or more meal-plan prices here.</p>
              </div>
              <button type="button" onClick={addRatePlanRow} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                + Add Rate Plan
              </button>
            </div>

            <div className="space-y-3">
              {roomForm.ratePlans.map((ratePlan, index) => (
                <div key={ratePlan._draftId || `${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 md:grid-cols-[1.3fr,1fr,1fr,auto] md:items-end">
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">Meal plan</span>
                      <input
                        value={ratePlan.mealPlanName}
                        onChange={(event) => updateRatePlanRow(index, 'mealPlanName', event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                        placeholder="EP"
                        required
                      />
                    </label>
                    <TextInput
                      label="Base price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={ratePlan.basePrice}
                      onChange={(event) => updateRatePlanRow(index, 'basePrice', event.target.value)}
                    />
                    <TextInput
                      label="Extra bed price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={ratePlan.extraBedPrice}
                      onChange={(event) => updateRatePlanRow(index, 'extraBedPrice', event.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDefaultRatePlanRow(index)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold ${ratePlan.isDefault ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
                      >
                        {ratePlan.isDefault ? 'Default' : 'Set default'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRatePlanRow(index)}
                        disabled={roomForm.ratePlans.length === 1}
                        className="rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">
            {editingRoom ? 'Save room' : 'Create room'}
          </button>
        </form>
      </Modal>

      <Modal open={inventoryBulkModalOpen} title="Bulk Inventory Update" onClose={() => setInventoryBulkModalOpen(false)}>
        <form className="space-y-3" onSubmit={submitInventoryBulkUpdate}>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Room type</span>
            <select
              value={inventoryBulkForm.roomTypeId}
              onChange={(event) => setInventoryBulkForm((current) => ({ ...current, roomTypeId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              required
            >
              <option value="">Select room type</option>
              {roomTypes.map((roomType) => (
                <option key={roomType.id} value={roomType.id}>{roomType.name}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Operation</span>
              <select
                value={inventoryBulkForm.operation}
                onChange={(event) => setInventoryBulkForm((current) => ({ ...current, operation: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="set">Set to value</option>
                <option value="increase">Increase by value</option>
                <option value="decrease">Decrease by value</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Start date"
              type="date"
              value={inventoryBulkForm.startDate}
              onChange={(event) => setInventoryBulkForm((current) => ({ ...current, startDate: event.target.value }))}
              required
            />
            <TextInput
              label="End date"
              type="date"
              value={inventoryBulkForm.endDate}
              onChange={(event) => setInventoryBulkForm((current) => ({ ...current, endDate: event.target.value }))}
              required
            />
          </div>

          <TextInput
            label="Value"
            type="number"
            min="0"
            step="0.01"
            value={inventoryBulkForm.value}
            onChange={(event) => setInventoryBulkForm((current) => ({ ...current, value: event.target.value }))}
            required
          />

          <button type="submit" className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">
            Apply inventory update
          </button>
        </form>
      </Modal>

      <Modal open={priceBulkModalOpen} title="Bulk Price Update" onClose={() => setPriceBulkModalOpen(false)}>
        <form className="space-y-3" onSubmit={submitPriceBulkUpdate}>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Room type</span>
            <select
              value={priceBulkForm.roomTypeId}
              onChange={(event) => setPriceBulkForm((current) => ({ ...current, roomTypeId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              required
            >
              <option value="">Select room type</option>
              {roomTypes.map((roomType) => (
                <option key={roomType.id} value={roomType.id}>{roomType.name}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Meal plan</span>
              <select
                value={priceBulkForm.ratePlanId}
                onChange={(event) => setPriceBulkForm((current) => ({ ...current, ratePlanId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="ALL">ALL</option>
                {(roomTypes.find((roomType) => roomType.id === priceBulkForm.roomTypeId)?.ratePlans || []).map((ratePlan) => (
                  <option key={ratePlan.id} value={ratePlan.id}>
                    {String(ratePlan.mealPlanName || '').toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Operation</span>
              <select
                value={priceBulkForm.operation}
                onChange={(event) => setPriceBulkForm((current) => ({ ...current, operation: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="set">Set to value</option>
                <option value="increase">Increase by value</option>
                <option value="decrease">Decrease by value</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Start date"
              type="date"
              value={priceBulkForm.startDate}
              onChange={(event) => setPriceBulkForm((current) => ({ ...current, startDate: event.target.value }))}
              required
            />
            <TextInput
              label="End date"
              type="date"
              value={priceBulkForm.endDate}
              onChange={(event) => setPriceBulkForm((current) => ({ ...current, endDate: event.target.value }))}
              required
            />
          </div>

          <TextInput
            label="Value"
            type="number"
            min="0"
            step="0.01"
            value={priceBulkForm.value}
            onChange={(event) => setPriceBulkForm((current) => ({ ...current, value: event.target.value }))}
            required
          />

          <button type="submit" className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">
            Apply price update
          </button>
        </form>
      </Modal>

      <Modal open={propertyModalOpen} title="Edit property" onClose={() => setPropertyModalOpen(false)} panelClassName="max-w-6xl">
        <PropertyForm initialData={propertyForm} onSubmit={savePropertyInfo} isEditMode isSubmitting={propertySaving} />
      </Modal>
    </div>
  );
}

export default PropertyDetails;
