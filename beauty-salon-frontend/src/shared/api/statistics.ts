import { api } from "./axios";
import type { StatisticsResponse } from "@/shared/types";

export type { StatisticsResponse } from "@/shared/types";

const ENDPOINTS = {
  base: "/statistics/",
} as const;

type PercentLike = number | string | null | undefined;

const parsePercent = (value: PercentLike): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
};

export const statisticsAPI = {
  get: async (days?: number): Promise<StatisticsResponse> => {
    const res = await api.get<StatisticsResponse>(ENDPOINTS.base, {
      params: typeof days === "number" ? { days } : undefined,
    });
    const data = res.data;

    // Normalizacja typów dla UI:
    // - money: zostaje string (kontrakt API)
    // - occupancy_percent: parsujemy na number | null
    const normalized: StatisticsResponse = {
      ...data,
      employees: Array.isArray(data.employees)
        ? data.employees.map((row) => {
            return {
              ...row,
              occupancy_percent: parsePercent((row as { occupancy_percent?: PercentLike }).occupancy_percent),
            };
          })
        : [],
    };

    return normalized;
  },
};

// ✅ alias pod istniejący import w StatisticsPage:
export const getStatistics = async (days?: number): Promise<StatisticsResponse> => {
  return statisticsAPI.get(days);
};
