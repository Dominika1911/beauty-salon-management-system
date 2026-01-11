import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  formatPrice,
  formatDateTimePL,
  isPastAppointment,
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
  it("formats Date using pl-PL locale (robust for leading-zero differences)", () => {
    const d = new Date("2024-01-02T10:30:00");
    const result = formatDateTimePL(d);

    // Kontrakt: toLocaleString('pl-PL', { dateStyle:'short', timeStyle:'short' })
    // W zależności od środowiska dzień może być "2.01..." albo "02.01..."
    expect(result).toMatch(/(^|[^\d])0?2\.01\.2024/);
    expect(result).toContain("10:30");
  });

  it("accepts ISO string", () => {
    const result = formatDateTimePL("2024-01-02T10:30:00");
    expect(result).toMatch(/(^|[^\d])0?2\.01\.2024/);
    expect(result).toContain("10:30");
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
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T12:00:00Z"));
  });

  afterAll(() => {
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
