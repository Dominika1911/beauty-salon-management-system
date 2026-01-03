import axiosInstance from '@/api/axios';
import type { AvailableReport, ReportType } from '@/types';

/**
 * Re-eksportujemy typ dla komponentów
 */
export type { AvailableReport };

/**
 * API dla raportów
 * Raporty są generowane jako PDF bezpośrednio z backendu
 */
export const reportsApi = {
  /**
   * Pobiera listę dostępnych raportów zdefiniowanych na backendzie.
   */
  list: async (): Promise<{ available_reports: AvailableReport[] }> => {
    const response = await axiosInstance.get<{ available_reports: AvailableReport[] }>('/reports/');
    return response.data;
  },

  /**
   * Pobiera raport PDF z backendu i zapisuje go lokalnie.
   * GET /api/reports/<report_type>/pdf/
   */
  downloadPdf: async (type: ReportType): Promise<void> => {
    const response = await axiosInstance.get<Blob>(`/reports/${type}/pdf/`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${type}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  },
};
