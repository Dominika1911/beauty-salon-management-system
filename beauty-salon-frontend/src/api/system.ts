import axiosInstance from "./axios";
import type { SystemLog, SystemSettings } from "../types";

const PATHS = {
  settings: "/system-settings/",
  logs: "/audit-logs/",
};

function unwrapList<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.results)) return data.results as T[];
  return [];
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const res = await axiosInstance.get<SystemSettings>(PATHS.settings);
  return res.data;
}

export async function updateSystemSettings(
  payload: Partial<SystemSettings>
): Promise<SystemSettings> {
  const res = await axiosInstance.patch<SystemSettings>(PATHS.settings, payload);
  return res.data;
}

export async function getSystemLogs(params?: {
  action?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}): Promise<SystemLog[]> {
  const res = await axiosInstance.get(PATHS.logs, { params });
  return unwrapList<SystemLog>(res.data);
}
