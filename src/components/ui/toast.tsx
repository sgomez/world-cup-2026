"use client";

import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => {
        const next = [...prev, { id, message, type, duration }];
        if (next.length > 2) {
          return next.slice(next.length - 2); // Keep only the latest 2 toasts
        }
        return next;
      });
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const typeStyles = {
    success: "border-success bg-canvas text-success",
    error: "border-sale bg-canvas text-sale",
    info: "border-info bg-canvas text-info",
  };

  const icons = {
    success: <CheckCircle className="h-5 w-5 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 shrink-0" />,
    info: <Info className="h-5 w-5 shrink-0" />,
  };

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-4 border px-4 py-3 shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${typeStyles[toast.type]} min-w-[280px] max-w-sm`}
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        {icons[toast.type]}
        <span className="text-caption-md font-medium">{toast.message}</span>
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity p-0.5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
