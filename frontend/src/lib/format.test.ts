import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, formatMinutes, formatRelative, initials, titleCase } from "./format";
import { flagEmoji } from "./countries";

describe("format helpers", () => {
  it("formats clocks and durations", () => {
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("0:00");
    expect(formatDuration(600)).toBe("10 min");
    expect(formatDuration(90)).toBe("1 min 30 s");
    expect(formatDuration(10800)).toBe("3 h");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(240)).toBe("4 h");
    expect(formatMinutes(null)).toBe("—");
  });

  it("formats relative times", () => {
    const now = Date.parse("2026-11-23T12:00:00Z");
    expect(formatRelative("2026-11-23T11:59:40Z", now)).toBe("just now");
    expect(formatRelative("2026-11-23T11:30:00Z", now)).toBe("30m ago");
    expect(formatRelative("2026-11-23T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelative(null, now)).toBe("");
  });

  it("derives initials, title case and flags", () => {
    expect(initials("Ana Maria Cruz")).toBe("AC");
    expect(initials("")).toBe("SC");
    expect(titleCase("NORTH_AMERICA")).toBe("North America");
    expect(flagEmoji("ph")).toBe("🇵🇭");
    expect(flagEmoji("??")).toBe("🏳️");
  });
});
