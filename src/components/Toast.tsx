import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: { label: string; onClick: () => void };
}

type Notify = (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;

const ToastContext = createContext<Notify>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const notify = useCallback<Notify>((message, opts = {}) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, message, tone: opts.tone ?? 'info', action: opts.action }]);
    setTimeout(() => dismiss(id), opts.action ? 8000 : 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.message}</span>
            {t.action && (
              <button className="btn btn-small" onClick={() => { t.action!.onClick(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
            <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
