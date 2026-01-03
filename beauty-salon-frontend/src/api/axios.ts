import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

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

function ensureAxiosHeaders(h: InternalAxiosRequestConfig['headers']): AxiosHeaders {
    return new AxiosHeaders(h);
}


axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const headers = ensureAxiosHeaders(config.headers);
    config.headers = headers;

    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
        headers.set('X-CSRFToken', csrfToken);
    }

    const isFD = typeof FormData !== 'undefined' && config.data instanceof FormData;

    if (!isFD) {
        headers.set('Content-Type', 'application/json');
    } else {
        headers.delete('Content-Type');
    }

    return config;
});

axiosInstance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
        const e = error as { response?: { status?: number }; config?: { url?: unknown } };

        if (e.response?.status === 401) {
            const reqUrl = String(e.config?.url ?? '');
            const isAuthEndpoint =
                reqUrl.includes('/auth/status/') ||
                reqUrl.includes('/auth/login/') ||
                reqUrl.includes('/auth/logout/') ||
                reqUrl.includes('/auth/csrf/');

            if (!isAuthEndpoint && window.location.pathname !== '/login') {
                window.location.assign('/login');
            }
        }

        if (e.response?.status === 403) {
            if (window.location.pathname !== '/access-denied') {
                window.location.assign('/access-denied');
            }
        }

        return Promise.reject(error);
    },
);

export default axiosInstance;
