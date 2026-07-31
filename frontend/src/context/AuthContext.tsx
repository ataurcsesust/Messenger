import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
      if (tokenStorage.getAccess()) {
        try {
          await refreshMe();
        } catch {
          tokenStorage.clear();
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
