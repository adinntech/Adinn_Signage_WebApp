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
