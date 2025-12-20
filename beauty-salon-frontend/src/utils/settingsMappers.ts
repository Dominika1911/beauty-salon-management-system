import type { PatchSystemSettings, SystemSettings } from "@/api/systemSettings.ts";

export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export const WEEKDAYS: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const WEEKDAY_LABEL_PL: Record<Weekday, string> = {
  Monday: "Poniedziałek",
  Tuesday: "Wtorek",
  Wednesday: "Środa",
  Thursday: "Czwartek",
  Friday: "Piątek",
  Saturday: "Sobota",
  Sunday: "Niedziela",
};

export type OpeningHoursDay = { open: string; close: string } | null;
export type OpeningHours = Record<Weekday, OpeningHoursDay>;

/**
 * Deposit policy – dopasowane do Twoich realnych kluczy z backendu/response:
 * - require_deposit
 * - default_deposit_percent
 * - free_cancellation_hours
 * - forfeit_deposit_on_cancellation
 * - no_show_deposit_forfeit_percent
 * - late_cancellation_deposit_forfeit_percent
 */
export type DepositPolicy = {
  require_deposit: boolean;
  default_deposit_percent: number;
  free_cancellation_hours: number;
  forfeit_deposit_on_cancellation: boolean;
  no_show_deposit_forfeit_percent: number;
  late_cancellation_deposit_forfeit_percent: number;
};

export const DEFAULT_DEPOSIT_POLICY: DepositPolicy = {
  require_deposit: false,
  default_deposit_percent: 0,
  free_cancellation_hours: 24,
  forfeit_deposit_on_cancellation: false,
  no_show_deposit_forfeit_percent: 100,
  late_cancellation_deposit_forfeit_percent: 50,
};

export type SettingsFormState = {
  // Salon
  salon_name: string;
  address: string;
  phone: string;
  contact_email: string;

  // Rezerwacje
  slot_minutes: string; // trzymamy jako string (input), mapujemy na number
  buffer_minutes: string;

  // Podatki
  default_vat_rate: string; // backend ma string "23.00"

  // Konserwacja
  maintenance_mode: boolean;
  maintenance_message: string;

  // JSON-y jako normalne struktury (bez textarea)
  deposit_policy: DepositPolicy;
  opening_hours: OpeningHours;
};

export type SettingsFormErrors = Partial<
  Record<
    | "salon_name"
    | "contact_email"
    | "phone"
    | "slot_minutes"
    | "buffer_minutes"
    | "default_vat_rate"
    | "maintenance_message"
    | "deposit_policy.default_deposit_percent"
    | "deposit_policy.free_cancellation_hours"
    | "deposit_policy.no_show_deposit_forfeit_percent"
    | "deposit_policy.late_cancellation_deposit_forfeit_percent"
    | "opening_hours",
    string
  >
>;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const coerceNumber = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const coerceBool = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const normalizeTime = (t: unknown, fallback: string): string => {
  if (typeof t !== "string") return fallback;
  // backend może mieć HH:MM albo HH:MM:SS — UI trzymamy HH:MM
  const trimmed = t.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 5);
  return trimmed;
};

export const coerceOpeningHours = (raw: unknown): OpeningHours => {
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw)) ? (raw as Record<string, unknown>) : {};
  const out: Partial<OpeningHours> = {};

  for (const day of WEEKDAYS) {
    const v = obj[day];

    if (v === null || v === undefined) {
      out[day] = null;
      continue;
    }

    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      const vv = v as Record<string, unknown>;
      const open = normalizeTime(vv.open, "09:00");
      const close = normalizeTime(vv.close, "17:00");
      out[day] = { open, close };
      continue;
    }

    // jeśli format się rozjechał – traktujemy jako "zamknięte"
    out[day] = null;
  }

  return out as OpeningHours;
};

export const coerceDepositPolicy = (raw: unknown): DepositPolicy => {
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw)) ? (raw as Record<string, unknown>) : {};

  return {
    require_deposit: coerceBool(obj.require_deposit, DEFAULT_DEPOSIT_POLICY.require_deposit),
    default_deposit_percent: coerceNumber(obj.default_deposit_percent, DEFAULT_DEPOSIT_POLICY.default_deposit_percent),
    free_cancellation_hours: coerceNumber(obj.free_cancellation_hours, DEFAULT_DEPOSIT_POLICY.free_cancellation_hours),
    forfeit_deposit_on_cancellation: coerceBool(
      obj.forfeit_deposit_on_cancellation,
      DEFAULT_DEPOSIT_POLICY.forfeit_deposit_on_cancellation
    ),
    no_show_deposit_forfeit_percent: coerceNumber(
      obj.no_show_deposit_forfeit_percent,
      DEFAULT_DEPOSIT_POLICY.no_show_deposit_forfeit_percent
    ),
    late_cancellation_deposit_forfeit_percent: coerceNumber(
      obj.late_cancellation_deposit_forfeit_percent,
      DEFAULT_DEPOSIT_POLICY.late_cancellation_deposit_forfeit_percent
    ),
  };
};

export const settingsToFormState = (s: SystemSettings): SettingsFormState => {
  return {
    salon_name: s.salon_name ?? "",
    address: s.address ?? "",
    phone: s.phone ?? "",
    contact_email: s.contact_email ?? "",

    slot_minutes: String(s.slot_minutes ?? 30),
    buffer_minutes: String(s.buffer_minutes ?? 15),

    default_vat_rate: s.default_vat_rate ?? "23.00",

    maintenance_mode: s.maintenance_mode ?? false,
    maintenance_message: s.maintenance_message ?? "",

    deposit_policy: coerceDepositPolicy(s.deposit_policy),
    opening_hours: coerceOpeningHours(s.opening_hours),
  };
};

/**
 * Mapowanie FormState -> payload do PATCH /api/settings/
 * (Zostawiamy JSON-y w strukturze backendowej: deposit_policy + opening_hours)
 */
export const formStateToPatchPayload = (f: SettingsFormState): PatchSystemSettings => {
  const slot_minutes = Number(f.slot_minutes);
  const buffer_minutes = Number(f.buffer_minutes);

  return {
    salon_name: f.salon_name,
    address: f.address,
    phone: f.phone,
    contact_email: f.contact_email,

    slot_minutes: Number.isFinite(slot_minutes) ? slot_minutes : 30,
    buffer_minutes: Number.isFinite(buffer_minutes) ? buffer_minutes : 15,

    default_vat_rate: f.default_vat_rate,

    maintenance_mode: f.maintenance_mode,
    maintenance_message: f.maintenance_message,

    deposit_policy: { ...f.deposit_policy },
    opening_hours: { ...f.opening_hours },
  };
};
export const validateSettingsForm = (f: SettingsFormState): SettingsFormErrors => {
  const errors: SettingsFormErrors = {};

  if (!f.salon_name.trim()) errors.salon_name = "Nazwa salonu jest wymagana.";

  if (f.contact_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email.trim())) {
    errors.contact_email = "Niepoprawny email kontaktowy.";
  }

  if (f.phone.trim() && f.phone.trim().length < 7) {
    errors.phone = "Telefon wygląda na zbyt krótki.";
  }

  const slot = Number(f.slot_minutes);
  if (!Number.isFinite(slot) || slot < 5 || slot > 240) errors.slot_minutes = "Slot: wpisz liczbę 5–240.";

  const buffer = Number(f.buffer_minutes);
  if (!Number.isFinite(buffer) || buffer < 0 || buffer > 240) errors.buffer_minutes = "Bufor: wpisz liczbę 0–240.";

  const vat = Number(f.default_vat_rate);
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) errors.default_vat_rate = "VAT: wpisz liczbę 0–100.";

  const dp = f.deposit_policy;

  const inPercent = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;

  if (!inPercent(dp.default_deposit_percent)) {
    errors["deposit_policy.default_deposit_percent"] = "Wpisz procent 0–100.";
  }
  if (!inPercent(dp.no_show_deposit_forfeit_percent)) {
    errors["deposit_policy.no_show_deposit_forfeit_percent"] = "Wpisz procent 0–100.";
  }
  if (!inPercent(dp.late_cancellation_deposit_forfeit_percent)) {
    errors["deposit_policy.late_cancellation_deposit_forfeit_percent"] = "Wpisz procent 0–100.";
  }
  if (!Number.isFinite(dp.free_cancellation_hours) || dp.free_cancellation_hours < 0 || dp.free_cancellation_hours > 720) {
    errors["deposit_policy.free_cancellation_hours"] = "Godziny: wpisz 0–720.";
  }

  // Opening hours
  for (const day of WEEKDAYS) {
    const v = f.opening_hours[day];
    if (v === null) continue;

    if (!timeRegex.test(v.open) || !timeRegex.test(v.close)) {
      errors.opening_hours = "Godziny muszą mieć format HH:MM.";
      break;
    }
    if (v.open >= v.close) {
      errors.opening_hours = "Godzina otwarcia musi być wcześniejsza niż zamknięcia.";
      break;
    }
  }

  return errors;
};

/** Stabilny “fingerprint” do porównania zmian (disable Save gdy brak zmian) */
export const fingerprintForm = (f: SettingsFormState): string => {
  const payload = formStateToPatchPayload(f);
  return JSON.stringify(payload);
};
