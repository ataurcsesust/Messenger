import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { api, tokenStorage } from "../services/api";
import type { UserMe } from "../types";

interface AuthContextValue {
  user: UserMe | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshMe() {
    const { data } = await api.get<UserMe>("/auth/me");
    setUser(data);
  }

  useEffect(() => {
    (async () => {
      const access = tokenStorage.getAccess();
      const refresh = tokenStorage.getRefresh();

      if (access || refresh) {
        try {
          await refreshMe();
        } catch (err) {
          // If refreshMe fails (e.g. access token expired), attempt token refresh before giving up
          if (refresh) {
            try {
              const { data } = await api.post("/auth/refresh", { refresh_token: refresh });
              tokenStorage.set(data.access_token, data.refresh_token);
              await refreshMe();
            } catch (refreshErr) {
              if (axios.isAxiosError(refreshErr) && (refreshErr.response?.status === 401 || refreshErr.response?.status === 403)) {
                tokenStorage.clear();
              }
            }
          } else if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
            tokenStorage.clear();
          }
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function login(identifier: string, password: string) {
    const { data } = await api.post("/auth/login", { identifier, password });
    tokenStorage.set(data.access_token, data.refresh_token);
    await refreshMe();
  }

  async function register(email: string, username: string, password: string, fullName: string) {
    await api.post("/auth/register", { email, username, password, full_name: fullName });
    await login(username, password);
  }

  async function logout() {
    const refreshToken = tokenStorage.getRefresh();
    try {
      if (refreshToken) await api.post("/auth/logout", { refresh_token: refreshToken });
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
