import axios from 'axios';

// Bazowy URL API - zmień w produkcji
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Instancja axios z konfiguracją
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Ważne dla session cookies i CSRF
  headers: {
    'Content-Type': 'application/json',
  },
});

// Funkcja do pobierania tokenu CSRF
export const getCsrfToken = async (): Promise<string> => {
  try {
    const response = await axiosInstance.get('/auth/csrf/');
    return response.data.csrfToken;
  } catch (error) {
    console.error('Błąd pobierania CSRF token:', error);
    throw error;
  }
};

// Interceptor - dodawanie CSRF tokenu do każdego żądania
axiosInstance.interceptors.request.use(
  async (config) => {
    // Dodaj CSRF token dla metod POST, PUT, PATCH, DELETE
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      // Pobierz token z cookies
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];

      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor - obsługa błędów
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 - Unauthorized (wyloguj użytkownika)
    if (error.response?.status === 401) {
      // Przekieruj do logowania
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // 403 - Forbidden
    if (error.response?.status === 403) {
      console.error('Brak uprawnień do tego zasobu');
    }

    // 404 - Not Found
    if (error.response?.status === 404) {
      console.error('Zasób nie znaleziony');
    }

    // 500 - Internal Server Error
    if (error.response?.status === 500) {
      console.error('Błąd serwera');
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
