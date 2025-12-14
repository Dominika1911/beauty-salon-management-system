import { api } from './axios';

export interface ReportPDF {
  id: number;
  type: string;
  title: string;
  file_path: string;
  data_od: string;
  data_do: string;
  created_at: string;
}

type DRFList<T> = { results: T[] };

export const reportsAPI = {
  list: async (params?: { type?: string; ordering?: string }): Promise<ReportPDF[]> => {
    const res = await api.get<ReportPDF[] | DRFList<ReportPDF>>('/reports/', { params });
    const payload = res.data as any;
    return Array.isArray(payload) ? payload : (payload?.results ?? []);
  },

  mediaUrl: (filePath: string) => `/media/${filePath}`,
};
