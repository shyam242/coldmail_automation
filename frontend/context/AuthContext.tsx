"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { showToast } from "@/src/components/Toast";

/* ✅ ADD THIS LINE */
const API = process.env.NEXT_PUBLIC_API_URL;

type AuthContextType = {
  loading: boolean;
  authenticated: boolean;
  user: { email: string; name?: string } | null;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  loading: true,
  authenticated: false,
  user: null,
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const hasShownToastRef = useRef(false);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API}/auth/me`, {
        credentials: "include",
      });

      const data = await res.json();

      setAuthenticated(data.authenticated === true);

      if (data.authenticated) {
        setUser({ email: data.email, name: data.name });

        if (!hasShownToastRef.current) {
          hasShownToastRef.current = true;
          showToast(`Welcome back, ${data.name || data.email}!`, "success");
        }
      } else {
        setUser(null);
        hasShownToastRef.current = false;
      }
    } catch (error) {
      setAuthenticated(false);
      setUser(null);
      hasShownToastRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // re-check for OAuth redirect race condition
    const timers = Array.from({ length: 5 }).map((_, i) =>
      setTimeout(checkAuth, (i + 1) * 2000)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, authenticated, user, refetch: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
