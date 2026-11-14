import { describe, expect, it } from "vitest";
import {
  zonedDateInput,
  zonedDateTimeToUtc,
  zonedDayBounds,
  zonedLocalInput,
  zonedStartOfDay,
  zonedTimeInput,
} from "@/lib/timezone";

describe("zonedStartOfDay", () => {
  it("handles standard time in New York", () => {
    expect(zonedStartOfDay("2026-01-15", "America/New_York").toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });

  it("handles daylight saving time in New York", () => {
    expect(zonedStartOfDay("2026-07-15", "America/New_York").toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });

  it("handles half-hour offsets", () => {
    expect(zonedStartOfDay("2026-03-01", "Asia/Kolkata").toISOString()).toBe("2026-02-28T18:30:00.000Z");
  });

  it("handles UTC salons", () => {
    expect(zonedStartOfDay("2026-10-19", "UTC").toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });
});

describe("zonedDayBounds", () => {
  it("returns inclusive bounds covering the whole local day", () => {
    const { from, to } = zonedDayBounds("2026-01-15", "America/New_York");

    expect(from.toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-16T04:59:59.999Z");
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("produces a 23-hour day across the spring DST transition", () => {
    const { from, to } = zonedDayBounds("2026-03-08", "America/New_York");

    expect(to.getTime() - from.getTime()).toBe(23 * 60 * 60 * 1000 - 1);
  });
});

describe("zoned input helpers", () => {
  it("formats a UTC instant in the salon's local date and time", () => {
    const date = new Date("2026-01-15T03:30:00.000Z");

    expect(zonedDateInput(date, "America/New_York")).toBe("2026-01-14");
    expect(zonedTimeInput(date, "America/New_York")).toBe("22:30");
    expect(zonedLocalInput(date, "America/New_York")).toBe("2026-01-14T22:30");
  });

  it("round-trips through the salon day start", () => {
    const start = zonedStartOfDay("2026-07-15", "America/New_York");

    expect(zonedDateInput(start, "America/New_York")).toBe("2026-07-15");
    expect(zonedTimeInput(start, "America/New_York")).toBe("00:00");
  });
});

describe("zonedDateTimeToUtc", () => {
  it("converts standard time in New York", () => {
    expect(zonedDateTimeToUtc("2026-01-15T09:30", "America/New_York").toISOString()).toBe("2026-01-15T14:30:00.000Z");
  });

  it("converts daylight saving time in New York", () => {
    expect(zonedDateTimeToUtc("2026-07-15T09:30", "America/New_York").toISOString()).toBe("2026-07-15T13:30:00.000Z");
  });

  it("handles half-hour offsets", () => {
    expect(zonedDateTimeToUtc("2026-03-01T09:00", "Asia/Kolkata").toISOString()).toBe("2026-03-01T03:30:00.000Z");
  });

  it("handles UTC salons", () => {
    expect(zonedDateTimeToUtc("2026-10-19T18:45", "UTC").toISOString()).toBe("2026-10-19T18:45:00.000Z");
  });

  it("round-trips through the zoned local input", () => {
    const value = "2026-01-15T09:30";
    const roundTrip = zonedLocalInput(zonedDateTimeToUtc(value, "America/New_York"), "America/New_York");

    expect(roundTrip).toBe(value);
  });

  it("falls back to native parsing for non-local formats", () => {
    const iso = "2026-01-15T09:30:00.000Z";
    expect(zonedDateTimeToUtc(iso, "America/New_York").toISOString()).toBe(iso);
  });
});
