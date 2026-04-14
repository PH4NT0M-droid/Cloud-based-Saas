import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import propertyService from '../services/propertyService';
import Modal from '../components/Modal';
import TextInput from '../components/forms/TextInput';
import PropertyForm from '../components/PropertyForm';
import ErrorBanner from '../components/ErrorBanner';
import LoadingSkeleton from '../components/LoadingSkeleton';
import useAuth from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';

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

function PropertiesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedProperties = await propertyService.getAll();
      setProperties(loadedProperties);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const visibleProperties = useMemo(
    () => properties.filter((property) => property.name.toLowerCase().includes(query.toLowerCase())),
    [properties, query],
  );

  const submit = async (payload) => {
    try {
      setCreating(true);
      await propertyService.create(payload);
      pushToast({ type: 'success', title: 'Property created', message: `${payload.name} is now available in the workspace.` });
      setOpen(false);
      await loadData();
    } catch (createError) {
      const firstValidationError = createError.response?.data?.errors?.[0]?.message;
      pushToast({ type: 'error', title: 'Create failed', message: firstValidationError || createError.response?.data?.message || createError.message });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton className="h-96 rounded-3xl" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">Properties</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Portfolio control</h2>
          <p className="mt-2 text-sm text-slate-500">Open a property to manage rooms, availability, and pricing from one workspace.</p>
        </div>
        {canEditProperty(user) ? (
          <button onClick={() => setOpen(true)} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Create property
          </button>
        ) : null}
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-3">
        <TextInput label="Search by property name" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search properties..." />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleProperties.map((property) => (
          <button
            key={property.id}
            onClick={() => navigate(`/properties/${property.id}`)}
            className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-2xl"
          >
            <p className="text-lg font-bold text-slate-900">{property.name}</p>
            <p className="mt-1 text-sm text-slate-500">{property.fullAddress || property.location}</p>
            <p className="mt-3 text-sm text-slate-600">{property.description}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{property.roomTypes?.length || 0} room types</span>
              {user?.role === 'ADMIN' ? <span>{property.managers?.map((manager) => manager.name).join(', ') || 'Unassigned'}</span> : null}
            </div>
          </button>
        ))}
      </div>

      <Modal open={open} title="Create property" onClose={() => setOpen(false)} panelClassName="max-w-4xl">
        <PropertyForm initialData={{}} onSubmit={submit} isSubmitting={creating} />
      </Modal>
    </div>
  );
}

export default PropertiesPage;