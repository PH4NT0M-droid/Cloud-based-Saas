import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import propertyService from '../services/propertyService';
import Modal from '../components/Modal';
import TextInput from '../components/forms/TextInput';
import ErrorBanner from '../components/ErrorBanner';
import LoadingSkeleton from '../components/LoadingSkeleton';
import useAuth from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';

const initialForm = { name: '', location: '', description: '' };

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
  const [form, setForm] = useState(initialForm);

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

  const submit = async (event) => {
    event.preventDefault();

    try {
      setCreating(true);
      await propertyService.create(form);
      pushToast({ type: 'success', title: 'Property created', message: `${form.name} is now available in the workspace.` });
      setOpen(false);
      setForm(initialForm);
      await loadData();
    } catch (createError) {
      pushToast({ type: 'error', title: 'Create failed', message: createError.response?.data?.message || createError.message });
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
        {user?.role === 'ADMIN' ? (
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
            <p className="mt-1 text-sm text-slate-500">{property.location}</p>
            <p className="mt-3 text-sm text-slate-600">{property.description}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{property.roomTypes?.length || 0} room types</span>
              <span>{property.managers?.map((manager) => manager.name).join(', ') || 'Unassigned'}</span>
            </div>
          </button>
        ))}
      </div>

      <Modal open={open} title="Create property" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <TextInput label="Property name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          <TextInput label="Location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required />
          <TextInput label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required />
          <button disabled={creating} className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">
            {creating ? 'Creating...' : 'Create property'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default PropertiesPage;