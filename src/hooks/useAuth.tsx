import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, loginWithGoogle, logout } from "utils/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

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
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async () => {
    await loginWithGoogle();
  };

  const doLogout = async () => {
    await logout();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout: doLogout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
