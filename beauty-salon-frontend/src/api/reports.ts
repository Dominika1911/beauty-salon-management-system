import axiosInstance from "@/api/axios";
// importujemy wspólne typy z centralnego pliku, aby uniknąć duplikacji
import type { 
  ReportType, 
  RevenueGroupBy, 
  RevenueReport, 
  AvailableReport 
} from "@/types";

/**
 * Re-eksportujemy typy, aby komponenty (np. ReportsPage) 
 * nadal mogły je importować z tego pliku bez błędów.
 */
export type { ReportType, RevenueGroupBy, AvailableReport };
export type RevenueReportResponse = RevenueReport;

/**
 * ===== PARAMS (per-report) =====
 * Parametry specyficzne dla zapytań API (nie muszą być w globalnych types).
 */
export type CommonReportParams = {
  date_from?: string; // YYYY-MM-DD
  date_to?: string;   // YYYY-MM-DD
};

export type RevenueReportParams = CommonReportParams & {
  group_by?: RevenueGroupBy;
};

// Mapowanie parametrów dla poszczególnych typów raportów
type ReportParamsByType = {
  revenue: RevenueReportParams;
  employees: CommonReportParams;
  clients: CommonReportParams;
  today: Record<string, never>; // Pusty obiekt dla raportu "na dziś"
};

// Mapowanie odpowiedzi dla poszczególnych typów raportów
type ReportResponseByType = {
  revenue: RevenueReportResponse;
  employees: unknown; 
  clients: unknown;
  today: unknown;
};

/**
 * Pomocnik do wyciągania nazwy pliku z nagłówka Content-Disposition.
 */
function tryGetFilenameFromContentDisposition(headerValue?: string): string | null {
  if (!headerValue) return null;

  const match =
    /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(headerValue);

  const raw = decodeURIComponent(match?.[1] || match?.[2] || match?.[3] || "");
  return raw ? raw.trim() : null;
}

export const reportsApi = {
  /**
   * Pobiera listę dostępnych raportów zdefiniowanych na backendzie.
   */
  list: async (): Promise<{ available_reports: AvailableReport[] }> => {
    const response = await axiosInstance.get<{ available_reports: AvailableReport[] }>("/reports/");
    return response.data;
  },

  /**
   * Generyczna metoda pobierania danych raportu.
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
   * Pobiera raport w formacie PDF jako Blob.
   */
  pdf: async <T extends ReportType>(
    reportType: T,
    params?: CommonReportParams
  ): Promise<{ blob: Blob; filename: string | null }> => {
    const response = await axiosInstance.get(`/reports/${reportType}/pdf/`, {
      params,
      responseType: "blob",
    });

    // Obsługa różnych wielkości liter w nagłówkach
    const contentDisposition =
      (response.headers?.["content-disposition"] as string | undefined) ||
      (response.headers?.["Content-Disposition"] as string | undefined);

    const filename = tryGetFilenameFromContentDisposition(contentDisposition);

    return { blob: response.data as Blob, filename };
  },

  /**
   * Skrócona metoda dedykowana dla raportu przychodów.
   */
  getRevenue: async (params?: RevenueReportParams): Promise<RevenueReportResponse> => {
    const response = await axiosInstance.get<RevenueReportResponse>("/reports/revenue/", { params });
    return response.data;
  },
};