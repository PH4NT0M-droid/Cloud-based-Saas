import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import TextInput from '../components/forms/TextInput';
import propertyService from '../services/propertyService';

function PromotionsPage() {
  const [promotions, setPromotions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', discount: 10, season: '', propertyIds: [] });

  useEffect(() => {
    propertyService.getAll().then((items) => setProperties(items)).catch(() => setProperties([]));
  }, []);

  const propertyNameMap = useMemo(
    () =>
      properties.reduce((acc, property) => {
        acc[property.id] = property.name;
        return acc;
      }, {}),
    [properties],
  );

  const onSubmit = (e) => {
    e.preventDefault();

    if (editingId) {
      setPromotions((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...form } : item)));
      setEditingId(null);
    } else {
      setPromotions((prev) => [...prev, { ...form, id: crypto.randomUUID() }]);
    }

    setForm({ name: '', discount: 10, season: '', propertyIds: [] });
  };

  const onEdit = (promotion) => {
    setEditingId(promotion.id);
    setForm({
      name: promotion.name,
      discount: promotion.discount,
      season: promotion.season,
      propertyIds: promotion.propertyIds || [],
    });
  };

  const onDelete = (promotionId) => {
    setPromotions((prev) => prev.filter((promotion) => promotion.id !== promotionId));

    if (editingId === promotionId) {
      setEditingId(null);
      setForm({ name: '', discount: 10, season: '', propertyIds: [] });
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold">Promotions</h2>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
        <TextInput label="Rule Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        <TextInput label="Discount %" type="number" value={form.discount} onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))} required />
        <TextInput label="Season" value={form.season} onChange={(e) => setForm((p) => ({ ...p, season: e.target.value }))} required />
          <button className="rounded-md bg-brand-700 px-4 py-2 font-semibold text-white">
            {editingId ? 'Save Promotion' : 'Create Promotion'}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Apply to properties</p>
          <div className="grid gap-2 md:grid-cols-2">
            {properties.map((property) => {
              const checked = form.propertyIds.includes(property.id);
              return (
                <label key={property.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-700">{property.name}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        propertyIds: event.target.checked
                          ? [...current.propertyIds, property.id]
                          : current.propertyIds.filter((id) => id !== property.id),
                      }));
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </label>
              );
            })}
          </div>
        </div>
      </form>

      <DataTable
        columns={[
          { key: 'name', label: 'Promotion' },
          { key: 'discount', label: 'Discount %' },
          { key: 'season', label: 'Season' },
          {
            key: 'properties',
            label: 'Applies To',
            render: (row) => (row.propertyIds || []).map((id) => propertyNameMap[id] || id).join(', ') || 'All properties',
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                <button type="button" onClick={() => onEdit(row)} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(row.id)} className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  Delete
                </button>
              </div>
            ),
          },
        ]}
        rows={promotions}
      />
    </div>
  );
}

export default PromotionsPage;
