import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const API_V1 = `${API_BASE_URL}/api/v1`;
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

const ACCESS_TOKEN_KEY = "messenger_access_token";
const REFRESH_TOKEN_KEY = "messenger_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const api = axios.create({ baseURL: API_V1, timeout: 25000 });

export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return !error.response && (error.code === "ERR_NETWORK" || !navigator.onLine);
  }
  return !navigator.onLine;
}

export function isTimeoutError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.code === "ECONNABORTED" || Boolean(error.message && error.message.includes("timeout"));
  }
  return false;
}

export function isServerUnavailable(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return (
      status === 502 ||
      status === 503 ||
      status === 504 ||
      isTimeoutError(error) ||
      (isNetworkError(error) && navigator.onLine)
    );
  }
  return false;
}

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Queue concurrent 401s while a single refresh request is in flight, so we
// don't fire multiple simultaneous refresh calls (which would race and
// invalidate each other under our rotating-refresh-token scheme).
let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function resolveQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }
    if (originalRequest.url?.includes("/auth/login") || originalRequest.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) {
      tokenStorage.clear();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push((newToken) => {
          if (!newToken) return reject(error);
          originalRequest._retry = true;
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post(`${API_V1}/auth/refresh`, { refresh_token: refreshToken });
      tokenStorage.set(data.access_token, data.refresh_token);
      resolveQueue(data.access_token);
      originalRequest._retry = true;
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      resolveQueue(null);
      if (axios.isAxiosError(refreshError) && (refreshError.response?.status === 401 || refreshError.response?.status === 403)) {
        tokenStorage.clear();
        if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
          window.location.href = "/login";
        }
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
