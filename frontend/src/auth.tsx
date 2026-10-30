import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type User = { id: number; email: string; displayName: string | null; role: "student" | "admin" };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function request(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request("/api/auth/me").then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => {
      const data = await request("/api/auth/login", { email, password });
      setUser(data.user);
    },
    register: async (email, password, displayName) => {
      const referralCode = window.localStorage.getItem("neurostart_referral") || undefined;
      const data = await request("/api/auth/register", { email, password, displayName, referralCode });
      window.localStorage.removeItem("neurostart_referral");
      setUser(data.user);
    },
    logout: async () => {
      await request("/api/auth/logout", {});
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
