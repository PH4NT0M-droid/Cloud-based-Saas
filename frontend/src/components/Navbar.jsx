import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';
import useAuth from '../hooks/useAuth';

function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const onLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between border-b border-white/60 bg-white/80 px-4 py-4 backdrop-blur md:px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand-700">Cloud SaaS OTA Channel Manager</p>
        <div className="mt-1 flex items-center gap-3">
          <p className="text-lg font-bold text-slate-900">Welcome, {user?.name || 'Operator'}</p>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
            {user?.role || 'USER'}
          </span>
        </div>
      </div>
      <button onClick={onLogout} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        Logout
      </button>
    </header>
  );
}

export default Navbar;
