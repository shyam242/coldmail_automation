"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/src/components/Toast";

type CSVData = {
  headers: string[];
  rows: string[][];
};

type Sender = {
  id: string;
  name: string;
  email: string;
  smtp: string;
  port: string;
  password: string;
  selected: boolean;
};

type Template = {
  subject: string;
  body: string;
};

export default function PreviewPage() {
  const router = useRouter();
  const [csvData, setCSVData] = useState<CSVData | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  useEffect(() => {
    // Load all data from localStorage
    const csvSaved = localStorage.getItem("csvData");
    const sendersSaved = localStorage.getItem("selectedSenders");
    const templateSaved = localStorage.getItem("emailTemplate");

    if (!csvSaved || !sendersSaved || !templateSaved) {
      showToast("Missing required data. Please complete all steps.", "error");
      router.push("/upload");
      return;
    }

    setCSVData(JSON.parse(csvSaved));
    setSenders(JSON.parse(sendersSaved));
    setTemplate(JSON.parse(templateSaved));
  }, [router]);

  // Generate preview whenever previewIndex or template changes
  useEffect(() => {
    if (!csvData || !template) return;

    const row = csvData.rows[previewIndex];
    const dataMap: Record<string, string> = {};

    csvData.headers.forEach((header, idx) => {
      dataMap[header] = row[idx] || "";
    });

    let subject = template.subject;
    let body = template.body;

    csvData.headers.forEach((header) => {
      const regex = new RegExp(`\\{${header}\\}`, "g");
      subject = subject.replace(regex, dataMap[header]);
      body = body.replace(regex, dataMap[header]);
    });

    setPreview({ subject, body });
  }, [csvData, template, previewIndex]);

  const handleSendEmails = async () => {
    if (!csvData || senders.length === 0) {
      showToast("Missing senders or CSV data", "error");
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const totalEmails = csvData.rows.length;
      setProgressMessage(`Preparing to send ${totalEmails} emails...`);

      // Save CSV first
      setProgressMessage("Uploading CSV file...");
      setProgress(10);

      const csvContent = [
        csvData.headers.join(","),
        ...csvData.rows.map(row => row.join(",")),
      ].join("\n");

      const formData = new FormData();
      const blob = new Blob([csvContent], { type: "text/csv" });
      formData.append("file", blob, "leads.csv");

      const uploadRes = await fetch("http://localhost:8000/upload-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload CSV");
      }

      const uploadData = await uploadRes.json();
      const csvId = uploadData.csv_id;

      setProgress(30);
      setProgressMessage("Saving email configuration...");

      // Send emails through backend
      const sendRes = await fetch("http://localhost:8000/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          csvId,
          senders,
          template,
          totalEmails,
        }),
      });

      if (!sendRes.ok) {
        throw new Error("Failed to send emails");
      }

      // Simulate progress updates
      setProgress(50);
      setProgressMessage("Sending emails...");

      // Wait a bit to show progress
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProgress(75);
      setProgressMessage("Recording sent emails...");

      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(100);
      setProgressMessage("Done! Emails sent successfully.");

      showToast(`Successfully sent ${totalEmails} emails!`, "success");

      // Clear localStorage
      localStorage.removeItem("csvData");
      localStorage.removeItem("selectedSenders");
      localStorage.removeItem("emailTemplate");
      localStorage.removeItem("senders");

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (error) {
      console.error("Error sending emails:", error);
      showToast("Error sending emails: " + (error instanceof Error ? error.message : "Unknown error"), "error");
      setLoading(false);
      setProgress(0);
    }
  };

  if (!csvData || !template) {
    return (
      <AuthGuard>
        <Container>
          <div className="py-8 text-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        </Container>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Container>
        <div className="py-8">
          <h1 className="text-5xl font-bold mb-2">Preview & Send</h1>
          <p className="text-gray-600 text-lg mb-8">
            Review your emails before sending. You have {csvData.rows.length} leads and{" "}
            {senders.length} sender{senders.length !== 1 ? "s" : ""} (max{" "}
            {senders.length * 50} emails total).
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Preview Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Row Selector */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <label className="block text-sm font-semibold mb-3">
                  Preview Email
                </label>
                <select
                  value={previewIndex}
                  onChange={(e) => setPreviewIndex(Number(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand mb-4"
                >
                  {csvData.rows.map((_, idx) => (
                    <option key={idx} value={idx}>
                      Row {idx + 1} ({csvData.rows[idx][csvData.headers.indexOf("name")] || "No name"})
                    </option>
                  ))}
                </select>

                {preview && (
                  <div className="bg-gray-50 rounded-lg p-6 border">
                    <div className="mb-6">
                      <p className="text-xs text-gray-600 font-semibold mb-1">TO</p>
                      <p className="text-gray-700">
                        {csvData.rows[previewIndex][csvData.headers.indexOf("email")]}
                      </p>
                    </div>

                    <div className="mb-6">
                      <p className="text-xs text-gray-600 font-semibold mb-1">SUBJECT</p>
                      <p className="text-lg font-bold text-gray-900">
                        {preview.subject}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 font-semibold mb-2">BODY</p>
                      <div className="bg-white p-4 rounded border text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {preview.body}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CSV Summary */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">Leads Summary</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Total Leads:</span> {csvData.rows.length}
                  </p>
                  <p>
                    <span className="font-semibold">Email Column:</span>{" "}
                    {csvData.headers.includes("email") ? "✓ Found" : "✗ Missing"}
                  </p>
                  <p>
                    <span className="font-semibold">Available Columns:</span>{" "}
                    {csvData.headers.join(", ")}
                  </p>
                </div>
              </div>
            </div>

            {/* Senders & Send Button */}
            <div className="space-y-6">
              {/* Senders Summary */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">Senders ({senders.length})</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {senders.map((sender) => (
                    <div key={sender.id} className="p-3 bg-gray-50 rounded">
                      <p className="font-semibold text-gray-900">{sender.name}</p>
                      <p className="text-sm text-gray-600">{sender.email}</p>
                      <p className="text-xs text-orange-600 mt-1">Max 50 emails</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <p className="text-sm text-blue-900 mb-3">
                  <span className="font-semibold">Sending Stats:</span>
                </p>
                <div className="space-y-2 text-sm">
                  <p>Leads: {csvData.rows.length}</p>
                  <p>Senders: {senders.length}</p>
                  <p className="font-semibold text-blue-900">
                    Total Emails: {Math.min(csvData.rows.length, senders.length * 50)}
                  </p>
                </div>
              </div>

              {/* Send Button */}
              {!loading ? (
                <>
                  <button
                    onClick={handleSendEmails}
                    disabled={loading}
                    className="w-full bg-green-600 text-white px-6 py-4 rounded-lg font-bold text-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    🚀 Start Sending Emails
                  </button>

                  {/* Back Button */}
                  <button
                    onClick={() => router.push("/template")}
                    className="w-full px-6 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-50 transition"
                  >
                    Back to Template
                  </button>
                </>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
                  <h3 className="text-lg font-bold text-center">Sending Emails...</h3>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-green-600 h-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-center text-gray-600 font-semibold">
                      {progress}%
                    </p>
                  </div>

                  {/* Progress Message */}
                  <p className="text-center text-gray-700">
                    {progressMessage}
                  </p>

                  {/* Animated dots */}
                  <div className="flex justify-center gap-1">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </AuthGuard>
  );
}
