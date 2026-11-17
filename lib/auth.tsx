"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as apiClient from "@/lib/api";
import type { User } from "@/lib/api";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: Status;
  user: User | null;
  /** True when the last sign-out was caused by an expired/revoked session, not by the user. */
  sessionExpired: boolean;
  login: (identifier: string, credential: apiClient.Credential, remember: boolean, loginRole?: string) => Promise<User>;
  /** Creates the account and signs the user in. */
  register: (input: apiClient.RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  can: (permission?: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    apiClient
      .refreshSession()
      .then((p) => {
        if (!active) return;
        setUser(p.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("unauthenticated");
      });
    apiClient.setSessionExpiredHandler(() => {
      setSessionExpired(true);
      setUser(null);
      setStatus("unauthenticated");
      queryClient.clear();
    });
    return () => {
      active = false;
      apiClient.setSessionExpiredHandler(null);
    };
  }, [queryClient]);

  // Renew the token ahead of its 15 minute expiry (and when the tab wakes up), so it is replaced silently
  // and the cookie the server-side guard reads never goes stale. A failed renewal signs the person out.
  useEffect(() => {
    if (status !== "authenticated") return;
    const run = () =>
      apiClient.refreshSession().catch(() => {
        /* a 401 here means the refresh cookie is gone; the next API call reports the expired session */
      });
    // The refresh token rotates, so two open tabs must not renew at the same moment: the lock makes the second
    // tab wait and then use the cookie the first one just refreshed.
    const renew = () => (navigator.locks ? navigator.locks.request("sg-token-renew", run) : run());
    const timer = setInterval(renew, 12 * 60_000);
    return () => clearInterval(timer);
  }, [status]);

  const login = useCallback(async (identifier: string, credential: apiClient.Credential, remember: boolean, loginRole?: string) => {
    const p = await apiClient.login(identifier, credential, remember, loginRole);
    setSessionExpired(false);
    setUser(p.user);
    setStatus("authenticated");
    return p.user;
  }, []);

  const register = useCallback(async (input: apiClient.RegisterInput) => {
    const p = await apiClient.registerAccount(input);
    setSessionExpired(false);
    setUser(p.user);
    setStatus("authenticated");
    return p.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      /* clear local session regardless */
    }
    queryClient.clear();
    setSessionExpired(false);
    setUser(null);
    setStatus("unauthenticated");
  }, [queryClient]);

  const can = useCallback(
    (permission?: string) => {
      if (!permission) return true;
      if (!user) return false;
      return user.role === "SUPER_ADMIN" || user.permissions.includes(permission);
    },
    [user],
  );

  const value = useMemo(
    () => ({ status, user, sessionExpired, login, register, logout, can }),
    [status, user, sessionExpired, login, register, logout, can],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
