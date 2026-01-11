import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatPrice,
  formatDateTimePL,
  isPastAppointment,
  statusColor,
  statusLabel,
} from "./appointmentUtils";

const normalizeNbsp = (s: string) => s.replace(/\u00A0/g, " ");

describe("utils/appointmentUtils – formatPrice", () => {
  it("formats PLN currency for numbers (ignoring NBSP differences)", () => {
    expect(normalizeNbsp(formatPrice(0))).toBe("0,00 zł");
    expect(normalizeNbsp(formatPrice(10))).toBe("10,00 zł");
    expect(normalizeNbsp(formatPrice(10.5))).toBe("10,50 zł");
  });

  it("accepts numeric strings", () => {
    expect(normalizeNbsp(formatPrice("10"))).toBe("10,00 zł");
    expect(normalizeNbsp(formatPrice("10.5"))).toBe("10,50 zł");
  });

  it("returns '—' for undefined, null and NaN", () => {
    expect(formatPrice(undefined)).toBe("—");
    expect(formatPrice(null as unknown as number)).toBe("—");
    expect(formatPrice(NaN)).toBe("—");
    expect(formatPrice("abc")).toBe("—");
  });
});

describe("utils/appointmentUtils – formatDateTimePL", () => {
  it("formats Date using pl-PL locale (contract = toLocaleString short/short)", () => {
    // UTC -> brak różnic timezone
    const d = new Date(Date.UTC(2024, 0, 2, 10, 30, 0));

    const expected = d.toLocaleString("pl-PL", {
      dateStyle: "short",
      timeStyle: "short",
    });

    expect(formatDateTimePL(d)).toBe(expected);
  });

  it("accepts ISO string (timezone-stable)", () => {
    const iso = "2024-01-02T10:30:00Z";

    const expected = new Date(iso).toLocaleString("pl-PL", {
      dateStyle: "short",
      timeStyle: "short",
    });

    expect(formatDateTimePL(iso)).toBe(expected);
  });

  it("returns '—' for falsy input and invalid dates", () => {
    expect(formatDateTimePL("" as unknown as string)).toBe("—");
    expect(formatDateTimePL(null as unknown as string)).toBe("—");
    expect(formatDateTimePL(undefined as unknown as string)).toBe("—");
    expect(formatDateTimePL("invalid-date")).toBe("—");
    expect(formatDateTimePL(new Date("invalid"))).toBe("—");
  });
});

describe("utils/appointmentUtils – isPastAppointment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for dates in the past", () => {
    expect(isPastAppointment("2024-01-01T10:00:00Z")).toBe(true);
    expect(isPastAppointment(new Date("2024-01-09T23:59:59Z"))).toBe(true);
  });

  it("returns false for dates in the future", () => {
    expect(isPastAppointment("2024-01-11T10:00:00Z")).toBe(false);
    expect(isPastAppointment(new Date("2024-02-01T00:00:00Z"))).toBe(false);
  });

  it("returns false for falsy input and invalid dates", () => {
    expect(isPastAppointment("" as unknown as string)).toBe(false);
    expect(isPastAppointment(null as unknown as string)).toBe(false);
    expect(isPastAppointment(undefined as unknown as string)).toBe(false);
    expect(isPastAppointment("invalid-date")).toBe(false);
    expect(isPastAppointment(new Date("invalid"))).toBe(false);
  });
});

describe("utils/appointmentUtils – statusColor/statusLabel", () => {
  it("statusColor(): mapuje statusy na kolory (logika biznesowa)", () => {
    expect(statusColor("CONFIRMED" as any)).toBe("success");
    expect(statusColor("COMPLETED" as any)).toBe("success");
    expect(statusColor("PENDING" as any)).toBe("warning");
    expect(statusColor("CANCELLED" as any)).toBe("error");
    expect(statusColor("NO_SHOW" as any)).toBe("error");
    expect(statusColor("SOMETHING_NEW" as any)).toBe("default");
  });

  it("statusLabel(): mapuje status na etykietę i zwraca wejście dla nieznanego", () => {
    expect(statusLabel("PENDING")).toBe("Oczekuje");
    expect(statusLabel("CONFIRMED")).toBe("Potwierdzona");
    expect(statusLabel("COMPLETED")).toBe("Zakończona");
    expect(statusLabel("CANCELLED")).toBe("Anulowana");
    expect(statusLabel("NO_SHOW")).toBe("No-show");
    expect(statusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
