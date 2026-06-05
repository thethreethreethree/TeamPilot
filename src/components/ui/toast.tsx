"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";

/**
 * Toast notification system.
 *
 * - Provider mounted once at the dashboard layout root.
 * - `useToast()` hook returns `toast.{success, error, info, warn}` and a
 *   raw `toast(opts)`.
 * - Default duration 4000ms; pass `duration: 0` for sticky toasts.
 * - Stacked top-right with a polite aria-live region so screen-readers
 *   announce updates without stealing focus.
 *
 * Replaces ad-hoc `alert()` calls and silent "Saved!" buttons that we'd been
 * adding piecemeal. Honest middle path: toast says what happened, doesn't
 * pretend anything that didn't.
 */

type ToastKind = "success" | "error" | "warn" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  kind?: ToastKind;
  /** 0 = sticky. Defaults to 4000ms. */
  duration?: number;
}

interface ActiveToast extends Required<Omit<ToastOptions, "duration">> {
  id: number;
  duration: number;
}

interface ToastApi {
  (opts: ToastOptions): void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warn: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      const t: ActiveToast = {
        id,
        title: opts.title,
        description: opts.description ?? "",
        kind: opts.kind ?? "info",
        duration: opts.duration ?? 4000,
      };
      setToasts((ts) => [...ts, t]);
      if (t.duration > 0) {
        window.setTimeout(() => dismiss(id), t.duration);
      }
    },
    [dismiss]
  );

  const api: ToastApi = Object.assign(
    (opts: ToastOptions) => push(opts),
    {
      success: (title: string, description?: string) =>
        push({ title, description, kind: "success" }),
      error: (title: string, description?: string) =>
        push({ title, description, kind: "error", duration: 6000 }),
      warn: (title: string, description?: string) =>
        push({ title, description, kind: "warn", duration: 5000 }),
      info: (title: string, description?: string) =>
        push({ title, description, kind: "info" }),
      dismiss,
    }
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast must be used inside <ToastProvider>. Mount it once at the layout root."
    );
  }
  return ctx;
}

// ─── viewport ───────────────────────────────────────────────────

const ICON_MAP = {
  success: CheckCircle2,
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
};

// Contrast-aware styling: `text-primary` resolves correctly in both modes
// (white-ish on dark, navy on light). The colored tint + 2x-stronger
// border keep the kind-recognition affordance while ensuring the box
// edge and text are legible regardless of theme. Caught by the §1.7
// audit user-side: the original pale palette text colors (the X-hundred
// tints) were the same shape of bug as the pale gold one (designed for
// dark navy, invisible on cream).
const STYLE_MAP = {
  success: "bg-emerald-500/15 border-emerald-500/60 text-primary",
  error: "bg-red-500/15 border-red-500/60 text-primary",
  warn: "bg-yellow-500/15 border-yellow-500/60 text-primary",
  info: "bg-blue-500/15 border-blue-500/60 text-primary",
};

const ICON_COLOR_MAP = {
  success: "text-emerald-300",
  error: "text-red-300",
  warn: "text-yellow-300",
  info: "text-blue-300",
};

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: ActiveToast[];
  dismiss: (id: number) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((t) => {
        const Icon = ICON_MAP[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto rounded-xl border backdrop-blur-sm shadow-lg p-3 flex items-start gap-2.5 ${STYLE_MAP[t.kind]}`}
          >
            <Icon
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ICON_COLOR_MAP[t.kind]}`}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && (
                <p className="text-xs mt-0.5 opacity-80 break-words">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-current opacity-60 hover:opacity-100 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Hush warnings for unused effects in stricter setups.
void useEffect;
