import axiosInstance from "@/api/axios";

export type StatisticsParams = {
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
};

export const statisticsApi = {
  /**
   * Tylko ADMIN
   * GET /api/statistics/
   */
  get: async (params?: StatisticsParams): Promise<{
    range: {
      from: string;
      to: string;
    };
    appointments: {
      total_all_time: number;
      count_in_range: number;
      by_status: Array<{
        status: string;
        count: number;
      }>;
      revenue_completed_in_range: number;
    };
    top_services_in_range: Array<{
      service__id: number;
      service__name: string;
      count: number;
    }>;
    top_employees_in_range: Array<{
      employee__id: number;
      employee__employee_number: string;
      count: number;
    }>;
  }> => {
    const response = await axiosInstance.get<{
      range: {
        from: string;
        to: string;
      };
      appointments: {
        total_all_time: number;
        count_in_range: number;
        by_status: Array<{
          status: string;
          count: number;
        }>;
        revenue_completed_in_range: number;
      };
      top_services_in_range: Array<{
        service__id: number;
        service__name: string;
        count: number;
      }>;
      top_employees_in_range: Array<{
        employee__id: number;
        employee__employee_number: string;
        count: number;
      }>;
    }>("/statistics/", { params });

    return response.data;
  },
};
