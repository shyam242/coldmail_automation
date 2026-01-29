"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/src/components/Toast";

type GmailAccount = {
  id: number;
  email: string;
  name: string;
  selected?: boolean;
};

const API = process.env.NEXT_PUBLIC_API_URL;
if (!API) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

export default function SendersPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${API}/gmail/accounts`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch accounts");
      }

      const data = await response.json();
      setAccounts(
        data.accounts.map((acc: GmailAccount) => ({
          ...acc,
          selected: false,
        }))
      );
    } catch (error) {
      console.error("Error fetching accounts:", error);
      showToast("Failed to load Gmail accounts", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    if (accounts.length >= 3) {
      showToast("Maximum 3 Gmail accounts allowed", "error");
      return;
    }

    try {
      // Open Google OAuth in new window to maintain session
      window.location.href = `${API}/gmail/connect`;
    } catch (error) {
      console.error("Error connecting Gmail:", error);
      showToast("Failed to connect Gmail account", "error");
    }
  };

  const handleToggleSelect = (id: number) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id ? { ...acc, selected: !acc.selected } : acc
      )
    );
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm("Are you sure you want to remove this Gmail account?")) {
      return;
    }

    try {
      const response = await fetch(`${API}/gmail/accounts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
      showToast("Gmail account removed", "success");
    } catch (error) {
      console.error("Error deleting account:", error);
      showToast("Failed to remove Gmail account", "error");
    }
  };

  const handleEditName = (id: number, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveName = async (id: number) => {
    if (!editingName.trim()) {
      showToast("Sender name cannot be empty", "error");
      return;
    }

    try {
      const response = await fetch(`${API}/gmail/accounts/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to update sender name");
      }

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === id ? { ...acc, name: editingName.trim() } : acc
        )
      );
      setEditingId(null);
      setEditingName("");
      showToast("Sender name updated", "success");
    } catch (error) {
      console.error("Error updating sender name:", error);
      showToast("Failed to update sender name", "error");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleContinue = () => {
    const selected = accounts.filter((acc) => acc.selected);

    if (selected.length === 0) {
      showToast("Please select at least one Gmail account", "error");
      return;
    }

    // Store selected accounts for the template page
    localStorage.setItem(
      "selectedSenders",
      JSON.stringify(selected.map((acc) => acc.id))
    );

    router.push("/template");
  };

  if (loading) {
    return (
      <AuthGuard>
        <Container>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-lg text-gray-500">Loading...</div>
          </div>
        </Container>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Container>
        <div className="max-w-3xl mx-auto py-12">
          <h1 className="text-4xl font-bold mb-2">Gmail Accounts</h1>
          <p className="text-gray-600 text-lg mb-8">
            Connect up to 3 Gmail accounts. Each account can send maximum 50 emails.
          </p>

          {/* Connected Accounts */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">Connected Accounts</h2>

            {accounts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No Gmail accounts connected yet. Connect your first account to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center flex-1">
                      <input
                        type="checkbox"
                        checked={account.selected || false}
                        onChange={() => handleToggleSelect(account.id)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="ml-4 flex-1">
                        <p className="font-medium text-gray-900">{account.email}</p>
                        {editingId === account.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              placeholder="Enter sender name"
                              className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveName(account.id)}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-gray-600">
                              Sender name: <span className="font-medium text-gray-900">{account.name}</span>
                            </p>
                            <button
                              onClick={() => handleEditName(account.id, account.name)}
                              className="text-xs text-blue-600 hover:text-blue-700 hover:underline ml-2"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAccount(account.id)}
                      className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Account Button */}
          {accounts.length < 3 && (
            <button
              onClick={handleConnectGmail}
              className="w-full mb-8 bg-blue-600 hover:bg-blue-700 transition-all text-white px-6 py-3 rounded-lg font-semibold"
            >
              ➕ Connect New Gmail Account
            </button>
          )}

          {accounts.length >= 3 && (
            <p className="text-center text-gray-500 mb-8 text-sm">
              Maximum 3 Gmail accounts reached
            </p>
          )}

          {/* Continue Button */}
          {accounts.length > 0 && (
            <div className="flex gap-4">
              <button
                onClick={() => router.push("/upload")}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleContinue}
                disabled={accounts.filter((acc) => acc.selected).length === 0}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 transition-all text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Template →
              </button>
            </div>
          )}
        </div>
      </Container>
    </AuthGuard>
  );
}
