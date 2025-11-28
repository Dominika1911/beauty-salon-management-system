// src/api/axios.ts

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Instancja Axios z automatycznym CSRF token
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ Ważne! Wysyła cookies (sessionid, csrftoken)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: automatycznie dodaje CSRF token do każdego żądania
api.interceptors.request.use((config) => {
  // Pobierz CSRF token z cookies
  const csrfToken = getCookie('csrftoken');
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
});

// Interceptor obsługi błędów
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Użytkownik niezalogowany - możesz przekierować na /login
      console.warn('Unauthorized - redirect to login');
    }
    return Promise.reject(error);
  }
);

// Helper do czytania cookies
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

export default api;