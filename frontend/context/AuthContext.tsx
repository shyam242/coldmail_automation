"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { showToast } from "@/src/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL;
if (!API) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

type User = {
  email: string;
  name?: string;
};

type AuthContextType = {
  loading: boolean;
  authenticated: boolean;
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);

  // Prevent duplicate welcome toast
  const hasWelcomedRef = useRef(false);
  // Prevent parallel auth checks
  const checkingRef = useRef(false);

  const checkAuth = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const res = await fetch(`${API}/auth/me`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Auth check failed");
      }

      const data = await res.json();

      if (data.authenticated === true) {
        setAuthenticated(true);
        setUser({ email: data.email, name: data.name });

        if (!hasWelcomedRef.current) {
          hasWelcomedRef.current = true;
          showToast(
            `Welcome back, ${data.name || data.email}!`,
            "success"
          );
        }
      } else {
        setAuthenticated(false);
        setUser(null);
        hasWelcomedRef.current = false;
      }
    } catch {
      setAuthenticated(false);
      setUser(null);
      hasWelcomedRef.current = false;
    } finally {
      setLoading(false);
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    // Initial auth check
    checkAuth();

    // Handle OAuth redirect race condition
    const timers = Array.from({ length: 4 }).map((_, i) =>
      setTimeout(checkAuth, (i + 1) * 1500)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        authenticated,
        user,
        refetch: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
