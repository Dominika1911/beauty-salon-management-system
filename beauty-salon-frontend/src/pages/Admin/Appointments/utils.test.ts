import { describe, it, expect } from "vitest";
import {
  normalizeStatus,
  canEmployeeDoService,
  isValidDate,
  toIsoString,
  toYyyyMmDd,
  friendlyAvailabilityError,
} from "./utils";
import { APPOINTMENT_STATUSES } from "@/types";

describe("Admin/Appointments/utils – normalizeStatus", () => {
  it("returns the same status when value is a valid appointment status", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(normalizeStatus(status)).toBe(status);
    }
  });

  it("returns null for null/undefined and non-string values", () => {
    expect(normalizeStatus(null)).toBeNull();
    expect(normalizeStatus(undefined)).toBeNull();
    expect(normalizeStatus(123)).toBeNull();
    expect(normalizeStatus({})).toBeNull();
    expect(normalizeStatus([])).toBeNull();
  });

  it("returns null for strings outside APPOINTMENT_STATUSES", () => {
    expect(normalizeStatus("")).toBeNull();
    expect(normalizeStatus("__NOT_A_STATUS__")).toBeNull();
  });
});

describe("Admin/Appointments/utils – canEmployeeDoService", () => {
  it("returns false when employeeSkills is undefined", () => {
    expect(canEmployeeDoService(undefined, 1)).toBe(false);
  });

  it("returns false when employeeSkills is not an array", () => {
    expect(canEmployeeDoService(null, 1)).toBe(false);
    expect(canEmployeeDoService({}, 1)).toBe(false);
  });

  it("returns false when employeeSkills is an empty array", () => {
    expect(canEmployeeDoService([], 1)).toBe(false);
  });

  it("returns true when employee has the service", () => {
    expect(canEmployeeDoService([1, 2, 3], 2)).toBe(true);
  });

  it("returns false when employee does not have the service", () => {
    expect(canEmployeeDoService([1, 2, 3], 4)).toBe(false);
  });

  it("does not coerce types (number vs string)", () => {
    expect(canEmployeeDoService([1, 2, 3], "2")).toBe(false);
  });
});

describe("Admin/Appointments/utils – isValidDate", () => {
  it("returns false for non-Date values", () => {
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate("2024-01-01")).toBe(false);
    expect(isValidDate(123)).toBe(false);
    expect(isValidDate({})).toBe(false);
  });

  it("returns false for invalid Date instances", () => {
    expect(isValidDate(new Date("invalid"))).toBe(false);
    expect(isValidDate(new Date(NaN))).toBe(false);
  });

  it("returns true for valid Date instances", () => {
    expect(isValidDate(new Date("2024-01-01T00:00:00Z"))).toBe(true);
    expect(isValidDate(new Date("2024-01-01T10:00:00Z"))).toBe(true);
  });
});

describe("Admin/Appointments/utils – toIsoString", () => {
  it("returns date.toISOString()", () => {
    const d = new Date("2024-01-02T03:04:05.000Z");
    expect(toIsoString(d)).toBe(d.toISOString());
  });
});

describe("Admin/Appointments/utils – toYyyyMmDd", () => {
  it("formats as YYYY-MM-DD using local date parts", () => {
    const d = new Date(2024, 0, 2); // Jan 2, 2024 in local time
    expect(toYyyyMmDd(d)).toBe("2024-01-02");
  });

  it("pads month and day with zeros", () => {
    const d = new Date(2024, 8, 7); // Sep 7, 2024
    expect(toYyyyMmDd(d)).toBe("2024-09-07");
  });
});

describe("Admin/Appointments/utils – friendlyAvailabilityError", () => {
  it("returns provided reason when it is non-empty after trimming", () => {
    expect(friendlyAvailabilityError("Brak wolnych terminów")).toBe("Brak wolnych terminów");
    expect(friendlyAvailabilityError("  OK  ")).toBe("  OK  ");
  });

  it("returns default message when reason is missing/empty/whitespace", () => {
    const expected =
      "Wybrany termin jest niedostępny. Wybierz inny termin lub innego pracownika.";

    expect(friendlyAvailabilityError()).toBe(expected);
    expect(friendlyAvailabilityError("")).toBe(expected);
    expect(friendlyAvailabilityError("   ")).toBe(expected);
  });
});
