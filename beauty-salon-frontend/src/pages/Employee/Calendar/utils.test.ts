import { describe, it, expect } from "vitest";
import { formatPL, statusChipColor, statusLabel } from "./utils";

type StatusInput = Parameters<typeof statusChipColor>[0];

describe("pages/Employee/Calendar/utils – statusChipColor", () => {
  it("maps known statuses to MUI chip colors", () => {
    expect(statusChipColor("CONFIRMED")).toBe("primary");
    expect(statusChipColor("PENDING")).toBe("warning");
    expect(statusChipColor("COMPLETED")).toBe("success");
    expect(statusChipColor("CANCELLED")).toBe("error");
    expect(statusChipColor("NO_SHOW")).toBe("error");
  });

  it("returns default for unknown status (defensive)", () => {
    // nie używamy `any`; symulujemy nieznaną wartość jako wejście typu funkcji
    expect(statusChipColor("__UNKNOWN__" as StatusInput)).toBe("default");
  });
});

describe("pages/Employee/Calendar/utils – formatPL", () => {
  it("returns original input for invalid date strings", () => {
    expect(formatPL("invalid-date")).toBe("invalid-date");
  });

  it("formats valid date strings in pl-PL locale (non-empty, contains year and time)", () => {
    const result = formatPL("2024-01-02T10:30:00");
    expect(result).not.toBe("2024-01-02T10:30:00");
    expect(result).toContain("2024");
    expect(result).toContain("10:30");
  });
});

describe("pages/Employee/Calendar/utils – statusLabel", () => {
  it("maps known statuses to Polish labels", () => {
    expect(statusLabel("PENDING")).toBe("Oczekuje");
    expect(statusLabel("CONFIRMED")).toBe("Potwierdzona");
    expect(statusLabel("COMPLETED")).toBe("Zakończona");
    expect(statusLabel("CANCELLED")).toBe("Anulowana");
    expect(statusLabel("NO_SHOW")).toBe("No-show");
  });

  it("returns raw status for unknown values (defensive)", () => {
    expect(statusLabel("__UNKNOWN__" as StatusInput)).toBe("__UNKNOWN__");
  });
});
