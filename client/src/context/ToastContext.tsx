import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ToastViewport,
  type ToastItem,
  type ToastTone,
} from '../components/ui/Toast/Toast';

export interface ToastOptions {
  title?: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss duration in ms. Use `0` to keep until dismissed. */
  durationMs?: number;
}

export interface ToastApi {
  push: (options: ToastOptions) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION_MS = 5000;
let toastSeq = 0;

function nextId(): string {
  toastSeq += 1;
  return `toast-${toastSeq}-${Date.now()}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (options: ToastOptions) => {
      const id = nextId();
      const tone = options.tone ?? 'info';
      const durationMs =
        options.durationMs === undefined
          ? DEFAULT_DURATION_MS
          : options.durationMs;

      setToasts((prev) => [
        ...prev,
        {
          id,
          title:
            options.title ??
            (tone === 'error' ? 'Something went wrong' : 'Notice'),
          description: options.description,
          tone,
        },
      ]);

      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (title: string, description?: string) =>
      push({ title, description, tone: 'success' }),
    [push],
  );

  const error = useCallback(
    (title: string, description?: string) =>
      push({ title, description, tone: 'error', durationMs: 7000 }),
    [push],
  );

  const clear = useCallback(() => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ push, success, error, dismiss, clear }),
    [push, success, error, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
