import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LuX } from "react-icons/lu";
import { Button } from "./Button";
import { ToastContext, type ToastApi, type ToastInput } from "./useToast";
import s from "./ui.module.css";

interface ToastItem extends ToastInput {
  id: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), toast.tone === "error" ? 7000 : 4500);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      success: (title, description) => notify({ tone: "success", title, description }),
      error: (title, description) => notify({ tone: "error", title, description }),
      info: (title, description) => notify({ tone: "info", title, description })
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={s.toastRegion} aria-live="polite" aria-relevant="additions">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.22 }}
              className={`${s.toast} ${s[`toast-${t.tone}`]}`}
              role={t.tone === "error" ? "alert" : "status"}
            >
              <div className={s.toastBody}>
                <div className={s.toastTitle}>{t.title}</div>
                {t.description && <div className={s.toastText}>{t.description}</div>}
              </div>
              <Button variant="ghost" size="sm" iconOnly aria-label="Dismiss notification" onClick={() => dismiss(t.id)} icon={<LuX />} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

