import { useEffect, useMemo, useState } from 'react';
import bookingService from '../services/bookingService';
import { formatCurrency } from '../utils/format';
import ErrorBanner from '../components/ErrorBanner';
import useAuth from '../hooks/useAuth';

function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    bookingService
      .getAll({})
      .then(setBookings)
      .catch((loadError) => setError(loadError.response?.data?.message || 'Failed to load bookings'));
  }, []);

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BookingsPage;