"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/src/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL as string;

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

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    try {
      const csv = localStorage.getItem("csvData");
      const senderIds = localStorage.getItem("selectedSenders");
      const tmp = localStorage.getItem("emailTemplate");

      if (!csv || !senderIds || !tmp) {
        showToast("Missing data. Please complete previous steps.", "error");
        router.push("/upload");
        return;
      }

      setCSVData(JSON.parse(csv));
      setSenders(JSON.parse(senderIds)); // This will be an array of IDs
      setTemplate(JSON.parse(tmp));
    } catch {
      showToast("Failed to load stored data", "error");
      router.push("/upload");
    }
  }, [router]);

  /* ---------------- PREVIEW ---------------- */
  useEffect(() => {
    if (!csvData || !template) return;

    const row = csvData.rows[previewIndex];
    const map: Record<string, string> = {};

    csvData.headers.forEach((h, i) => (map[h] = row[i] || ""));

    let subject = template.subject;
    let body = template.body;

    csvData.headers.forEach((h) => {
      subject = subject.replaceAll(`{${h}}`, map[h]);
      body = body.replaceAll(`{${h}}`, map[h]);
    });

    setPreview({ subject, body });
  }, [csvData, template, previewIndex]);

  /* ---------------- SEND ---------------- */
  const handleSendEmails = async () => {
    if (!csvData || senders.length === 0) {
      showToast("CSV or sender accounts missing", "error");
      return;
    }

    setLoading(true);
    setProgress(10);
    setProgressMessage("Uploading CSV...");

    try {
      const csvText = [
        csvData.headers.join(","),
        ...csvData.rows.map((r) => r.join(",")),
      ].join("\n");

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([csvText], { type: "text/csv" }),
        "leads.csv"
      );

      const uploadRes = await fetch(`${API}/upload-csv`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadRes.ok) throw new Error("CSV upload failed");

      const uploadJson = await uploadRes.json();
      const csvId = uploadJson?.csv_id;

      if (!csvId) throw new Error("Invalid CSV response");

      setProgress(40);
      setProgressMessage("Sending emails via Gmail API...");

      // Send emails using Gmail API with selected sender account IDs
      const sendRes = await fetch(`${API}/send-emails`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvId,
          senderAccountIds: senders, // Array of Gmail account IDs
          template,
        }),
      });

      if (!sendRes.ok) {
        const error = await sendRes.json();
        throw new Error(error.error || "Email sending failed");
      }

      const sendJson = await sendRes.json();
      setProgress(100);
      setProgressMessage(`${sendJson.emailsSent} emails sent successfully!`);

      showToast(`Emails sent successfully (${sendJson.emailsSent} emails)`, "success");

      localStorage.clear();

      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err: unknown) {
      console.error("Send error:", err);

      let msg = "Something went wrong";

      if (err instanceof Error) msg = err.message;
      else if (typeof err === "string") msg = err;

      showToast(msg, "error");
      setLoading(false);
      setProgress(0);
    }
  };

  /* ---------------- UI ---------------- */
  if (!csvData || !template) {
    return (
      <AuthGuard>
        <Container>
          <p className="text-center py-10">Loading…</p>
        </Container>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <Container>
        <div className="py-10">
          <h1 className="text-5xl font-bold mb-4">Preview & Send</h1>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* PREVIEW */}
            <div className="lg:col-span-2 bg-white p-6 rounded shadow">
              <select
                value={previewIndex}
                onChange={(e) => setPreviewIndex(Number(e.target.value))}
                className="w-full border px-4 py-2 rounded mb-4"
              >
                {csvData.rows.map((_, i) => (
                  <option key={i} value={i}>
                    Row {i + 1}
                  </option>
                ))}
              </select>

              {preview && (
                <>
                  <p className="font-bold mb-2">{preview.subject}</p>
                  <div className="border p-4 rounded whitespace-pre-wrap">
                    {preview.body}
                  </div>
                </>
              )}
            </div>

            {/* ACTION */}
            <div className="space-y-4">
              {!loading ? (
                <button
                  onClick={handleSendEmails}
                  className="w-full bg-green-600 text-white py-4 rounded-lg font-bold"
                >
                  🚀 Send Emails
                </button>
              ) : (
                <div className="bg-white p-4 rounded shadow">
                  <p className="text-center mb-2">{progressMessage}</p>
                  <div className="w-full bg-gray-200 h-3 rounded">
                    <div
                      className="bg-green-600 h-3 rounded transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push("/template")}
                className="w-full border py-3 rounded"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </Container>
    </AuthGuard>
  );
}
