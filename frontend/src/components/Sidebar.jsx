import { NavLink } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { canManageBookings } from '../utils/permissions';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/properties', label: 'Properties' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/rates', label: 'Rates' },
  { to: '/bookings', label: 'Bookings' },
  { to: '/promotions', label: 'Promotions' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/admin', label: 'Admin Panel', roles: ['ADMIN'] },
];

function Sidebar() {
  const { user } = useAuth();
  const visibleLinks = links
    .filter((link) => !link.roles || link.roles.includes(user?.role))
    .filter((link) => (link.to === '/bookings' ? canManageBookings(user) : true));

  return (
    <aside className="w-full border-b border-white/20 bg-slate-950/95 p-4 text-white shadow-2xl md:w-72 md:border-b-0 md:border-r md:border-white/10">
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-brand-200">SaaS Operations</p>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight">OTA Channel Manager</h1>
        <p className="mt-1 text-sm text-slate-300">{user?.role || 'Guest'} workspace</p>
      </div>
      <nav className="space-y-2">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive ? 'bg-white/15 text-white ring-1 ring-white/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
