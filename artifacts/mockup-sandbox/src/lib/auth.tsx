import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken } from "./api";

export type User = {
  id: number;
  role: "customer" | "vendor" | "admin";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  avatarUrl?: string | null;
};

type Impersonation = {
  vendorName: string;
};

type AdminReturn = {
  token: string;
  user: User;
  vendorName: string;
};

const ADMIN_RETURN_KEY = "kt_admin_return";

function readAdminReturn(): AdminReturn | null {
  try {
    const raw = localStorage.getItem(ADMIN_RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminReturn;
    if (!parsed?.token || !parsed.user || parsed.user.role !== "admin") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAdminReturn(value: AdminReturn | null) {
  if (value) localStorage.setItem(ADMIN_RETURN_KEY, JSON.stringify(value));
  else localStorage.removeItem(ADMIN_RETURN_KEY);
}

type AuthCtx = {
  user: User | null;
  ready: boolean;
  impersonating: Impersonation | null;
  staffAccess: Impersonation | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  setSession: (token: string, user: User) => void;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  openVendorPanel: (vendorId: number) => Promise<{ vendorName: string }>;
  returnToAdmin: () => boolean;
};

type AuthContext = ReturnType<typeof createContext<AuthCtx | null>>;

const authGlobal = globalThis as typeof globalThis & { __ktAuthCtx?: AuthContext };
const Ctx: AuthContext = authGlobal.__ktAuthCtx ?? createContext<AuthCtx | null>(null);
authGlobal.__ktAuthCtx = Ctx;

const fallbackAuth: AuthCtx = {
  user: null,
  ready: true,
  impersonating: null,
  staffAccess: null,
  login: async () => {
    throw new Error("Please refresh the page and try again");
  },
  logout: () => {},
  setSession: () => {},
  setUser: () => {},
  refresh: async () => {},
  openVendorPanel: async () => {
    throw new Error("Please refresh the page and try again");
  },
  returnToAdmin: () => false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [impersonating, setImpersonating] = useState<Impersonation | null>(() => {
    const saved = readAdminReturn();
    return saved ? { vendorName: saved.vendorName } : null;
  });
  const [staffAccess, setStaffAccess] = useState<Impersonation | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const data = await api<{
        user: User;
        vendor?: { businessName?: string } | null;
        staffAccess?: boolean;
      }>("/api/auth/me");
      setUser(data.user);
      const saved = readAdminReturn();
      setImpersonating(data.user.role === "vendor" && saved ? { vendorName: saved.vendorName } : null);
      setStaffAccess(
        data.user.role === "vendor" && data.staffAccess
          ? { vendorName: data.vendor?.businessName || "this kitchen" }
          : null,
      );
      if (data.user.role !== "vendor") writeAdminReturn(null);
    } catch {
      setToken(null);
      setUser(null);
      setImpersonating(null);
      setStaffAccess(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{
      token: string;
      user: User;
      staffAccess?: boolean;
      vendor?: { businessName?: string } | null;
    }>("/api/auth/login", {
      method: "POST",
      json: { email, password },
    });
    writeAdminReturn(null);
    setImpersonating(null);
    setStaffAccess(
      data.staffAccess ? { vendorName: data.vendor?.businessName || "this kitchen" } : null,
    );
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    writeAdminReturn(null);
    setImpersonating(null);
    setStaffAccess(null);
    setToken(null);
    setUser(null);
  }, []);

  const setSession = useCallback((token: string, next: User) => {
    setToken(token);
    setUser(next);
  }, []);

  const openVendorPanel = useCallback(async (vendorId: number) => {
    const data = await api<{
      token: string;
      user: User;
      vendor: { businessName: string };
    }>(`/api/admin/vendors/${vendorId}/impersonate`, { method: "POST" });
    const adminToken = getToken();
    if (user?.role === "admin" && adminToken) {
      writeAdminReturn({
        token: adminToken,
        user,
        vendorName: data.vendor.businessName,
      });
    }
    setToken(data.token);
    setUser(data.user);
    setStaffAccess(null);
    setImpersonating({ vendorName: data.vendor.businessName });
    return { vendorName: data.vendor.businessName };
  }, [user]);

  const returnToAdmin = useCallback(() => {
    const saved = readAdminReturn();
    if (!saved) return false;
    writeAdminReturn(null);
    setImpersonating(null);
    setStaffAccess(null);
    setToken(saved.token);
    setUser(saved.user);
    return true;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      impersonating,
      staffAccess,
      login,
      logout,
      setSession,
      setUser,
      refresh,
      openVendorPanel,
      returnToAdmin,
    }),
    [user, ready, impersonating, staffAccess, login, logout, setSession, refresh, openVendorPanel, returnToAdmin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx) ?? fallbackAuth;
}
