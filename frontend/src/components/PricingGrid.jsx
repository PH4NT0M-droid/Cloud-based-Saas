import { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/format';

function formatDateKey(date) {
  return new Date(date).toISOString().split('T')[0];
}

function PricingGrid({ roomTypes, dates, dataByRoomType = {}, onSave, loadingRoomTypeId }) {
  const [editing, setEditing] = useState(null);
  const [draftValue, setDraftValue] = useState('');

  const visibleDates = useMemo(() => dates || [], [dates]);

  const beginEdit = (roomTypeId, dateKey, currentValue) => {
    setEditing({ roomTypeId, dateKey });
    setDraftValue(String(currentValue ?? 0));
  };

  const commitEdit = async () => {
    if (!editing) {
      return;
    }

    await onSave({ roomTypeId: editing.roomTypeId, date: editing.dateKey, basePrice: Number(draftValue) });
    setEditing(null);
    setDraftValue('');
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Pricing grid</h3>
          <p className="text-sm text-slate-500">Inline edit base price; effective price updates with rules.</p>
        </div>
        <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">Smart pricing</span>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold">Room type</th>
              {visibleDates.map((date) => (
                <th key={date} className="min-w-36 border-b border-slate-200 px-4 py-3 text-center font-semibold">
                  {date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((roomType) => (
              <tr key={roomType.id} className="border-b border-slate-100">
                <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-3 font-semibold text-slate-900">
                  <div>{roomType.name}</div>
                  <div className="text-xs font-medium text-slate-500">Effective price grid</div>
                </td>
                {visibleDates.map((dateKey) => {
                  const cell = dataByRoomType?.[roomType.id]?.[dateKey] || {};
                  const isEditing = editing?.roomTypeId === roomType.id && editing?.dateKey === dateKey;

                  return (
                    <td key={dateKey} className="border-r border-slate-100 px-2 py-2 text-center">
                      {isEditing ? (
                        <input
                          autoFocus
                          type="number"
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitEdit();
                            }
                            if (event.key === 'Escape') {
                              setEditing(null);
                            }
                          }}
                          className="w-28 rounded-xl border border-accent-300 px-3 py-2 text-center text-sm font-semibold outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginEdit(roomType.id, dateKey, cell.basePrice)}
                          disabled={loadingRoomTypeId === roomType.id}
                          className="flex h-16 w-28 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 transition hover:border-accent-300 hover:bg-accent-50"
                        >
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(cell.basePrice ?? roomType.basePrice ?? 0)}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                            eff {formatCurrency(cell.effectivePrice ?? cell.basePrice ?? roomType.basePrice ?? 0)}
                          </span>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PricingGrid;