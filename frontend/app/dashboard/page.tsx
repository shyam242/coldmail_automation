"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type RecentEmail = {
  recipient: string;
  subject: string;
  sentAt: string;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  tracked: boolean;
};

// SQLite returns UTC timestamps without a timezone suffix
const toDate = (v: string) => new Date(v.includes("T") ? v : v.replace(" ", "T") + "Z");

type DashboardStats = {
  totalEmailsSent: number;
  totalOpened: number;
  openRate: number;
  recentEmails: RecentEmail[];
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
    totalOpened: 0,
    openRate: 0,
    recentEmails: [],
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
    const interval = setInterval(fetchStats, 30000); // pick up new opens
    return () => clearInterval(interval);
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-gradient-to-br from-brand to-orange-600 text-white rounded-lg p-8 shadow-lg">
              <p className="text-sm opacity-90">Total Emails Sent</p>
              <p className="text-5xl font-bold mt-2">
                {loading ? "..." : stats.totalEmailsSent}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-8 shadow-lg">
              <p className="text-sm opacity-90">Emails Opened</p>
              <p className="text-5xl font-bold mt-2">
                {loading ? "..." : stats.totalOpened}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-8 shadow-lg">
              <p className="text-sm opacity-90">Open Rate</p>
              <p className="text-5xl font-bold mt-2">
                {loading ? "..." : `${stats.openRate}%`}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-8 shadow-lg">
              <p className="text-sm opacity-90">Total CSVs Uploaded</p>
              <p className="text-5xl font-bold mt-2">
                {loading ? "..." : stats.totalCsvsUploaded}
              </p>
            </div>
          </div>

          {/* Sent emails + open tracking */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-12">
            <div className="bg-gray-50 border-b px-6 py-4">
              <h2 className="text-2xl font-bold">Sent Emails</h2>
              <p className="text-sm text-gray-500">
                Open tracking is approximate — some mail apps pre-load images.
              </p>
            </div>

            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : stats.recentEmails.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No emails sent yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-6 py-3 text-left">Recipient</th>
                      <th className="px-6 py-3 text-left">Subject</th>
                      <th className="px-6 py-3 text-left">Sent</th>
                      <th className="px-6 py-3 text-left">Status</th>
                      <th className="px-6 py-3 text-left">Opens</th>
                      <th className="px-6 py-3 text-left">Last opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentEmails.map((e, i) => (
                      <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                        <td className="px-6 py-4">{e.recipient}</td>
                        <td className="px-6 py-4">{e.subject}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {toDate(e.sentAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {!e.tracked ? (
                            <span className="text-gray-400">Not tracked</span>
                          ) : e.openCount > 0 ? (
                            <span className="text-green-600 font-semibold">Opened</span>
                          ) : (
                            <span className="text-gray-500">Not opened</span>
                          )}
                        </td>
                        <td className="px-6 py-4">{e.tracked ? e.openCount : "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {e.lastOpenedAt ? toDate(e.lastOpenedAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
