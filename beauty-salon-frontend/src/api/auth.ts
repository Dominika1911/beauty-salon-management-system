import axiosInstance, { getCsrfToken } from './axios';
export { getCsrfToken } from './axios';
import type { LoginRequest, LoginResponse, AuthStatusResponse } from '../types';

// Logowanie użytkownika
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  // Najpierw pobierz CSRF token
  await getCsrfToken();
  
  const response = await axiosInstance.post<LoginResponse>('/auth/login/', credentials);
  return response.data;
};

// Wylogowanie użytkownika
export const logout = async (): Promise<void> => {
  await axiosInstance.post('/auth/logout/');
};

// Sprawdzenie statusu autoryzacji
export const checkAuthStatus = async (): Promise<AuthStatusResponse> => {
  const response = await axiosInstance.get<AuthStatusResponse>('/auth/status/');
  return response.data;
};
