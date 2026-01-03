import axiosInstance from '@/api/axios';
import type { AvailableReport, ReportType } from '@/types';
export type { AvailableReport };
export const reportsApi = {

  list: async (): Promise<{ available_reports: AvailableReport[] }> => {
    const response = await axiosInstance.get<{ available_reports: AvailableReport[] }>('/reports/');
    return response.data;
  },

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
