import { api } from "./axios";
import type { PaginatedResponse, ReportPDF } from "../types";

export type { ReportPDF } from "../types";

function isPaginated<T>(x: unknown): x is PaginatedResponse<T> {
  return typeof x === "object" && x !== null && "results" in x;
}

interface ReportListParams {
  type?: string;
  created_at?: string;
  generated_by?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
}

const ENDPOINTS = {
  base: "/reports/",
  detail: (id: number) => `/reports/${id}/`,
} as const;

export const reportsAPI = {
  list: async (params?: ReportListParams): Promise<ReportPDF[]> => {
    const res = await api.get<PaginatedResponse<ReportPDF> | ReportPDF[]>(ENDPOINTS.base, { params });
    const data = res.data;
    return isPaginated<ReportPDF>(data) ? data.results : data;
  },

  detail: async (id: number): Promise<ReportPDF> => {
    const res = await api.get<ReportPDF>(ENDPOINTS.detail(id));
    return res.data;
  },

  // Backend zwraca file_path – w UI chcesz zrobić href.
  // Najbezpieczniej: zwróć to co backend daje (może być już pełnym URL-em).
  mediaUrl: (filePath: string): string => filePath,
};
