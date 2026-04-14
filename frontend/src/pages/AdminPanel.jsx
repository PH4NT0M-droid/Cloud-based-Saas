import { useEffect, useMemo, useState } from 'react';
import adminService from '../services/adminService';
import propertyService from '../services/propertyService';
import UserManagement from '../components/UserManagement';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorBanner from '../components/ErrorBanner';
import { useToast } from '../components/ToastProvider';

function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState(null);
  const { pushToast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [loadedUsers, loadedProperties] = await Promise.all([adminService.getUsers(), propertyService.getAll()]);
      setUsers(loadedUsers);
      setProperties(loadedProperties);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load admin panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(
    () => ({
      managers: users.length,
      assignedProperties: properties.filter((property) => (property.managers || []).length > 0).length,
      unassignedProperties: properties.filter((property) => (property.managers || []).length === 0).length,
    }),
    [properties, users],
  );

  const wrapAction = async (action) => {
    try {
      setBusy(true);
      await action();
      await loadData();
      pushToast({ type: 'success', title: 'Saved', message: 'Admin changes were applied successfully.' });
    } catch (actionError) {
      pushToast({
        type: 'error',
        title: 'Action failed',
        message: actionError.response?.data?.message || actionError.message || 'Unable to complete admin action',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-24 rounded-3xl" />
        <LoadingSkeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">Admin center</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">User and property control room</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Create managers, set granular permissions, and keep each property bound to the right operator.</p>
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Managers</p>
          <p className="mt-3 text-3xl font-black">{metrics.managers}</p>
        </div>
        <div className="rounded-3xl bg-brand-600 p-5 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-brand-100">Assigned properties</p>
          <p className="mt-3 text-3xl font-black">{metrics.assignedProperties}</p>
        </div>
        <div className="rounded-3xl bg-accent-500 p-5 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-white/80">Unassigned properties</p>
          <p className="mt-3 text-3xl font-black">{metrics.unassignedProperties}</p>
        </div>
      </div>

      <UserManagement
        users={users}
        properties={properties}
        loading={busy}
        onCreate={(payload) => wrapAction(() => adminService.createUser(payload))}
        onUpdate={(id, payload) => wrapAction(() => adminService.updateUser(id, payload))}
        onDelete={(id) => wrapAction(() => adminService.deleteUser(id))}
      />
    </div>
  );
}

export default AdminPanel;