import { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const api = useMemo(
    () => ({
      pushToast: ({ type = 'info', title, message }) => {
        const id = crypto.randomUUID();
        const toast = { id, type, title, message };
        setToasts((current) => [...current, toast]);
        window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3500);
      },
      clearToast: (id) => setToasts((current) => current.filter((item) => item.id !== id)),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-80 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${
              toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : toast.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{toast.title}</p>
                <p className="mt-1 text-sm opacity-90">{toast.message}</p>
              </div>
              <button onClick={() => api.clearToast(toast.id)} className="text-xs font-semibold uppercase tracking-wide opacity-60">
                close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}