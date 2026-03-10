import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatRelativeTime,
} from "../date";

describe("formatDate", () => {
  it("formats a Date object in Hebrew locale", () => {
    // Use local midnight to avoid timezone shift
    const result = formatDate(new Date("2024-01-15"));
    expect(result).toContain("15");
    expect(result).toContain("2024");
    expect(result).toContain("ינואר");
  });

  it("formats a date string in Hebrew locale", () => {
    const result = formatDate("2024-06-01");
    expect(result).toContain("2024");
    expect(result).toContain("יוני");
  });
});

describe("formatDateShort", () => {
  it("formats a Date object in short format", () => {
    // Use local midnight to avoid timezone shift
    const result = formatDateShort(new Date("2024-01-15"));
    expect(result).toMatch(/\d{2}/);
    expect(result).toContain("2024");
  });

  it("formats a date string in short format", () => {
    const result = formatDateShort("2024-03-05");
    expect(result).toContain("2024");
  });
});

describe("formatDateTime", () => {
  it("formats with time component", () => {
    // Use local time to avoid timezone shift
    const result = formatDateTime(new Date("2024-01-15T14:30:00"));
    expect(result).toContain("2024");
    expect(result).toContain("14:30");
  });

  it("formats a date string with time", () => {
    const result = formatDateTime("2024-01-15T14:30:00");
    expect(result).toContain("2024");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'now' for recent date", () => {
    vi.setSystemTime(new Date("2024-06-01T12:00:30Z"));
    const result = formatRelativeTime(new Date("2024-06-01T12:00:00Z"));
    expect(result).toBe("עכשיו");
  });

  it("returns minutes for recent past", () => {
    vi.setSystemTime(new Date("2024-06-01T12:05:00Z"));
    const result = formatRelativeTime(new Date("2024-06-01T12:00:00Z"));
    expect(result).toBe("לפני 5 דקות");
  });

  it("returns hours for same-day past", () => {
    vi.setSystemTime(new Date("2024-06-01T15:00:00Z"));
    const result = formatRelativeTime(new Date("2024-06-01T12:00:00Z"));
    expect(result).toBe("לפני 3 שעות");
  });

  it("returns days for recent past", () => {
    vi.setSystemTime(new Date("2024-06-04T12:00:00Z"));
    const result = formatRelativeTime(new Date("2024-06-01T12:00:00Z"));
    expect(result).toBe("לפני 3 ימים");
  });

  it("falls back to full date for older dates", () => {
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    const result = formatRelativeTime(new Date("2024-06-01T12:00:00Z"));
    expect(result).toContain("2024");
  });

  it("accepts a string parameter", () => {
    vi.setSystemTime(new Date("2024-06-01T12:05:00Z"));
    const result = formatRelativeTime("2024-06-01T12:00:00Z");
    expect(result).toContain("דקות");
  });
});
