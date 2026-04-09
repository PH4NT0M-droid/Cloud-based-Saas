import { useMemo, useState } from 'react';

function SearchSelect({ label, placeholder = 'Search...', options = [], value, onChange, emptyLabel = 'No matches found' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);

  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  return (
    <div className="relative space-y-1">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-brand-300"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>{selected?.label || placeholder}</span>
        <span className="text-xs uppercase tracking-[0.24em] text-slate-400">{open ? 'close' : 'select'}</span>
      </button>

      {open ? (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
          <div className="max-h-60 overflow-auto space-y-1">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">{emptyLabel}</p>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-brand-50 ${
                    option.value === value ? 'bg-brand-50 text-brand-800' : 'text-slate-700'
                  }`}
                >
                  <span>{option.label}</span>
                  {option.meta ? <span className="text-xs text-slate-400">{option.meta}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SearchSelect;