import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import TextInput from '../components/forms/TextInput';
import propertyService from '../services/propertyService';
import promotionService from '../services/promotionService';
import { useToast } from '../components/ToastProvider';

function PromotionsPage() {
  const { pushToast } = useToast();
  const [promotions, setPromotions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', discount: 10, season: '', propertyIds: [] });

  useEffect(() => {
    propertyService.getAll().then((items) => setProperties(items)).catch(() => setProperties([]));
    promotionService.getAll().then((items) => setPromotions(items)).catch(() => setPromotions([]));
  }, []);

  const propertyNameMap = useMemo(
    () =>
      properties.reduce((acc, property) => {
        acc[property.id] = property.name;
        return acc;
      }, {}),
    [properties],
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const updated = await promotionService.update(editingId, form);
        setPromotions((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
        setEditingId(null);
        pushToast({ type: 'success', title: 'Promotion updated', message: 'Promotion changes were saved.' });
      } else {
        const created = await promotionService.create(form);
        setPromotions((prev) => [created, ...prev]);
        pushToast({ type: 'success', title: 'Promotion created', message: 'Promotion was created successfully.' });
      }

      setForm({ name: '', discount: 10, season: '', propertyIds: [] });
    } catch (error) {
      pushToast({ type: 'error', title: 'Save failed', message: error.response?.data?.message || error.message });
    }
  };

  const onEdit = (promotion) => {
    setEditingId(promotion.id);
    setForm({
      name: promotion.name,
      discount: promotion.discountPercent ?? promotion.discount ?? 0,
      season: promotion.season,
      propertyIds: promotion.propertyIds || [],
    });
  };

  const onDelete = async (promotionId) => {
    try {
      await promotionService.remove(promotionId);
      setPromotions((prev) => prev.filter((promotion) => promotion.id !== promotionId));

      if (editingId === promotionId) {
        setEditingId(null);
        setForm({ name: '', discount: 10, season: '', propertyIds: [] });
      }

      pushToast({ type: 'success', title: 'Promotion deleted', message: 'Promotion was removed.' });
    } catch (error) {
      pushToast({ type: 'error', title: 'Delete failed', message: error.response?.data?.message || error.message });
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
          { key: 'discountPercent', label: 'Discount %' },
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
