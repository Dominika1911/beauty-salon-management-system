import { describe, it, expect } from "vitest";
import { isHHMM, hhmmToMinutes, sanitizePeriods, hasOverlaps } from "./time";

describe("utils/time – isHHMM", () => {
  it("returns false for values that are not valid HH:MM when coerced to string", () => {
    expect(isHHMM(null)).toBe(false);
    expect(isHHMM(undefined)).toBe(false);
    expect(isHHMM(123)).toBe(false);
    expect(isHHMM({})).toBe(false);
  });

  it("returns false for invalid time strings", () => {
    expect(isHHMM("")).toBe(false);
    expect(isHHMM("9:00")).toBe(false);
    expect(isHHMM("99:99")).toBe(false);
    expect(isHHMM("24:00")).toBe(false);
    expect(isHHMM("12:60")).toBe(false);
    expect(isHHMM("ab:cd")).toBe(false);
  });

  it("returns true for valid HH:MM format", () => {
    expect(isHHMM("00:00")).toBe(true);
    expect(isHHMM("09:15")).toBe(true);
    expect(isHHMM("23:59")).toBe(true);
  });

  it("trims whitespace before validating", () => {
    expect(isHHMM(" 09:15 ")).toBe(true);
    expect(isHHMM(" 9:00 ")).toBe(false);
  });
});

describe("utils/time – hhmmToMinutes", () => {
  it("converts valid HH:MM to minutes", () => {
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("01:00")).toBe(60);
    expect(hhmmToMinutes("10:30")).toBe(630);
    expect(hhmmToMinutes("23:59")).toBe(1439);
  });

  it("ignores any extra parts after minutes (e.g. seconds)", () => {
    expect(hhmmToMinutes("09:00:00")).toBe(540);
    expect(hhmmToMinutes("23:59:59")).toBe(1439);
  });
});

describe("utils/time – sanitizePeriods", () => {
  it("returns empty array for null/undefined/non-array input", () => {
    expect(sanitizePeriods(null)).toEqual([]);
    expect(sanitizePeriods(undefined)).toEqual([]);
    expect(sanitizePeriods({})).toEqual([]);
    expect(sanitizePeriods("foo")).toEqual([]);
  });

  it("filters out items with invalid shape or missing start/end strings", () => {
    const input = [
      null,
      {},
      { start: "09:00" },
      { end: "10:00" },
      { start: 900, end: "10:00" },
      { start: "09:00", end: 1000 },
      { start: "09:00", end: "10:00" },
    ];

    expect(sanitizePeriods(input)).toEqual([{ start: "09:00", end: "10:00" }]);
  });

  it("normalizes H:MM and HH:MM:SS to HH:MM and drops invalid times", () => {
    const input = [
      { start: " 9:00 ", end: "10:00" },
      { start: "09:00:00", end: "10:00:59" },
      { start: "09:00", end: "10:60" },
      { start: "24:00", end: "10:00" },
      { start: "ab:cd", end: "10:00" },
    ];

    expect(sanitizePeriods(input)).toEqual([
      { start: "09:00", end: "10:00" },
      { start: "09:00", end: "10:00" },
    ]);
  });

  it("keeps multiple valid periods in order (as provided)", () => {
    const input = [
      { start: "08:00", end: "09:00" },
      { start: "09:00", end: "10:00" },
    ];

    expect(sanitizePeriods(input)).toEqual(input);
  });
});

describe("utils/time – hasOverlaps", () => {
  it("returns false for empty or single-element array", () => {
    expect(hasOverlaps([])).toBe(false);
    expect(hasOverlaps([{ start: "09:00", end: "10:00" }])).toBe(false);
  });

  it("returns false when periods do not overlap", () => {
    const periods = [
      { start: "08:00", end: "09:00" },
      { start: "09:00", end: "10:00" },
      { start: "10:30", end: "11:00" },
    ];

    expect(hasOverlaps(periods)).toBe(false);
  });

  it("returns true when periods overlap", () => {
    const periods = [
      { start: "09:00", end: "10:00" },
      { start: "09:30", end: "10:30" },
    ];

    expect(hasOverlaps(periods)).toBe(true);
  });

  it("detects overlap when one period fully contains another", () => {
    const periods = [
      { start: "09:00", end: "11:00" },
      { start: "10:00", end: "10:30" },
    ];

    expect(hasOverlaps(periods)).toBe(true);
  });
});
