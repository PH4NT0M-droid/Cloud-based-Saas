import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import propertyService from '../services/propertyService';
import inventoryService from '../services/inventoryService';
import rateService from '../services/rateService';
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
import { formatCurrency } from '../utils/format';

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

const canEditProperty = (user) => {
  if (!user) {
    return false;
  }

  if (user.role === 'ADMIN' || user.role === 'admin') {
    return true;
  }

  const permissions = user.permissions;
  if (Array.isArray(permissions)) {
    return permissions.includes('EDIT_PROPERTY');
  }

  return Boolean(permissions?.canManageProperties || permissions?.EDIT_PROPERTY || permissions?.edit_property);
};

function PropertyDetails() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [range, setRange] = useState(buildDateRange());
  const [loading, setLoading] = useState(true);
  const [savingRoomTypeId, setSavingRoomTypeId] = useState(null);
  const [error, setError] = useState(null);
  const [property, setProperty] = useState(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [propertySaving, setPropertySaving] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({
    name: '',
    basePrice: '0',
    extraPersonPrice: '0',
    baseCapacity: '1',
    maxCapacity: '2',
    baseInventory: '1',
  });
  const [bulkForm, setBulkForm] = useState({
    roomTypeId: '',
    type: 'price',
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
      matrix[roomType.id] = {};
      roomType.rates.forEach((rate) => {
        matrix[roomType.id][formatDateKey(rate.date)] = {
          ...rate,
          effectivePrice: rate.basePrice * rate.otaModifier,
        };
      });

      dates.forEach((dateKey) => {
        if (!matrix[roomType.id][dateKey]) {
          matrix[roomType.id][dateKey] = {
            date: dateKey,
            basePrice: roomType.basePrice ?? 0,
            otaModifier: 1,
            effectivePrice: roomType.basePrice ?? 0,
          };
        }
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

  const handlePricingSave = async ({ roomTypeId, date, basePrice }) => {
    try {
      setSavingRoomTypeId(roomTypeId);
      const updated = await rateService.update({ roomTypeId, date, basePrice, otaModifier: 1 });
      setProperty((current) => ({
        ...current,
        roomTypes: current.roomTypes.map((roomType) => {
          if (roomType.id !== roomTypeId) {
            return roomType;
          }

          return {
            ...roomType,
            rates: upsertByDate(roomType.rates, date, {
              id: updated.id,
              basePrice: updated.basePrice,
              otaModifier: updated.otaModifier,
            }),
          };
        }),
      }));
      pushToast({ type: 'success', title: 'Pricing saved', message: `${formatCurrency(updated.basePrice)} updated for ${date}` });
    } catch (saveError) {
      pushToast({ type: 'error', title: 'Pricing save failed', message: saveError.response?.data?.message || saveError.message });
      throw saveError;
    } finally {
      setSavingRoomTypeId(null);
    }
  };

  const openCreateRoomModal = () => {
    setEditingRoom(null);
    setRoomForm({ name: '', basePrice: '0', extraPersonPrice: '0', baseCapacity: '1', maxCapacity: '2', baseInventory: '1' });
    setRoomModalOpen(true);
  };

  const openEditRoomModal = (roomType) => {
    setEditingRoom(roomType);
    setRoomForm({
      name: roomType.name,
      basePrice: String(roomType.basePrice ?? 0),
      extraPersonPrice: String(roomType.extraPersonPrice ?? 0),
      baseCapacity: String(roomType.baseCapacity ?? 1),
      maxCapacity: String(roomType.maxCapacity ?? roomType.maxOccupancy ?? 1),
      baseInventory: String(roomType.baseInventory ?? 1),
    });
    setRoomModalOpen(true);
  };

  const submitBulkUpdate = async (event) => {
    event.preventDefault();
    try {
      await roomService.bulkUpdate({
        roomTypeId: bulkForm.roomTypeId,
        type: bulkForm.type,
        operation: bulkForm.operation,
        value: Number(bulkForm.value),
        startDate: bulkForm.startDate,
        endDate: bulkForm.endDate,
      });

      setBulkModalOpen(false);
      pushToast({ type: 'success', title: 'Bulk update applied', message: 'Rates or inventory were updated for the selected date range.' });
      await loadProperty(range);
    } catch (bulkError) {
      pushToast({ type: 'error', title: 'Bulk update failed', message: bulkError.response?.data?.message || bulkError.message });
    }
  };

  const submitRoom = async (event) => {
    event.preventDefault();

    try {
      if (editingRoom) {
        await roomService.update(editingRoom.id, {
          name: roomForm.name,
          basePrice: Number(roomForm.basePrice),
          extraPersonPrice: Number(roomForm.extraPersonPrice),
          baseCapacity: Number(roomForm.baseCapacity),
          maxCapacity: Number(roomForm.maxCapacity),
          baseInventory: Number(roomForm.baseInventory),
        });
        pushToast({ type: 'success', title: 'Room updated', message: `${roomForm.name} was updated.` });
      } else {
        await roomService.create({
          propertyId,
          name: roomForm.name,
          basePrice: Number(roomForm.basePrice),
          extraPersonPrice: Number(roomForm.extraPersonPrice),
          baseCapacity: Number(roomForm.baseCapacity),
          maxCapacity: Number(roomForm.maxCapacity),
          baseInventory: Number(roomForm.baseInventory),
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
            <p className="text-sm text-slate-500">Add, edit, and delete room types for this property.</p>
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
              <p className="mt-1 text-xs text-slate-500">
                Base {formatCurrency(roomType.basePrice || 0)} + extra {formatCurrency(roomType.extraPersonPrice || 0)} / person
              </p>
              <p className="mt-1 text-xs text-slate-500">Base inventory {roomType.baseInventory ?? 0}</p>
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
          <button
            onClick={() => {
              setBulkForm((current) => ({
                ...current,
                roomTypeId: roomTypes[0]?.id || '',
                startDate: range.startDate,
                endDate: range.endDate,
              }));
              setBulkModalOpen(true);
            }}
            className="self-end rounded-2xl bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800"
          >
            Bulk update
          </button>
        </div>
      </section>

      <InventoryGrid roomTypes={roomTypes} dates={dates} dataByRoomType={inventoryMatrix} onSave={handleInventorySave} loadingRoomTypeId={savingRoomTypeId} />
      <PricingGrid roomTypes={roomTypes} dates={dates} dataByRoomType={pricingMatrix} onSave={handlePricingSave} loadingRoomTypeId={savingRoomTypeId} />

      <Modal open={roomModalOpen} title={editingRoom ? 'Edit room' : 'Add room'} onClose={() => setRoomModalOpen(false)}>
        <form className="space-y-4" onSubmit={submitRoom}>
          <TextInput
            label="Room name"
            value={roomForm.name}
            onChange={(event) => setRoomForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <TextInput
            label="Base price"
            type="number"
            min="0"
            step="0.01"
            value={roomForm.basePrice}
            onChange={(event) => setRoomForm((current) => ({ ...current, basePrice: event.target.value }))}
            required
          />
          <TextInput
            label="Extra person price"
            type="number"
            min="0"
            step="0.01"
            value={roomForm.extraPersonPrice}
            onChange={(event) => setRoomForm((current) => ({ ...current, extraPersonPrice: event.target.value }))}
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
            label="Base inventory"
            type="number"
            min="0"
            value={roomForm.baseInventory}
            onChange={(event) => setRoomForm((current) => ({ ...current, baseInventory: event.target.value }))}
            required
          />
          <button className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">
            {editingRoom ? 'Save room' : 'Create room'}
          </button>
        </form>
      </Modal>

      <Modal open={bulkModalOpen} title="Bulk update rates or inventory" onClose={() => setBulkModalOpen(false)}>
        <form className="space-y-3" onSubmit={submitBulkUpdate}>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Room type</span>
            <select
              value={bulkForm.roomTypeId}
              onChange={(event) => setBulkForm((current) => ({ ...current, roomTypeId: event.target.value }))}
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
              <span className="font-semibold text-slate-700">Type</span>
              <select
                value={bulkForm.type}
                onChange={(event) => setBulkForm((current) => ({ ...current, type: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="price">Price</option>
                <option value="inventory">Inventory</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Operation</span>
              <select
                value={bulkForm.operation}
                onChange={(event) => setBulkForm((current) => ({ ...current, operation: event.target.value }))}
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
              value={bulkForm.startDate}
              onChange={(event) => setBulkForm((current) => ({ ...current, startDate: event.target.value }))}
              required
            />
            <TextInput
              label="End date"
              type="date"
              value={bulkForm.endDate}
              onChange={(event) => setBulkForm((current) => ({ ...current, endDate: event.target.value }))}
              required
            />
          </div>

          <TextInput
            label="Value"
            type="number"
            min="0"
            step="0.01"
            value={bulkForm.value}
            onChange={(event) => setBulkForm((current) => ({ ...current, value: event.target.value }))}
            required
          />

          <button type="submit" className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">
            Apply bulk update
          </button>
        </form>
      </Modal>

      <Modal open={propertyModalOpen} title="Edit property" onClose={() => setPropertyModalOpen(false)}>
        <PropertyForm initialData={propertyForm} onSubmit={savePropertyInfo} isEditMode isSubmitting={propertySaving} />
      </Modal>
    </div>
  );
}

export default PropertyDetails;