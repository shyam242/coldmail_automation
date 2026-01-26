"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/src/components/navbar";
const API = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const { loading, authenticated } = useAuth();

  const handleClick = () => {
    if (!authenticated) {
      window.location.href = `${API}/auth/google/login`;
    } else {
      window.location.href = "/upload";
    }
  };

  return (
    <div className="text-center py-32">
      <h1 className="text-6xl font-extrabold">
        ColdMail Automation
      </h1>

      <p className="mt-6 text-lg text-gray-600">
        Upload leads, manage multiple senders, preview emails, and send safely.
      </p>

      <button
        onClick={handleClick}
        className="mt-10 bg-brand text-white px-10 py-4 rounded-2xl"
        disabled={loading}
      >
        Get Started
      </button>
    </div>
  );
}
