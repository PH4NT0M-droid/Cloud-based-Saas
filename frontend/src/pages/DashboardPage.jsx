import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import propertyService from '../services/propertyService';
import bookingService from '../services/bookingService';
import useAuth from '../hooks/useAuth';
import { formatCurrency } from '../utils/format';

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    Promise.all([propertyService.getAll(), bookingService.getAll({})]).then(([loadedProperties, loadedBookings]) => {
      setProperties(loadedProperties);
      setBookings(loadedBookings);
    });
  }, []);

  const metrics = useMemo(() => {
    const confirmedBookings = bookings.filter((booking) => booking.status !== 'CANCELLED');
    const revenue = confirmedBookings.reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);
    const activeManagers = new Set(
      properties.flatMap((property) => (property.managers || []).map((manager) => manager.id)).filter(Boolean),
    ).size;

    return {
      properties: properties.length,
      rooms: properties.reduce((sum, property) => sum + (property.roomTypes?.length || 0), 0),
      bookings: confirmedBookings.length,
      revenue,
      activeManagers,
    };
  }, [bookings, properties]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-200">Control center</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black">A faster command surface for {user?.name || 'your team'}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Manage properties, pricing, and inventory from one polished workspace with role-based access and inline editing.
            </p>
          </div>
          <button onClick={() => navigate('/properties')} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
            Open properties
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Properties" value={metrics.properties} />
        <MetricCard label="Room types" value={metrics.rooms} />
        <MetricCard label="Bookings" value={metrics.bookings} />
        <MetricCard label="Revenue" value={formatCurrency(metrics.revenue)} />
        <MetricCard label="Managers" value={metrics.activeManagers} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900">Recent properties</h3>
          <div className="mt-4 space-y-3">
            {properties.slice(0, 5).map((property) => (
              <button
                key={property.id}
                onClick={() => navigate(`/properties/${property.id}`)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50"
              >
                <div>
                  <p className="font-semibold text-slate-900">{property.name}</p>
                  <p className="text-sm text-slate-500">{property.location}</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{property.roomTypes?.length || 0} rooms</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900">Latest bookings</h3>
          <div className="mt-4 space-y-3">
            {bookings.slice(0, 5).map((booking) => (
              <div key={booking.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{booking.guestName}</p>
                <p className="text-sm text-slate-500">
                  {booking.roomType?.property?.name || 'Property'} · {booking.roomType?.name || 'Room'} · {booking.status}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default DashboardPage;