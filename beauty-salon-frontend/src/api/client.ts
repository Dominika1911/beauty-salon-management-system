// src/api/client.ts
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosRequestHeaders,
} from 'axios';

export const API_BASE_URL = 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const method = (config.method ?? 'get').toLowerCase();

    // CSRF tylko dla metod modyfikujących
    if (!['get', 'head', 'options', 'trace'].includes(method)) {
      const token = getCsrfTokenFromCookie();
      if (token) {
        // bierzemy istniejące headers albo pusty obiekt
        const headers: AxiosRequestHeaders =
          (config.headers ?? {}) as AxiosRequestHeaders;

        headers['X-CSRFToken'] = token;
        config.headers = headers;
      }
    }

    return config;
  },
);
