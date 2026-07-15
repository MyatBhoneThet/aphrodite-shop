"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "../data/products";
import { AUTH_STORAGE_KEYS } from "./auth-storage";
import { authHeaders, clearStoredAuth } from "./client-auth";

export type CurrentUser = {
  id?: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
};

export type CurrentUserState = {
  user: CurrentUser | null;
  status: "checking" | "ready";
  refresh: () => Promise<void>;
};

export function useCurrentUser(): CurrentUserState {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  async function load() {
    try {
      // Do not short-circuit when localStorage has no bearer token. Admin
      // sessions also live in an httpOnly cookie, which the browser sends to
      // this same-origin endpoint automatically.
      const response = await fetch("/api/auth/me", {
        headers: authHeaders(),
        cache: "no-store",
      });

      const data = (await response.json()) as { user?: CurrentUser | null };

      if (response.ok && data.user) {
        localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(data.user));
        setUser(data.user);
      } else {
        clearStoredAuth();
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setStatus("ready");
    }
  }

  useEffect(() => {
    async function loadOnMount() {
      await load();
    }

    loadOnMount();
  }, []);

  return { user, status, refresh: load };
}
