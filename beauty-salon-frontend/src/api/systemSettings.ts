import { api } from "./axios.ts";

export interface SystemSettings {
  id: number;
  salon_name: string;
  address: string;
  phone: string;
  contact_email: string;
  slot_minutes: number;
  buffer_minutes: number;
  deposit_policy: Record<string, unknown>;
  opening_hours: Record<string, unknown>;
  default_vat_rate: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  last_modified_by: number | null;
  last_modified_by_email?: string | null;
  created_at: string;
  updated_at: string;
}


export type PatchSystemSettings = Partial<
  Pick<
    SystemSettings,
    | "salon_name"
    | "address"
    | "phone"
    | "contact_email"
    | "slot_minutes"
    | "buffer_minutes"
    | "default_vat_rate"
    | "maintenance_mode"
    | "maintenance_message"
    | "deposit_policy"
    | "opening_hours"
  >
>;

export async function getSystemSettings(): Promise<SystemSettings> {
  const res = await api.get<SystemSettings>("/settings/");
  return res.data;
}

export async function patchSystemSettings(payload: PatchSystemSettings): Promise<SystemSettings> {
  const res = await api.patch<SystemSettings>("/settings/", payload);
  return res.data;
}
