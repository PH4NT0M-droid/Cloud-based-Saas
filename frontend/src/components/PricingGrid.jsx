import { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/format';

function PricingGrid({ roomTypes, dates, dataByRoomPlan = {}, onSave, loadingRowKey, actionButton = null }) {
  const [editing, setEditing] = useState(null);
  const [draftValue, setDraftValue] = useState('');

  const visibleDates = useMemo(() => dates || [], [dates]);

  const beginEdit = (roomTypeId, ratePlanId, dateKey, currentValue) => {
    setEditing({ roomTypeId, ratePlanId, dateKey });
    setDraftValue(String(currentValue ?? 0));
  };

  const commitEdit = async () => {
    if (!editing) {
      return;
    }

    await onSave({
      roomTypeId: editing.roomTypeId,
      ratePlanId: editing.ratePlanId,
      date: editing.dateKey,
      price: Number(draftValue),
    });

    setEditing(null);
    setDraftValue('');
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Pricing grid</h3>
          <p className="text-sm text-slate-500">Date-wise pricing per room and meal plan.</p>
        </div>
        <div className="flex items-center gap-2">
          {actionButton?.label && actionButton?.onClick ? (
            <button
              type="button"
              onClick={actionButton.onClick}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {actionButton.label}
            </button>
          ) : null}
          <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">Room + plan rows</span>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold">Room type</th>
              {visibleDates.map((dateKey) => (
                <th key={dateKey} className="min-w-28 border-b border-slate-200 px-4 py-3 text-center font-semibold">
                  {dateKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomTypes.flatMap((roomType) =>
              (roomType.ratePlans || []).map((ratePlan) => {
                const rowKey = `${roomType.id}:${ratePlan.id}`;

                return (
                  <tr key={rowKey} className="border-b border-slate-100">
                    <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-3 font-semibold text-slate-900">
                      <div>{roomType.name} - {String(ratePlan.mealPlanName || '').toUpperCase()}</div>
                      <div className="text-xs font-medium text-slate-500">{ratePlan.isDefault ? 'Default plan' : 'Meal plan'}</div>
                    </td>
                    {visibleDates.map((dateKey) => {
                      const isEditing =
                        editing?.roomTypeId === roomType.id &&
                        editing?.ratePlanId === ratePlan.id &&
                        editing?.dateKey === dateKey;

                      const currentValue = dataByRoomPlan?.[rowKey]?.[dateKey] ?? 0;

                      return (
                        <td key={`${rowKey}:${dateKey}`} className="border-r border-slate-100 px-2 py-2 text-center">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              step="0.01"
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
                                  setDraftValue('');
                                }
                              }}
                              className="w-28 rounded-xl border border-accent-300 px-3 py-2 text-center text-sm font-semibold outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEdit(roomType.id, ratePlan.id, dateKey, currentValue)}
                              disabled={loadingRowKey === rowKey}
                              className="flex h-12 w-28 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 transition hover:border-accent-300 hover:bg-accent-50"
                            >
                              <span className="text-sm font-bold text-slate-900">{formatCurrency(currentValue)}</span>
                              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">price</span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PricingGrid;
