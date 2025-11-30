import axios, { type AxiosInstance, type AxiosError, type AxiosResponse } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000, // ✅ Dodano timeout 30s
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Pomocnicza funkcja do czytania cookies
 */
function getCookie(name: string): string | null {
  const value: string = `; ${document.cookie}`;
  const parts: string[] = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Interceptor żądań: Automatycznie dodaje CSRF token
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const csrfToken: string | null = getCookie('csrftoken');

    if (csrfToken && config.headers) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
    
    return config;
  },
  (error: AxiosError): Promise<never> => {
    return Promise.reject(error);
  }
);

/**
 * Interceptor odpowiedzi: Obsługa błędów i przekierowania
 */
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  (error: AxiosError<{ detail?: string; error?: string }>): Promise<never> => {
    // 401 Unauthorized - przekieruj na login
    if (error.response?.status === 401) {
      console.warn('Unauthorized - redirecting to login');
      
      // Przekieruj tylko jeśli nie jesteśmy już na /login
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Forbidden:', error.response.data);
    }

    // 500+ Server errors
    if (error.response && error.response.status >= 500) {
      console.error('Server error:', error.response.data);
    }

    // Network errors
    if (!error.response) {
      console.error('Network error - check your connection');
    }

    return Promise.reject(error);
  }
);

export default api;
