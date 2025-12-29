import axiosInstance from "@/api/axios";
import type { Statistics } from "@/types";

export const statisticsApi = {
  /**
   * Pobiera statystyki całego salonu (tylko Admin)
   * GET /api/statistics/
   */
  get: async (): Promise<Statistics> => {
    const response = await axiosInstance.get<Statistics>("/statistics/");
    return response.data;
  },
};