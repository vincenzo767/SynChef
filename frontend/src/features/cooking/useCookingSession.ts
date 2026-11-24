import { useCallback, useEffect, useRef, useState } from "react";
import { cookingApi } from "@/lib/api/endpoints";
import { isCancelled, toApiError, type ApiError } from "@/lib/api/client";
import { useSubscription } from "@/lib/realtime";
import type { CookingSession, CookingTimer, ScaledRecipe } from "@/lib/api/types";

export interface ActivityEntry {
  id: number;
  text: string;
  at: number;
}

/** Remaining seconds for a timer, using the server clock (offset corrects local clock skew). */
export function remainingSeconds(timer: CookingTimer, clockOffsetMs: number, now = Date.now()): number {
  if (timer.state === "RUNNING" && timer.endsAt) {
    return Math.max(0, Math.ceil((new Date(timer.endsAt).getTime() - (now + clockOffsetMs)) / 1000));
  }
  if (timer.state === "PAUSED") return timer.remainingSeconds ?? 0;
  return 0;
}

/**
 * Client view of a cooking session. The server is authoritative: every command returns the new
 * state, and broadcasts from other participants are merged in. Stale messages (lower version) are
 * ignored so out-of-order delivery can never roll the UI back.
 */
export function useCookingSession(sessionId: number) {
  const [session, setSession] = useState<CookingSession | null>(null);
  const [recipe, setRecipe] = useState<ScaledRecipe | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockOffset, setClockOffset] = useState(0);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const activityId = useRef(0);
  const lastLoggedVersion = useRef(-1);

  const apply = useCallback((next: CookingSession) => {
    setClockOffset(new Date(next.serverTime).getTime() - Date.now());
    if (next.recipe) setRecipe(next.recipe);
    setSession((current) => {
      if (current && next.version < current.version) return current;
      return { ...next, recipe: undefined };
    });
    // The actor gets the same change twice (command response + broadcast): log each version once.
    if (next.lastAction && next.version > lastLoggedVersion.current) {
      lastLoggedVersion.current = next.version;
      const entry = { id: ++activityId.current, text: next.lastAction, at: Date.now() };
      setActivity((list) => [entry, ...list].slice(0, 20));
    }
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      cookingApi
        .get(sessionId, { signal })
        .then(apply)
        .catch((e: unknown) => {
          if (!isCancelled(e)) setError(toApiError(e));
        })
        .finally(() => setLoading(false));
    },
    [sessionId, apply]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useSubscription<CookingSession>(Number.isFinite(sessionId) ? `/topic/cooking-sessions/${sessionId}` : null, apply);

  /** Runs a command; on failure the authoritative state is re-fetched so the UI never drifts. */
  const run = useCallback(
    async (command: () => Promise<CookingSession>): Promise<ApiError | null> => {
      try {
        apply(await command());
        return null;
      } catch (e) {
        const err = toApiError(e);
        load();
        return err;
      }
    },
    [apply, load]
  );

  const optimisticStep = useCallback((index: number) => {
    setSession((current) => (current ? { ...current, currentStepIndex: index } : current));
  }, []);

  return { session, recipe, error, loading, clockOffset, activity, run, optimisticStep, reload: load };
}

/** Returns the current time, refreshed every 250 ms while `active` (drives timer countdowns). */
export function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return active ? now : Date.now();
}

/** Keeps the screen awake while cooking, where supported (Screen Wake Lock API). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return undefined;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = () => {
      (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request("screen")
        .then((s) => {
          if (cancelled) void s.release();
          else sentinel = s;
        })
        .catch(() => undefined);
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
}

/** Short two-tone chime via Web Audio (no asset download) plus vibration on phones. */
export function playTimerAlert() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      [0, 0.25, 0.5].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = i % 2 === 0 ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.25);
      });
      window.setTimeout(() => void ctx.close(), 1200);
    }
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Audio may be blocked until the user interacts; the visual alert still shows.
  }
}
