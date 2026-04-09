import { useState } from 'react';
import DataTable from '../components/DataTable';
import TextInput from '../components/forms/TextInput';

function PromotionsPage() {
  const [promotions, setPromotions] = useState([]);
  const [form, setForm] = useState({ name: '', discount: 10, season: '' });

  const onSubmit = (e) => {
    e.preventDefault();
    setPromotions((prev) => [...prev, { ...form, id: crypto.randomUUID() }]);
    setForm({ name: '', discount: 10, season: '' });
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-extrabold">Promotions</h2>

      <form onSubmit={onSubmit} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4">
        <TextInput label="Rule Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        <TextInput label="Discount %" type="number" value={form.discount} onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))} required />
        <TextInput label="Season" value={form.season} onChange={(e) => setForm((p) => ({ ...p, season: e.target.value }))} required />
        <button className="rounded-md bg-brand-700 px-4 py-2 font-semibold text-white">Create Promotion</button>
      </form>

      <DataTable
        columns={[
          { key: 'name', label: 'Promotion' },
          { key: 'discount', label: 'Discount %' },
          { key: 'season', label: 'Season' },
        ]}
        rows={promotions}
      />
    </div>
  );
}

export default PromotionsPage;
