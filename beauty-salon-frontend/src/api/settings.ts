import { api } from "./axios";
import type { AxiosResponse } from "axios";
import type { SystemSettings, SystemSettingsPatchData } from "../types";

interface SettingsApi {
  get: () => Promise<AxiosResponse<SystemSettings>>;
  patch: (data: SystemSettingsPatchData) => Promise<AxiosResponse<SystemSettings>>;
}

const ENDPOINTS = {
  base: "/settings/",
} as const;

export const settingsAPI: SettingsApi = {
  get: () => api.get<SystemSettings>(ENDPOINTS.base),
  patch: (data: SystemSettingsPatchData) => api.patch<SystemSettings>(ENDPOINTS.base, data),
};
