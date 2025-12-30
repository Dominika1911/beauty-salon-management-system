import axiosInstance from '@/api/axios';
import type { AvailableReport } from '@/types';

/**
 * Re-eksportujemy typ dla komponentów
 */
export type { AvailableReport };

/**
 * API dla raportów - uproszczona wersja
 * Raporty są generowane jako PDF bezpośrednio z backendu
 */
export const reportsApi = {
    /**
     * Pobiera listę dostępnych raportów zdefiniowanych na backendzie.
     */
    list: async (): Promise<{ available_reports: AvailableReport[] }> => {
        const response = await axiosInstance.get<{ available_reports: AvailableReport[] }>(
            '/reports/',
        );
        return response.data;
    },
};
