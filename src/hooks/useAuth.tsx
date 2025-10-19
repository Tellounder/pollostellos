import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getRedirectResultSafe, loginWithGoogle, logout, watchAuthState } from "utils/firebase";
import type { Unsubscribe } from "firebase/auth";
import type { User } from "utils/firebase";
import { api } from "utils/api";

type AuthContextType = {
  user: User | null;
  backendUserId: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  backendUserId: null,
  login: async () => {},
  logout: async () => {},
});

export const BACKEND_USER_KEY = "pt_backend_user_id";
export const TERMS_ACCEPTED_KEY = "pt_terms_accepted";
export const TERMS_PENDING_KEY = "pt_terms_pending";

const safeGet = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const safeSet = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // ignore storage errors
  }
};

const safeRemove = (key: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // ignore
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendUserId, setBackendUserId] = useState<string | null>(() => safeGet(BACKEND_USER_KEY));

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;
    let mounted = true;

    (async () => {
      try {
        const redirectUser = await getRedirectResultSafe();
        if (redirectUser && mounted) {
          setUser(redirectUser);
          setLoading(false);
        }

        unsubscribe = await watchAuthState((currentUser) => {
          if (!mounted) {
            return;
          }
          setUser(currentUser);
          setLoading(false);
        });
      } catch (error) {
        console.error("No se pudo inicializar la sesión de Firebase", error);
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const login = async () => {
    await loginWithGoogle();
  };

  const doLogout = async () => {
    await logout();
    setBackendUserId(null);
    safeRemove(BACKEND_USER_KEY);
  };

  const firstNameUser = useMemo(() => {
    if (!user) {
      return null;
    }
    const [firstWord] = (user.displayName ?? "").split(" ");
    return {
      ...user,
      displayName: firstWord || user.displayName || undefined,
    } as User;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBackendUserId(null);
      safeRemove(BACKEND_USER_KEY);
      return;
    }

    let cancelled = false;

    const syncUser = async () => {
      try {
        const stored = safeGet(BACKEND_USER_KEY);
        if (stored) {
          setBackendUserId(stored);
        }

        const [firstName, ...rest] = (user.displayName ?? "").trim().split(" ");
        const lastName = rest.length ? rest.join(" ") : undefined;

        const termsPending = safeGet(TERMS_PENDING_KEY) === "true";

        const saved = await api.upsertUser({
          email: user.email ?? "",
          externalAuthId: user.uid,
          displayName: user.displayName,
          firstName: firstName || undefined,
          lastName,
          phone: user.phoneNumber,
          termsAcceptedAt: termsPending ? new Date().toISOString() : undefined,
        });

        if (cancelled) return;

        setBackendUserId(saved.id);
        safeSet(BACKEND_USER_KEY, saved.id);
        if (termsPending) {
          safeRemove(TERMS_PENDING_KEY);
          safeSet(TERMS_ACCEPTED_KEY, "true");
        }
      } catch (error) {
        console.error("No se pudo sincronizar el usuario con la API", error);
        safeRemove(TERMS_PENDING_KEY);
      }
    };

    syncUser();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user: firstNameUser, backendUserId, login, logout: doLogout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
