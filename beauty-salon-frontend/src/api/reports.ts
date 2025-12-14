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

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function buildAbsoluteUrl(filePath: string): string {
  const trimmed = filePath.trim();
  if (!trimmed) return "";

  // Jeśli backend zwraca już pełny URL – zostawiamy
  if (isAbsoluteHttpUrl(trimmed)) return trimmed;

  // Jeśli to ścieżka bez "/" na początku – dodajemy "/"
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  // Robimy URL absolutny względem origin, żeby uniknąć problemów z routerem (np. /reports/...)
  try {
    return new URL(normalizedPath, window.location.origin).toString();
  } catch {
    return normalizedPath;
  }
}

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

  // Backend zwraca file_path – w UI robimy link. Normalizujemy do URL absolutnego.
  mediaUrl: (filePath: string): string => buildAbsoluteUrl(filePath),
};
