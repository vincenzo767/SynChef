import { useEffect } from "react";
import type { ThemePreference } from "@/lib/api/types";
import { useAppSelector } from "./store";

/**
 * Theme preference. Signed-in users' choice is stored on the server (synced across devices).
 * For signed-out visitors we remember only the non-sensitive "light/dark" choice locally so the
 * page doesn't flash; no personal or credential data is ever kept in browser storage.
 */
const KEY = "synchef.theme";

export function readLocalTheme(): ThemePreference {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "LIGHT" || value === "DARK" ? value : "SYSTEM";
  } catch {
    return "SYSTEM";
  }
}

export function writeLocalTheme(theme: ThemePreference) {
  try {
    if (theme === "SYSTEM") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, theme);
  } catch {
    // Storage may be unavailable (private mode); the theme still applies for this visit.
  }
}

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === "SYSTEM") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme.toLowerCase());
  const meta = document.querySelector('meta[name="theme-color"]');
  const dark = theme === "DARK" || (theme === "SYSTEM" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  meta?.setAttribute("content", dark ? "#0f1411" : "#16362a");
}

/** Keeps <html data-theme> in sync with the signed-in user's server-side preference. */
export function useThemeSync() {
  const preference = useAppSelector((s) => s.auth.user?.themePreference);
  useEffect(() => {
    const theme = preference ?? readLocalTheme();
    applyTheme(theme);
    if (preference) writeLocalTheme(preference);
  }, [preference]);
}
