import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  fetchCurrentUser,
  login,
  register,
  setOnUnauthorized,
  type UserPublic,
} from "../api";

const TOKEN_STORAGE_KEY = "seller-hub-token";

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token == null) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    /* ignore */
  }
}

type AuthState = {
  token: string | null;
  user: UserPublic | null;
  /** True while re-fetching user on load (token from storage). */
  isRestoring: boolean;
};

type AuthContextValue = AuthState & {
  setAuth: (token: string | null, user: UserPublic | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(() => !!getStoredToken());

  const setAuth = useCallback((t: string | null, u: UserPublic | null) => {
    setToken(t);
    setUser(u);
    setStoredToken(t);
  }, []);

  const doLogin = useCallback(async (email: string, password: string) => {
    const { access_token } = await login(email, password);
    const u = await fetchCurrentUser(access_token);
    setToken(access_token);
    setUser(u);
    setStoredToken(access_token);
  }, []);

  const doRegister = useCallback(async (email: string, password: string) => {
    const { access_token } = await register(email, password);
    const u = await fetchCurrentUser(access_token);
    setToken(access_token);
    setUser(u);
    setStoredToken(access_token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStoredToken(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      try {
        sessionStorage.setItem("seller-hub-session-expired", "1");
      } catch {
        /* ignore */
      }
      logout();
    });
    return () => setOnUnauthorized(null);
  }, [logout]);

  useEffect(() => {
    if (!isRestoring || !token) {
      if (isRestoring) setIsRestoring(false);
      return;
    }
    fetchCurrentUser(token)
      .then((u) => {
        setUser(u);
        setIsRestoring(false);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        setStoredToken(null);
        setIsRestoring(false);
      });
  }, [isRestoring, token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const u = await fetchCurrentUser(token);
    setUser(u);
  }, [token]);

  const value: AuthContextValue = {
    token,
    user,
    isRestoring,
    setAuth,
    login: doLogin,
    register: doRegister,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
