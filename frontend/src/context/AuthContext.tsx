import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { login, me, register, type UserPublic } from "../api";

type AuthState = {
  token: string | null;
  user: UserPublic | null;
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
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);

  const setAuth = useCallback((t: string | null, u: UserPublic | null) => {
    setToken(t);
    setUser(u);
  }, []);

  const doLogin = useCallback(async (email: string, password: string) => {
    const { access_token } = await login(email, password);
    const u = await me(access_token);
    setToken(access_token);
    setUser(u);
  }, []);

  const doRegister = useCallback(async (email: string, password: string) => {
    const { access_token } = await register(email, password);
    const u = await me(access_token);
    setToken(access_token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const u = await me(token);
    setUser(u);
  }, [token]);

  const value: AuthContextValue = {
    token,
    user,
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
