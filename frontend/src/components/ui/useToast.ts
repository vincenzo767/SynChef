import { createContext, useContext } from "react";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
}

export interface ToastApi {
  notify: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
