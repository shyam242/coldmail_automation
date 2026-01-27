"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-600">
        Loading...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="py-20 text-center text-red-500 font-semibold">
        Please login first
      </div>
    );
  }

  return <>{children}</>;
}