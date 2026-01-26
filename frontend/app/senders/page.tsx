"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/src/components/Toast";

type Sender = {
  id: string;
  name: string;
  email: string;
  smtp: string;
  port: string;
  password: string;
  selected: boolean;
};

export default function SendersPage() {
  const router = useRouter();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    smtp: "smtp.gmail.com",
    port: "587",
    password: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("senders");
    if (saved) {
      setSenders(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const handleAddSender = () => {
    if (!formData.name || !formData.email || !formData.smtp || !formData.password) {
      showToast("Please fill all sender details", "error");
      return;
    }

    const newSender: Sender = {
      id: Date.now().toString(),
      ...formData,
      selected: false,
    };

    const updated = [...senders, newSender];
    setSenders(updated);
    localStorage.setItem("senders", JSON.stringify(updated));

    setFormData({
      name: "",
      email: "",
      smtp: "",
      port: "587",
      password: "",
    });

    showToast(`Sender '${formData.name}' added successfully!`, "success");
  };

  const handleToggleSender = (id: string) => {
    const updated = senders.map(sender =>
      sender.id === id ? { ...sender, selected: !sender.selected } : sender
    );
    setSenders(updated);
    localStorage.setItem("senders", JSON.stringify(updated));
  };

  const handleDeleteSender = (id: string) => {
    const updated = senders.filter(sender => sender.id !== id);
    setSenders(updated);
    localStorage.setItem("senders", JSON.stringify(updated));
    showToast("Sender deleted successfully!", "success");
  };

  const handleContinue = () => {
    const selectedSenders = senders.filter(s => s.selected);
    if (selectedSenders.length === 0) {
      showToast("Please select at least one sender", "error");
      return;
    }

    localStorage.setItem("selectedSenders", JSON.stringify(selectedSenders));
    showToast("Senders selected! Moving to email template...", "success");
    router.push("/template");
  };

  return (
    <AuthGuard>
      <Container>
        <div className="py-8">
          <h1 className="text-5xl font-bold mb-2">Sender Setup</h1>
          <p className="text-gray-600 text-lg mb-8">
            Add your SMTP email accounts. Each sender can send maximum 50 emails.
          </p>

          {/* Add New Sender Form */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">Add New Sender</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <input
                type="text"
                placeholder="Sender Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <input
                type="text"
                value={formData.smtp}
                onChange={(e) =>
                  setFormData({ ...formData, smtp: e.target.value })
                }
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="Port"
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({ ...formData, port: e.target.value })
                  }
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="md:col-span-2 relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password or App Password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-500 hover:text-gray-700 transition"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>
            <button
              onClick={handleAddSender}
              className="w-full bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
            >
              Add Sender
            </button>
          </div>

          {/* Senders List */}
          {senders.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <h2 className="text-2xl font-bold">Your Senders</h2>
              </div>

              <div className="space-y-4 p-6">
                {senders.map((sender) => (
                  <div
                    key={sender.id}
                    className="border rounded-lg p-6 flex items-start gap-4 hover:bg-gray-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={sender.selected}
                      onChange={() => handleToggleSender(sender.id)}
                      className="w-5 h-5 mt-1 accent-brand cursor-pointer"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{sender.name}</h3>
                      <p className="text-gray-600">{sender.email}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {sender.smtp}:{sender.port}
                      </p>
                      <p className="text-xs text-orange-600 mt-2">
                        Max 50 emails per sending
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteSender(sender.id)}
                      className="text-red-500 hover:text-red-700 font-semibold px-4 py-2 rounded hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>

              {senders.length > 0 && (
                <div className="bg-gray-50 px-6 py-4 border-t">
                  <p className="text-sm text-gray-600 mb-4">
                    {senders.filter(s => s.selected).length} of {senders.length} senders selected
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => router.push("/upload")}
                      className="px-8 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-50 transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleContinue}
                      disabled={senders.filter(s => s.selected).length === 0}
                      className="flex-1 bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                    >
                      Continue to Email Template →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {senders.length === 0 && !loading && (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-600 mb-4">No senders added yet</p>
              <p className="text-sm text-gray-500">
                Add at least one sender to continue
              </p>
            </div>
          )}
        </div>
      </Container>
    </AuthGuard>
  );
}
