import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, clearToken, getToken, setToken } from "./api";

interface AuthState {
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u: { username: string }) => setUsername(u.username))
      .catch(() => {
        clearToken();
        setUsername(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const res = await api.login(user, password);
    setToken(res.access_token);
    setUsername(res.username);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUsername(null);
  }, []);

  const value = useMemo(
    () => ({ username, loading, login, logout }),
    [username, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}
