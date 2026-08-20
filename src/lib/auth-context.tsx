import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { api, ApiError, tokenStore, StaffProfile } from "./api";

// 30-minute idle session timeout, same policy as the Admin Portal.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

interface LoginResult {
  setupRequired?: boolean;
  setupToken?: string;
  totpRequired?: boolean;
}

interface AuthContextValue {
  staff: StaffProfile | null;
  loading: boolean;
  login: (email: string, password: string, totp?: string, backupCode?: string) => Promise<LoginResult>;
  loginWithGoogle: (idToken: string, totp?: string, backupCode?: string) => Promise<LoginResult>;
  completeTotpSetup: (setupToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  isBranchManager: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffProfile | null>(() => tokenStore.getProfile());
  const [loading, setLoading] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh();
    tokenStore.clear();
    setStaff(null);
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { realm: "staff", refreshToken }, { auth: false });
      } catch {
        // best-effort — local session is already cleared either way
      }
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!tokenStore.getAccess()) return;
    idleTimer.current = setTimeout(() => {
      logout();
    }, IDLE_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    if (!staff) return;
    resetIdleTimer();
    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [staff, resetIdleTimer]);

  type RawLoginResponse = {
    setupRequired?: boolean;
    setupToken?: string;
    totpRequired?: boolean;
    accessToken?: string;
    refreshToken?: string;
    staff?: StaffProfile;
  };

  const applyLoginResponse = (data: RawLoginResponse): LoginResult => {
    if (data.setupRequired) return { setupRequired: true, setupToken: data.setupToken };
    if (data.totpRequired) return { totpRequired: true };
    if (data.accessToken && data.refreshToken && data.staff) {
      tokenStore.set(data.accessToken, data.refreshToken, data.staff);
      setStaff(data.staff);
    }
    return {};
  };

  const login = useCallback(async (email: string, password: string, totp?: string, backupCode?: string) => {
    setLoading(true);
    try {
      const { data } = await api.post<RawLoginResponse>(
        "/auth/staff/login",
        { email, password, totp, backupCode },
        { auth: false },
      );
      return applyLoginResponse(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string, totp?: string, backupCode?: string) => {
    setLoading(true);
    try {
      const { data } = await api.post<RawLoginResponse>(
        "/auth/staff/google",
        { idToken, totp, backupCode },
        { auth: false },
      );
      return applyLoginResponse(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const completeTotpSetup = useCallback(async (setupToken: string, code: string) => {
    const { data } = await api.post<{ accessToken: string; refreshToken: string; staff: StaffProfile }>(
      "/auth/staff/2fa/confirm",
      { setupToken, code },
      { auth: false },
    );
    tokenStore.set(data.accessToken, data.refreshToken, data.staff);
    setStaff(data.staff);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      staff, loading, login, loginWithGoogle, completeTotpSetup, logout,
      isBranchManager: staff?.role === "branch_manager",
    }),
    [staff, loading, login, loginWithGoogle, completeTotpSetup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
