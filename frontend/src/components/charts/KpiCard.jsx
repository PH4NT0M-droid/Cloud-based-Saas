function KpiCard({ title, value, hint }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      {hint ? <p className="mt-1 text-xs text-brand-700">{hint}</p> : null}
    </div>
  );
}

export default KpiCard;
