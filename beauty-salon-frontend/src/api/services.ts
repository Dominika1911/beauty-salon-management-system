import axiosInstance from "./axios";
import type { Service } from "../types";

/**
 * API dla usług salonu
 * Backend:
 * - GET    /services/
 * - POST   /services/
 * - PATCH  /services/{id}/
 * - POST   /services/{id}/disable/
 * - POST   /services/{id}/enable/
 */

/**
 * Helper – obsługa paginacji DRF albo czystej listy
 */
function unwrapList<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.results)) return data.results as T[];
  return [];
}

// -----------------------------------------------------------------------------
// READ
// -----------------------------------------------------------------------------

// Wszystkie usługi (ADMIN / EMPLOYEE)
export const getServices = async (): Promise<Service[]> => {
  const response = await axiosInstance.get("/services/");
  return unwrapList<Service>(response.data);
};

// Tylko aktywne usługi (PUBLIC / CLIENT)
export const getActiveServices = async (): Promise<Service[]> => {
  const response = await axiosInstance.get("/services/", {
    params: { is_active: true },
  });
  return unwrapList<Service>(response.data);
};

// Jedna usługa
export const getService = async (id: number): Promise<Service> => {
  const response = await axiosInstance.get<Service>(`/services/${id}/`);
  return response.data;
};

// -----------------------------------------------------------------------------
// CREATE / UPDATE
// -----------------------------------------------------------------------------

// Utwórz usługę
export const createService = async (
  data: Partial<Service>
): Promise<Service> => {
  const response = await axiosInstance.post<Service>("/services/", data);
  return response.data;
};

// Aktualizuj usługę
export const updateService = async (
  id: number,
  data: Partial<Service>
): Promise<Service> => {
  const response = await axiosInstance.patch<Service>(
    `/services/${id}/`,
    data
  );
  return response.data;
};

// -----------------------------------------------------------------------------
// BUSINESS ACTIONS (zamiast DELETE)
// -----------------------------------------------------------------------------

// Wyłącz usługę
export const disableService = async (id: number): Promise<void> => {
  await axiosInstance.post(`/services/${id}/disable/`);
};

// Włącz usługę
export const enableService = async (id: number): Promise<void> => {
  await axiosInstance.post(`/services/${id}/enable/`);
};
