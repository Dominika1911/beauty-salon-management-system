import axiosInstance from "@/api/axios";
import type { AuthStatusResponse, LoginResponse } from "@/types";

export const authApi = {
  /**
   * GET /api/auth/csrf/
   * Ustawia cookie csrftoken
   */
  getCsrf: async (): Promise<{ detail: string }> => {
    const response = await axiosInstance.get<{ detail: string }>("/auth/csrf/");
    return response.data;
  },

  /**
   * POST /api/auth/login/
   */
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>("/auth/login/", { username, password });
    return response.data;
  },

  /**
   * POST /api/auth/logout/
   */
  logout: async (): Promise<{ detail: string }> => {
    const response = await axiosInstance.post<{ detail: string }>("/auth/logout/");
    return response.data;
  },

  /**
   * GET /api/auth/status/
   */
  getStatus: async (): Promise<AuthStatusResponse> => {
    const response = await axiosInstance.get<AuthStatusResponse>("/auth/status/");
    return response.data;
  },
};
