import axios, { type AxiosInstance, type AxiosError, type AxiosResponse } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { notify } from "../utils/notificationService";


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
    const status = error.response?.status;

    // helper do wyciągania komunikatu DRF
    const serverMsg =
      (error.response?.data && (error.response.data.detail || error.response.data.error)) ||
      undefined;

    // 401 Unauthorized - sesja wygasła
    if (status === 401) {
      notify(serverMsg ?? "Sesja wygasła. Zaloguj się ponownie.", "error");

      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // 403 Forbidden
    if (status === 403) {
      notify(serverMsg ?? "Brak uprawnień do wykonania tej operacji.", "error");
      return Promise.reject(error);
    }

    // 404 Not Found
    if (status === 404) {
      notify(serverMsg ?? "Zasób nie został znaleziony.", "info");
      return Promise.reject(error);
    }

    // 500+
    if (status && status >= 500) {
      notify(serverMsg ?? "Wystąpił błąd serwera. Spróbuj ponownie później.", "error");
      return Promise.reject(error);
    }

    // Network errors (brak odpowiedzi)
    if (!error.response) {
      notify("Błąd połączenia. Sprawdź internet i spróbuj ponownie.", "error");
      return Promise.reject(error);
    }

    // 400/422 walidacje – nie spamujemy globalnym toastem jeśli i tak obsługujesz pola
    // ale jeśli backend dał "detail", pokażemy:
    if (status === 400 && serverMsg) {
      notify(serverMsg, "error");
    }

    return Promise.reject(error);
  }
);
