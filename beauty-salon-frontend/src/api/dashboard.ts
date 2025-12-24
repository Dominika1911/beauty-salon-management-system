import axiosInstance from "./axios";
import type { DashboardResponse } from "../types";

/**
 * Dashboard zależny od roli:
 * - ADMIN / EMPLOYEE / CLIENT
 * Backend: GET /dashboard/
 */
export const getDashboard = async (): Promise<DashboardResponse> => {
  const res = await axiosInstance.get<DashboardResponse>("/dashboard/");
  return res.data;
};
