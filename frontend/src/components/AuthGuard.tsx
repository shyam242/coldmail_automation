"use client";

import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return <p className="text-center mt-20">Checking login...</p>;
  }

  if (!authenticated) {
    return (
      <div className="text-center mt-32 space-y-6">
        <h2 className="text-3xl font-bold">Please log in first</h2>

        <a
          href="http://localhost:8000/auth/google/login"
          className="inline-block bg-brand text-white px-8 py-4 rounded-xl"
        >
          Login with Google
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
