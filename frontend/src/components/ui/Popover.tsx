import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./ui.module.css";

/**
 * Anchored popover (menus, notification panel). Closes on outside click, Escape and route change
 * (callers pass a key). The trigger receives aria-expanded/aria-haspopup.
 */
export function Popover({
  trigger,
  children,
  label,
  width,
  open: controlledOpen,
  onOpenChange
}: {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-haspopup": "true" }) => ReactNode;
  children: (close: () => void) => ReactNode;
  label: string;
  width?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenRef.current(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenRef.current(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {trigger({ open, toggle: () => setOpen(!open), "aria-expanded": open, "aria-haspopup": "true" })}
      {open && (
        <div className={s.popover} role="dialog" aria-label={label} style={width ? { width: `min(${width}px, calc(100vw - 24px))` } : undefined}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

