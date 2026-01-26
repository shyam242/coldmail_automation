"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

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
        const res = await fetch("http://localhost:8000/dashboard/stats", {
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
        `http://localhost:8000/dashboard/download-csv/${csvId}`,
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
    if (!window.confirm("Are you sure you want to delete this CSV?")) {
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:8000/dashboard/delete-csv/${csvId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (res.ok) {
        // Refresh stats after deletion
        const statsRes = await fetch("http://localhost:8000/dashboard/stats", {
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
          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-2">Dashboard</h1>
            <p className="text-gray-600 text-lg">
              Welcome back, {user?.name || user?.email}!
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Total Emails Sent */}
            <div className="bg-gradient-to-br from-brand to-orange-600 text-white rounded-lg p-8 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Emails Sent</p>
                  <p className="text-5xl font-bold mt-2">
                    {loading ? "..." : stats.totalEmailsSent}
                  </p>
                </div>
                <div className="text-6xl opacity-20">📧</div>
              </div>
            </div>

            {/* Total CSVs Uploaded */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-8 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total CSVs Uploaded</p>
                  <p className="text-5xl font-bold mt-2">
                    {loading ? "..." : stats.totalCsvsUploaded}
                  </p>
                </div>
                <div className="text-6xl opacity-20">📁</div>
              </div>
            </div>
          </div>

          {/* CSV List Section */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <h2 className="text-2xl font-bold">Uploaded CSVs</h2>
            </div>

            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : stats.csvs.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No CSVs uploaded yet</p>
                <a
                  href="/upload"
                  className="inline-block mt-4 bg-brand text-white px-6 py-2 rounded-lg hover:bg-orange-600"
                >
                  Upload Your First CSV
                </a>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Filename
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Rows
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Uploaded
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.csvs.map((csv, index) => (
                      <tr
                        key={csv.id}
                        className={
                          index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }
                      >
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {csv.filename}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {csv.rowCount}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(csv.uploadedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex gap-3">
                            <button
                              onClick={() =>
                                handleDownloadCSV(csv.id, csv.filename)
                              }
                              className="text-brand hover:text-orange-600 font-semibold"
                            >
                              Download
                            </button>
                            <button
                              onClick={() => handleDeleteCSV(csv.id)}
                              className="text-red-500 hover:text-red-700 font-semibold"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4">
            <a
              href="/upload"
              className="bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
            >
              Upload New CSV
            </a>
            <a
              href="/senders"
              className="bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
            >
              Manage Senders
            </a>
          </div>
        </div>
      </Container>
    </AuthGuard>
  );
}
