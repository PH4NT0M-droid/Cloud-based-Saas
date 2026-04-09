import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../store/slices/authSlice';
import TextInput from '../components/forms/TextInput';
import ErrorBanner from '../components/ErrorBanner';

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ email: '', password: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(login(form));
    if (!result.error) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(29,159,154,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,171,42,0.18),transparent_30%),linear-gradient(180deg,#f6fbfb_0%,#eef2ff_100%)] p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(21,68,67,0.12)] backdrop-blur">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-700">Portal Access</p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900">Sign in to the SaaS panel</h2>
          <p className="mt-2 text-sm text-slate-600">Use the seeded admin account to get started locally.</p>
        </div>
        <ErrorBanner message={error} />
        <TextInput
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
        <TextInput
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          required
        />
        <button className="w-full rounded-md bg-brand-700 py-2 font-semibold text-white hover:bg-brand-800" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
        <p className="text-center text-xs text-slate-500">
          Default local admin: admin@admin.com / Password123
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
