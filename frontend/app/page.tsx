"use client";

<<<<<<< HEAD
const API = process.env.NEXT_PUBLIC_API_URL!;
=======
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
>>>>>>> 3394caa87cff32f19f8c9b138a5e64646aab4359

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] flex items-center justify-center">
      <div className="max-w-5xl w-full px-6 py-16 text-center">
        {/* BRAND */}

        {/* HERO HEADING */}
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Cold Email Automation <br />
          <span className="text-brand">That Actually Gets Replies</span>
        </h1>

        {/* SUBTEXT */}
        <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-10">
          Upload leads via CSV, connect up to 3 Gmail accounts, and send
          personalized cold emails securely using Google OAuth — no app
          passwords, no SMTP headaches.
        </p>

        {/* CTA */}
        <div className="flex justify-center mb-14">
          <button
            onClick={() => {
              window.location.href = `${API}/auth/google/login`;
            }}
            className="bg-brand hover:bg-orange-600 transition-all text-white px-10 py-4 rounded-xl text-lg font-semibold shadow-xl"
          >
            🚀 Get Started with Google
          </button>
        </div>

        {/* FEATURES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-xl font-bold mb-2">📂 CSV-Based Campaigns</h3>
            <p className="text-gray-600">
              Upload a CSV of leads and automatically personalize every email
              using dynamic fields.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-xl font-bold mb-2">🔐 Gmail OAuth Only</h3>
            <p className="text-gray-600">
              Connect Gmail securely with Google OAuth. No app passwords. No
              risky SMTP logins.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-xl font-bold mb-2">⚡ Smart Sender Rotation</h3>
            <p className="text-gray-600">
              Use up to 3 Gmail accounts and automatically send 50 emails per
              account to stay safe.
            </p>
          </div>
        </div>

        {/* FOOTER NOTE */}
        <p className="text-sm text-gray-400 mt-12">
          Built for founders, recruiters, and sales teams who care about
          deliverability.
        </p>
      </div>
    </main>
  );
}
