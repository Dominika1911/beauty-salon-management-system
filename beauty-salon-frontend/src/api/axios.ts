// src/api/axios.ts

import axios, { type AxiosInstance, type AxiosError, type AxiosResponse } from 'axios';
import type { InternalAxiosRequestConfig, AxiosRequestHeaders } from 'axios';

// DODANO TYP DLA ZMIENNEJ
const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// DODANO TYP DLA EKSPORTOWANEJ ZMIENNEJ
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper do czytania cookies
function getCookie(name: string): string | null {
  const value: string = `; ${document.cookie}`;
  const parts: string[] = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

// Interceptor żądań: Dodaje CSRF token
api.interceptors.request.use((config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  const csrfToken: string | null = getCookie('csrftoken');

  config.headers = config.headers || {} as AxiosRequestHeaders;

  if (csrfToken) {
    (config.headers as AxiosRequestHeaders)['X-CSRFToken'] = csrfToken;
  }
  return config;
});

// Interceptor obsługi błędów
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  (error: AxiosError<unknown>): Promise<AxiosResponse> => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized - redirect logic triggered');
    }
    return Promise.reject(error);
  }
);

export default api;