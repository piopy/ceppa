import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';

// --- Dialog imperativi: confirmDialog() / promptDialog() ---
// Evitano window.confirm/prompt nativi. Richiedono <ConfirmHost/> montato in App.
let _request = null;

export function confirmDialog({ title = 'Confermi?', message = '', confirmLabel = 'Conferma', danger = false } = {}) {
  return new Promise((resolve) => { _request = { type: 'confirm', title, message, confirmLabel, danger, resolve }; window.dispatchEvent(new Event('ceppa-dialog')); });
}

export function promptDialog({ title = '', message = '', initial = '', placeholder = '' } = {}) {
  return new Promise((resolve) => { _request = { type: 'prompt', title, message, initial, placeholder, resolve }; window.dispatchEvent(new Event('ceppa-dialog')); });
}

export function ConfirmHost() {
  const [req, setReq] = useState(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    const onReq = () => { setReq(_request); setValue(_request?.initial ?? ''); };
    window.addEventListener('ceppa-dialog', onReq);
    return () => window.removeEventListener('ceppa-dialog', onReq);
  }, []);

  if (!req) return null;
  const close = (result) => { _request = null; setReq(null); req.resolve(result); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => close(req.type === 'prompt' ? null : false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={req.title}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') close(req.type === 'prompt' ? null : false); }}
      >
        <h3 className="text-lg font-semibold">{req.title}</h3>
        {req.message && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{req.message}</p>}
        {req.type === 'prompt' && (
          <input
            autoFocus
            type="text"
            value={value}
            placeholder={req.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') close(value.trim() || null); }}
            className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
          />
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => close(req.type === 'prompt' ? null : false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Annulla
          </button>
          <button
            onClick={() => close(req.type === 'prompt' ? (value.trim() || null) : true)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium text-white',
              req.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-indigo-700'
            )}
          >
            {req.type === 'prompt' ? 'Salva' : req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Skeleton: placeholder caricamento ---
export function Skeleton({ className }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <Skeleton className="mt-4 h-2 w-full" />
    </div>
  );
}

// --- Empty: stato vuoto ---
export function Empty({ icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
      {icon && <div className="mb-3 text-gray-400">{icon}</div>}
      <p className="font-medium text-gray-700 dark:text-gray-300">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
