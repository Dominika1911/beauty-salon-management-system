import axios, { type AxiosInstance, type AxiosError, type AxiosResponse } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { notify } from "@/utils/notificationService.ts";

const API_BASE_URL: string = "/api";

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

function getCookie(name: string): string | null {
  const value: string = `; ${document.cookie}`;
  const parts: string[] = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const csrfToken: string | null = getCookie("csrftoken");
    if (csrfToken && config.headers) {
      config.headers["X-CSRFToken"] = csrfToken;
    }
    return config;
  },
  (error: AxiosError): Promise<never> => Promise.reject(error),
);

api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  (error: AxiosError<{ detail?: string; error?: string }>): Promise<never> => {
    const status = error.response?.status;

    const serverMsg =
      (error.response?.data && (error.response.data.detail || error.response.data.error)) ||
      undefined;

    if (status === 401) {
      notify(serverMsg ?? "Sesja wygasła. Zaloguj się ponownie.", "error");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (status === 403) {
      notify(serverMsg ?? "Brak uprawnień do wykonania tej operacji.", "error");
      return Promise.reject(error);
    }

    // Nie spamujemy globalnie 404
    if (status === 404) {
      return Promise.reject(error);
    }

    if (status && status >= 500) {
      notify(serverMsg ?? "Wystąpił błąd serwera. Spróbuj ponownie później.", "error");
      return Promise.reject(error);
    }

    if (!error.response) {
      notify("Błąd połączenia. Sprawdź internet i spróbuj ponownie.", "error");
      return Promise.reject(error);
    }

    if (status === 400 && serverMsg) notify(serverMsg, "error");
    if (status === 409 && serverMsg) notify(serverMsg, "error");

    return Promise.reject(error);
  },
);
