import React, { createContext, useContext, useEffect, useState } from "react";
import { loginWithGoogle, logout, watchAuthState } from "utils/firebase";
import type { Unsubscribe } from "firebase/auth";
import type { User } from "utils/firebase";

type AuthContextType = {
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;
    let mounted = true;

    (async () => {
      try {
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
  };

  const firstNameUser = user
    ? ({
        ...user,
        displayName: user.displayName?.split(" ")[0] ?? user.displayName,
      } as User)
    : null;

  return (
    <AuthContext.Provider value={{ user: firstNameUser, login, logout: doLogout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
