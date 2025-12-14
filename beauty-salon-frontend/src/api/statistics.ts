import { api } from "./axios";
import type { StatisticsResponse } from "../types";

export type { StatisticsResponse } from "../types";

const ENDPOINTS = {
  base: "/statistics/",
} as const;

export const statisticsAPI = {
  get: async (days?: number): Promise<StatisticsResponse> => {
    const res = await api.get<StatisticsResponse>(ENDPOINTS.base, {
      params: typeof days === "number" ? { days } : undefined,
    });
    return res.data;
  },
};

// ✅ alias pod istniejący import w StatisticsPage:
export const getStatistics = async (days?: number): Promise<StatisticsResponse> => {
  return statisticsAPI.get(days);
};
