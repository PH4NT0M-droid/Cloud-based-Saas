import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import propertyService from '../services/propertyService';
import inventoryService from '../services/inventoryService';
import rateService from '../services/rateService';
import roomService from '../services/roomService';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorBanner from '../components/ErrorBanner';
import InventoryGrid from '../components/InventoryGrid';
import PricingGrid from '../components/PricingGrid';
import Modal from '../components/Modal';
import TextInput from '../components/forms/TextInput';
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

function PropertyDetails() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [range, setRange] = useState(buildDateRange());
  const [loading, setLoading] = useState(true);
  const [savingRoomTypeId, setSavingRoomTypeId] = useState(null);
  const [error, setError] = useState(null);
  const [property, setProperty] = useState(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({ name: '', maxOccupancy: '2' });

  const loadProperty = async (nextRange = range) => {
    try {
      setLoading(true);
      setError(null);
      const overview = await propertyService.getOverview(propertyId, nextRange);
      setProperty(overview);
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

  const inventoryMatrix = useMemo(() => {
    const matrix = {};
    roomTypes.forEach((roomType) => {
      matrix[roomType.id] = {};
      roomType.inventories.forEach((inventory) => {
        matrix[roomType.id][formatDateKey(inventory.date)] = inventory;
      });
    });
    return matrix;
  }, [roomTypes]);

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
    });
    return matrix;
  }, [roomTypes]);

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
            inventories: roomType.inventories.map((inventory) =>
              formatDateKey(inventory.date) === date ? { ...inventory, availableRooms: updated.availableRooms } : inventory,
            ),
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
            rates: roomType.rates.map((rate) =>
              formatDateKey(rate.date) === date ? { ...rate, basePrice: updated.basePrice, otaModifier: updated.otaModifier } : rate,
            ),
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
    setRoomForm({ name: '', maxOccupancy: '2' });
    setRoomModalOpen(true);
  };

  const openEditRoomModal = (roomType) => {
    setEditingRoom(roomType);
    setRoomForm({ name: roomType.name, maxOccupancy: String(roomType.maxOccupancy) });
    setRoomModalOpen(true);
  };

  const submitRoom = async (event) => {
    event.preventDefault();

    try {
      if (editingRoom) {
        await roomService.update(editingRoom.id, {
          name: roomForm.name,
          maxOccupancy: Number(roomForm.maxOccupancy),
        });
        pushToast({ type: 'success', title: 'Room updated', message: `${roomForm.name} was updated.` });
      } else {
        await roomService.create({
          propertyId,
          name: roomForm.name,
          maxOccupancy: Number(roomForm.maxOccupancy),
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
            <p className="mt-2 text-sm text-slate-500">{property?.location} · {property?.description}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">Managers</p>
            <p>{property?.managers?.map((manager) => manager.name).join(', ') || 'Unassigned'}</p>
          </div>
        </div>

      </section>

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
              <p className="mt-1 text-xs text-slate-500">Occupancy cap {roomType.maxOccupancy}</p>
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
            label="Max occupancy"
            type="number"
            value={roomForm.maxOccupancy}
            onChange={(event) => setRoomForm((current) => ({ ...current, maxOccupancy: event.target.value }))}
            required
          />
          <button className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">
            {editingRoom ? 'Save room' : 'Create room'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default PropertyDetails;