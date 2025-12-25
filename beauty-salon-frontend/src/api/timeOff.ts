import axiosInstance from "./axios";
import type { TimeOff, TimeOffStatus } from "../types";

export type TimeOffListParams = Partial<{
  status: TimeOffStatus;
  employee: number | string;
  date_from: string;
  date_to: string;
  search: string;
  ordering: string;
}>;

export const getTimeOffs = async (params: TimeOffListParams = {}): Promise<TimeOff[]> => {
  const response = await axiosInstance.get("/time-offs/", { params });
  return response.data.results || response.data;
};

export const createTimeOff = async (
  data: Pick<TimeOff, "date_from" | "date_to"> & Partial<Pick<TimeOff, "reason" | "employee">>
): Promise<TimeOff> => {
  const response = await axiosInstance.post<TimeOff>("/time-offs/", data);
  return response.data;
};

export const approveTimeOff = async (id: number): Promise<TimeOff> => {
  const response = await axiosInstance.post<TimeOff>(`/time-offs/${id}/approve/`);
  return response.data;
};

export const rejectTimeOff = async (id: number): Promise<TimeOff> => {
  const response = await axiosInstance.post<TimeOff>(`/time-offs/${id}/reject/`);
  return response.data;
};
