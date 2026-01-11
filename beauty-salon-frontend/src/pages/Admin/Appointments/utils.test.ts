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

describe("Narzędzia Admina: normalizeStatus", () => {
  it("zwraca ten sam status, gdy wartość jest poprawnym statusem wizyty", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(normalizeStatus(status)).toBe(status);
    }
  });

  it("zwraca null dla wartości null/undefined oraz typów innych niż string", () => {
    expect(normalizeStatus(null)).toBeNull();
    expect(normalizeStatus(undefined)).toBeNull();
    expect(normalizeStatus(123)).toBeNull();
    expect(normalizeStatus({})).toBeNull();
    expect(normalizeStatus([])).toBeNull();
  });

  it("zwraca null dla tekstów spoza listy APPOINTMENT_STATUSES", () => {
    expect(normalizeStatus("")).toBeNull();
    expect(normalizeStatus("__NIE_STATUS__")).toBeNull();
  });
});

describe("Narzędzia Admina: canEmployeeDoService", () => {
  it("zwraca false, gdy umiejętności pracownika (employeeSkills) są niezdefiniowane", () => {
    expect(canEmployeeDoService(undefined, 1)).toBe(false);
  });

  it("zwraca false, gdy umiejętności pracownika nie są tablicą", () => {
    expect(canEmployeeDoService(null, 1)).toBe(false);
    expect(canEmployeeDoService({}, 1)).toBe(false);
  });

  it("zwraca false, gdy tablica umiejętności pracownika jest pusta", () => {
    expect(canEmployeeDoService([], 1)).toBe(false);
  });

  it("zwraca true, gdy pracownik posiada przypisaną usługę", () => {
    expect(canEmployeeDoService([1, 2, 3], 2)).toBe(true);
  });

  it("zwraca false, gdy pracownik nie posiada przypisanej usługi", () => {
    expect(canEmployeeDoService([1, 2, 3], 4)).toBe(false);
  });

  it("nie wymusza konwersji typów (liczba vs string)", () => {
    expect(canEmployeeDoService([1, 2, 3], "2")).toBe(false);
  });
});

describe("Narzędzia Admina: isValidDate", () => {
  it("zwraca false dla wartości niebędących obiektem Date", () => {
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate("2024-01-01")).toBe(false);
    expect(isValidDate(123)).toBe(false);
    expect(isValidDate({})).toBe(false);
  });

  it("zwraca false dla nieprawidłowych instancji Date (Invalid Date)", () => {
    expect(isValidDate(new Date("invalid"))).toBe(false);
    expect(isValidDate(new Date(NaN))).toBe(false);
  });

  it("zwraca true dla prawidłowych instancji Date", () => {
    expect(isValidDate(new Date("2024-01-01T00:00:00Z"))).toBe(true);
    expect(isValidDate(new Date("2024-01-01T10:00:00Z"))).toBe(true);
  });
});

describe("Narzędzia Admina: toIsoString", () => {
  it("zwraca datę w formacie ISO (toISOString)", () => {
    const d = new Date("2024-01-02T03:04:05.000Z");
    expect(toIsoString(d)).toBe(d.toISOString());
  });
});

describe("Narzędzia Admina: toYyyyMmDd", () => {
  it("formatuje datę jako RRRR-MM-DD używając lokalnych części daty", () => {
    const d = new Date(2024, 0, 2); // 2 stycznia 2024 czasu lokalnego
    expect(toYyyyMmDd(d)).toBe("2024-01-02");
  });

  it("uzupełnia miesiąc i dzień zerami (padding)", () => {
    const d = new Date(2024, 8, 7); // 7 września 2024
    expect(toYyyyMmDd(d)).toBe("2024-09-07");
  });
});

describe("Narzędzia Admina: friendlyAvailabilityError", () => {
  it("zwraca podany powód, jeśli nie jest pusty po usunięciu spacji", () => {
    expect(friendlyAvailabilityError("Brak wolnych terminów")).toBe("Brak wolnych terminów");
    expect(friendlyAvailabilityError("  OK  ")).toBe("  OK  ");
  });

  it("zwraca domyślny komunikat, gdy powód jest nieobecny, pusty lub zawiera tylko spacje", () => {
    const expected =
      "Wybrany termin jest niedostępny. Wybierz inny termin lub innego pracownika.";

    expect(friendlyAvailabilityError()).toBe(expected);
    expect(friendlyAvailabilityError("")).toBe(expected);
    expect(friendlyAvailabilityError("   ")).toBe(expected);
  });
});