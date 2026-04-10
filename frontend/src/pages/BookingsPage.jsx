import { useEffect, useMemo, useState } from 'react';
import bookingService from '../services/bookingService';
import roomService from '../services/roomService';
import promotionService from '../services/promotionService';
import { formatCurrency } from '../utils/format';
import ErrorBanner from '../components/ErrorBanner';
import useAuth from '../hooks/useAuth';
import Modal from '../components/Modal';
import TextInput from '../components/forms/TextInput';
import { useToast } from '../components/ToastProvider';

function BookingsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    roomTypeId: '',
    startDate: '',
    endDate: '',
    guestName: '',
    guestsCount: 1,
  });

  const canManageBookings = user?.role === 'ADMIN' || Boolean(user?.permissions?.manage_bookings);

  const loadBookings = async () => {
    const loaded = await bookingService.getAll({});
    setBookings(loaded);
  };

  const loadRooms = async () => {
    const loadedRooms = await roomService.getAll();
    setRooms(loadedRooms);
  };

  const loadPromotions = async () => {
    const loadedPromotions = await promotionService.getAll();
    setPromotions(loadedPromotions);
  };

  useEffect(() => {
    Promise.all([loadBookings(), loadRooms(), loadPromotions()]).catch((loadError) =>
      setError(loadError.response?.data?.message || 'Failed to load bookings'),
    );
  }, []);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === manualForm.roomTypeId) || null,
    [manualForm.roomTypeId, rooms],
  );

  const estimatedTotal = useMemo(() => {
    if (!selectedRoom || !manualForm.startDate || !manualForm.endDate) {
      return 0;
    }

    const start = new Date(manualForm.startDate);
    const end = new Date(manualForm.endDate);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (nights <= 0) {
      return 0;
    }

    const baseCapacity = Number(selectedRoom.baseCapacity || 1);
    const basePrice = Number(selectedRoom.basePrice || 0);
    const extraPersonPrice = Number(selectedRoom.extraPersonPrice || 0);
    const guests = Number(manualForm.guestsCount || 1);
    const extraGuests = Math.max(0, guests - baseCapacity);
    const nightly = basePrice + extraGuests * extraPersonPrice;

    const startUtc = new Date(`${manualForm.startDate}T00:00:00.000Z`);
    const roomPropertyId = selectedRoom.property?.id;
    let discountedTotal = 0;

    for (let offset = 0; offset < nights; offset += 1) {
      const date = new Date(startUtc);
      date.setUTCDate(startUtc.getUTCDate() + offset);

      const matchingPromotions = promotions.filter((promotion) => {
        const propertyIds = Array.isArray(promotion.propertyIds) ? promotion.propertyIds : [];
        const appliesToProperty = propertyIds.length === 0 || (roomPropertyId && propertyIds.includes(roomPropertyId));
        const afterStart = !promotion.startDate || new Date(promotion.startDate) <= date;
        const beforeEnd = !promotion.endDate || new Date(promotion.endDate) >= date;
        return appliesToProperty && afterStart && beforeEnd;
      });

      const discountPercent = matchingPromotions.length
        ? Math.max(...matchingPromotions.map((promotion) => Number(promotion.discountPercent || promotion.discount || 0)))
        : 0;

      discountedTotal += nightly * (1 - Math.max(0, Math.min(100, discountPercent)) / 100);
    }

    return discountedTotal;
  }, [manualForm.endDate, manualForm.guestsCount, manualForm.startDate, promotions, selectedRoom]);

  const submitManualBooking = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      await bookingService.createManual({
        roomTypeId: manualForm.roomTypeId,
        startDate: manualForm.startDate,
        endDate: manualForm.endDate,
        guestName: manualForm.guestName,
        guestsCount: Number(manualForm.guestsCount),
      });

      await loadBookings();
      setManualOpen(false);
      setManualForm({ roomTypeId: '', startDate: '', endDate: '', guestName: '', guestsCount: 1 });
      pushToast({ type: 'success', title: 'Booking created', message: 'Manual booking was created successfully.' });
    } catch (submitError) {
      pushToast({ type: 'error', title: 'Create failed', message: submitError.response?.data?.message || submitError.message });
    } finally {
      setBusy(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      setBusy(true);
      await bookingService.cancel(bookingId);
      await loadBookings();
      pushToast({ type: 'success', title: 'Booking cancelled', message: 'Booking has been cancelled and inventory restored.' });
    } catch (cancelError) {
      pushToast({ type: 'error', title: 'Cancel failed', message: cancelError.response?.data?.message || cancelError.message });
    } finally {
      setBusy(false);
    }
  };

  const visibleBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const haystack = [booking.otaSource, booking.guestName, booking.roomType?.name, booking.roomType?.property?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query.toLowerCase());
      }),
    [bookings, query],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">Bookings</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Search bookings by guest, room, property, or OTA</h2>
        <p className="mt-2 text-sm text-slate-500">The table now surfaces names everywhere, so operational staff never need to see raw IDs.</p>
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search bookings by name"
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-400"
        />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Logged in as {user?.role || 'USER'}
        </div>
        {canManageBookings ? (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Create Booking
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Property</th>
              <th className="px-4 py-3 text-left font-semibold">Room</th>
              <th className="px-4 py-3 text-left font-semibold">Guest</th>
              <th className="px-4 py-3 text-left font-semibold">Check in</th>
              <th className="px-4 py-3 text-left font-semibold">Check out</th>
              <th className="px-4 py-3 text-left font-semibold">OTA</th>
              <th className="px-4 py-3 text-left font-semibold">Total</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              {canManageBookings ? <th className="px-4 py-3 text-left font-semibold">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleBookings.map((booking) => (
              <tr key={booking.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{booking.roomType?.property?.name || 'Unknown property'}</td>
                <td className="px-4 py-3 text-slate-600">{booking.roomType?.name || 'Room'}</td>
                <td className="px-4 py-3 text-slate-600">{booking.guestName}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(booking.checkIn).toISOString().split('T')[0]}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(booking.checkOut).toISOString().split('T')[0]}</td>
                <td className="px-4 py-3 text-slate-600">{booking.otaSource}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(booking.totalPrice)}</td>
                <td className="px-4 py-3 text-slate-600">{booking.status}</td>
                {canManageBookings ? (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busy || booking.status === 'CANCELLED'}
                      onClick={() => cancelBooking(booking.id)}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={manualOpen} title="Create manual booking" onClose={() => setManualOpen(false)}>
        <form className="space-y-3" onSubmit={submitManualBooking}>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Room</span>
            <select
              required
              value={manualForm.roomTypeId}
              onChange={(event) => setManualForm((current) => ({ ...current, roomTypeId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            >
              <option value="">Select a room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.property?.name ? `${room.property.name} - ` : ''}
                  {room.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Start date"
              type="date"
              value={manualForm.startDate}
              onChange={(event) => setManualForm((current) => ({ ...current, startDate: event.target.value }))}
              required
            />
            <TextInput
              label="End date"
              type="date"
              value={manualForm.endDate}
              onChange={(event) => setManualForm((current) => ({ ...current, endDate: event.target.value }))}
              required
            />
          </div>

          <TextInput
            label="Guest name"
            value={manualForm.guestName}
            onChange={(event) => setManualForm((current) => ({ ...current, guestName: event.target.value }))}
            required
          />

          <TextInput
            label="Guest count"
            type="number"
            min="1"
            max={selectedRoom?.maxCapacity || selectedRoom?.maxOccupancy || 1}
            value={String(manualForm.guestsCount)}
            onChange={(event) => setManualForm((current) => ({ ...current, guestsCount: Number(event.target.value || 1) }))}
            required
          />

          <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Estimated total: <span className="font-bold text-slate-900">{formatCurrency(estimatedTotal)}</span>
          </p>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save booking
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default BookingsPage;