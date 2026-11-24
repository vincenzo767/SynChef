import { describe, expect, it } from "vitest";
import { remainingSeconds } from "./useCookingSession";
import type { CookingTimer } from "@/lib/api/types";

const base: CookingTimer = { stepIndex: 0, label: "Boil", durationSeconds: 600, state: "RUNNING", endsAt: null, remainingSeconds: null };

describe("timer countdown", () => {
  it("derives remaining time from the absolute end time", () => {
    const now = Date.parse("2026-11-23T12:00:00Z");
    const timer = { ...base, endsAt: "2026-11-23T12:01:30Z" };
    expect(remainingSeconds(timer, 0, now)).toBe(90);
  });

  it("corrects for client clock skew using the server offset", () => {
    const now = Date.parse("2026-11-23T12:00:00Z");
    const timer = { ...base, endsAt: "2026-11-23T12:01:30Z" };
    // Server clock is 30 s ahead of this device.
    expect(remainingSeconds(timer, 30_000, now)).toBe(60);
  });

  it("never goes negative and respects paused/done states", () => {
    const now = Date.parse("2026-11-23T12:05:00Z");
    expect(remainingSeconds({ ...base, endsAt: "2026-11-23T12:01:30Z" }, 0, now)).toBe(0);
    expect(remainingSeconds({ ...base, state: "PAUSED", remainingSeconds: 42 }, 0, now)).toBe(42);
    expect(remainingSeconds({ ...base, state: "DONE" }, 0, now)).toBe(0);
  });
});
