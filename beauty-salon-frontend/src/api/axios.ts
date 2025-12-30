import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: '/api',
    withCredentials: true,
    xsrfCookieName: 'csrftoken',
    xsrfHeaderName: 'X-CSRFToken',
});

function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

axiosInstance.interceptors.request.use((config) => {
    config.headers = config.headers ?? {};

    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
        (config.headers as any)['X-CSRFToken'] = csrfToken;
    }

    // U Was na razie JSON, ale zostawiamy bezpiecznie obsługę FormData
    const isFD = typeof FormData !== 'undefined' && config.data instanceof FormData;

    if (!isFD) {
        (config.headers as any)['Content-Type'] = 'application/json';
    } else {
        delete (config.headers as any)['Content-Type'];
    }

    return config;
});

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Nie przekierowuj jeśli to /auth/status/ (unikamy pętli)
            const reqUrl = (error.config?.url || '').toString();
            const isAuthEndpoint =
                reqUrl.includes('/auth/status/') ||
                reqUrl.includes('/auth/login/') ||
                reqUrl.includes('/auth/logout/') ||
                reqUrl.includes('/auth/csrf/');

            if (!isAuthEndpoint && window.location.pathname !== '/login') {
                window.location.assign('/login');
            }
        }
        return Promise.reject(error);
    },
);

export default axiosInstance;
