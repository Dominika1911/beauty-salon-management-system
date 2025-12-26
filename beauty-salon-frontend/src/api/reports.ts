// src/api/reports.ts
import axiosInstance from "@/api/axios";

/**
 * Typy raportów dostępne w backendzie
 * (jeśli backend doda nowe, możesz:
 *  - dopisać tutaj
 *  - albo w UI budować listę dynamicznie z reportsApi.list()
 */
export type ReportType = "revenue" | "employees" | "clients" | "today";

/**
 * ===== REVENUE REPORT =====
 */
export type RevenueGroupBy = "day" | "month";

export interface RevenueData {
  period: string;
  revenue: number;
  appointments_count: number;
}

export interface RevenueReportSummary {
  total_revenue: number;
  total_appointments: number;
  average_per_appointment: number;
}

export interface RevenueReportResponse {
  range: { from: string; to: string };
  group_by: RevenueGroupBy;
  summary: RevenueReportSummary;
  data: RevenueData[];
}

/**
 * ===== AVAILABLE REPORTS =====
 */
export interface AvailableReport {
  type: ReportType;
  description: string;
}

/**
 * ===== PARAMS (per-report) =====
 * Dopasuj do backendu: najczęściej date_from/date_to, czasem group_by.
 */
export type CommonReportParams = {
  date_from?: string; // YYYY-MM-DD
  date_to?: string;   // YYYY-MM-DD
};

export type RevenueReportParams = CommonReportParams & {
  group_by?: RevenueGroupBy;
};

// Jeśli backend ma parametry dla innych raportów — dodaj tu:
export type EmployeesReportParams = CommonReportParams;
export type ClientsReportParams = CommonReportParams;
export type TodayReportParams = {}; // zwykle bez parametrów

type ReportParamsByType = {
  revenue: RevenueReportParams;
  employees: EmployeesReportParams;
  clients: ClientsReportParams;
  today: TodayReportParams;
};

type ReportResponseByType = {
  revenue: RevenueReportResponse;
  // Jeśli backend zwraca konkretne struktury dla pozostałych raportów,
  // warto je dopisać zamiast unknown:
  employees: unknown;
  clients: unknown;
  today: unknown;
};

/**
 * ===== PDF helper =====
 * Jeśli backend zwraca Content-Disposition: attachment; filename="..."
 * to wyciągniemy filename.
 */
function tryGetFilenameFromContentDisposition(headerValue?: string): string | null {
  if (!headerValue) return null;

  // przykłady:
  // attachment; filename="report.pdf"
  // attachment; filename=report.pdf
  const match =
    /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(headerValue);

  const raw = decodeURIComponent(match?.[1] || match?.[2] || match?.[3] || "");
  return raw ? raw.trim() : null;
}

export const reportsApi = {
  /**
   * GET /api/reports/
   */
  list: async (): Promise<{ available_reports: AvailableReport[] }> => {
    const response = await axiosInstance.get<{ available_reports: AvailableReport[] }>("/reports/");
    return response.data;
  },

  /**
   * GET /api/reports/{type}/
   *
   * Overloady: TS wie co zwraca dla danego reportType.
   */
  get: async <T extends ReportType>(
    reportType: T,
    params?: ReportParamsByType[T]
  ): Promise<ReportResponseByType[T]> => {
    const response = await axiosInstance.get<ReportResponseByType[T]>(`/reports/${reportType}/`, {
      params,
    });
    return response.data;
  },

  /**
   * GET /api/reports/{type}/pdf/
   *
   * Zwracamy blob + opcjonalnie filename (jeśli backend daje w headerach).
   */
  pdf: async <T extends ReportType>(
    reportType: T,
    params?: CommonReportParams
  ): Promise<{ blob: Blob; filename: string | null }> => {
    const response = await axiosInstance.get(`/reports/${reportType}/pdf/`, {
      params,
      responseType: "blob",
    });

    const contentDisposition =
      (response.headers?.["content-disposition"] as string | undefined) ||
      (response.headers?.["Content-Disposition"] as string | undefined);

    const filename = tryGetFilenameFromContentDisposition(contentDisposition);

    return { blob: response.data as Blob, filename };
  },

  /**
   * Convenience: revenue (najczęściej używany)
   * GET /api/reports/revenue/
   */
  getRevenue: async (params?: RevenueReportParams): Promise<RevenueReportResponse> => {
    const response = await axiosInstance.get<RevenueReportResponse>("/reports/revenue/", { params });
    return response.data;
  },
};
