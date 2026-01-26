"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type DashboardStats = {
  totalEmailsSent: number;
  totalCsvsUploaded: number;
  csvs: Array<{
    id: string;
    filename: string;
    uploadedAt: string;
    rowCount: number;
  }>;
};

export default function DashboardPage() {
  const { authenticated, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmailsSent: 0,
    totalCsvsUploaded: 0,
    csvs: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authenticated) return;

    const fetchStats = async () => {
      try {
        const res = await fetch(`${API}/dashboard/stats`, {
          credentials: "include",
        });
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [authenticated]);

  const handleDownloadCSV = async (csvId: string, filename: string) => {
    try {
      const res = await fetch(
        `${API}/dashboard/download-csv/${csvId}`,
        {
          credentials: "include",
        }
      );

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download CSV:", error);
    }
  };

  const handleDeleteCSV = async (csvId: string) => {
    if (!window.confirm("Are you sure you want to delete this CSV?")) return;

    try {
      const res = await fetch(
        `${API}/dashboard/delete-csv/${csvId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (res.ok) {
        const statsRes = await fetch(`${API}/dashboard/stats`, {
          credentials: "include",
        });
        const data = await statsRes.json();
        setStats(data);
      } else {
        alert("Failed to delete CSV");
      }
    } catch (error) {
      console.error("Failed to delete CSV:", error);
      alert("Error deleting CSV");
    }
  };

  return (
    <AuthGuard>
      <Container>
        <div className="py-8">
          {/* Welcome */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-2">Dashboard</h1>
            <p className="text-gray-600 text-lg">
              Welcome back, {user?.name || user?.email}!
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="bg-gradient-to-br from-brand to-orange-600 text-white rounded-lg p-8 shadow-lg">
              <p className="text-sm opacity-90">Total Emails Sent</p>
              <p className="text-5xl font-bold mt-2">
                {loading ? "..." : stats.totalEmailsSent}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-8 shadow-lg">
              <p className="text-sm opacity-90">Total CSVs Uploaded</p>
              <p className="text-5xl font-bold mt-2">
                {loading ? "..." : stats.totalCsvsUploaded}
              </p>
            </div>
          </div>

          {/* CSV Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-50 border-b px-6 py-4">
              <h2 className="text-2xl font-bold">Uploaded CSVs</h2>
            </div>

            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : stats.csvs.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No CSVs uploaded yet
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-6 py-3 text-left">Filename</th>
                    <th className="px-6 py-3 text-left">Rows</th>
                    <th className="px-6 py-3 text-left">Uploaded</th>
                    <th className="px-6 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.csvs.map((csv, i) => (
                    <tr key={csv.id} className={i % 2 ? "bg-gray-50" : ""}>
                      <td className="px-6 py-4">{csv.filename}</td>
                      <td className="px-6 py-4">{csv.rowCount}</td>
                      <td className="px-6 py-4">
                        {new Date(csv.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 flex gap-4">
                        <button
                          onClick={() =>
                            handleDownloadCSV(csv.id, csv.filename)
                          }
                          className="text-brand font-semibold"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDeleteCSV(csv.id)}
                          className="text-red-500 font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex gap-4">
            <a
              href="/upload"
              className="bg-brand text-white px-8 py-3 rounded-lg font-semibold"
            >
              Upload New CSV
            </a>
          </div>
        </div>
      </Container>
    </AuthGuard>
  );
}
