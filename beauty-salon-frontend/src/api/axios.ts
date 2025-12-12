import axios, { type AxiosInstance, type AxiosError, type AxiosResponse } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL: string = '/api';


export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
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

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        // TODO: Dodaj toast notification: "Sesja wygasła. Zaloguj się ponownie."
        window.location.href = '/login';
      }
    }

    // 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Forbidden:', error.response.data);
      // TODO: Dodaj toast notification: "Brak uprawnień do wykonania tej operacji."
    }

    // 404 Not Found
    if (error.response?.status === 404) {
      console.error('Not found:', error.response.data);
      // TODO: Dodaj toast notification: "Zasób nie został znaleziony."
    }

    // 500+ Server errors
    if (error.response && error.response.status >= 500) {
      console.error('Server error:', error.response.data);
      // TODO: Dodaj toast notification: "Wystąpił błąd serwera. Spróbuj ponownie później."
    }

    // Network errors
    if (!error.response) {
      console.error('Network error - check your connection');
      // TODO: Dodaj toast notification: "Błąd połączenia. Sprawdź swoje połączenie internetowe."
    }

    return Promise.reject(error);
  }
);