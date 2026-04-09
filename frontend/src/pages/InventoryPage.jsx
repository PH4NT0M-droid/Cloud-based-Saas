import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import propertyService from '../services/propertyService';
import SearchSelect from '../components/SearchSelect';
import ErrorBanner from '../components/ErrorBanner';

function InventoryPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    propertyService
      .getAll()
      .then(setProperties)
      .catch((loadError) => setError(loadError.response?.data?.message || 'Failed to load properties'));
  }, []);

  const options = useMemo(
    () => properties.map((property) => ({ value: property.id, label: property.name, meta: property.location })),
    [properties],
  );

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-700">Inventory</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Pick a property to manage availability</h2>
        <p className="mt-2 text-sm text-slate-500">Inline inventory editing lives on the property workspace for a cleaner MMT-style flow.</p>
      </div>

      <ErrorBanner message={error} />

      <SearchSelect
        label="Search property by name"
        options={options}
        value={selectedPropertyId}
        onChange={setSelectedPropertyId}
        placeholder="Choose a property"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={() => selectedPropertyId && navigate(`/properties/${selectedPropertyId}`)}
          disabled={!selectedPropertyId}
          className="rounded-full bg-brand-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open property workspace
        </button>
      </div>
    </div>
  );
}

export default InventoryPage;