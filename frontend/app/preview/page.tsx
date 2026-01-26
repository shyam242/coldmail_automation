"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/src/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL;

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

  /* ---------------- LOAD STORED DATA ---------------- */
  useEffect(() => {
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

  /* ---------------- GENERATE PREVIEW ---------------- */
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

  /* ---------------- SEND EMAILS ---------------- */
  const handleSendEmails = async () => {
    if (!csvData || senders.length === 0) {
      showToast("Missing senders or CSV data", "error");
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const totalEmails = csvData.rows.length;

      /* Upload CSV */
      setProgressMessage("Uploading CSV...");
      setProgress(10);

      const csvContent = [
        csvData.headers.join(","),
        ...csvData.rows.map((row) => row.join(",")),
      ].join("\n");

      const formData = new FormData();
      formData.append("file", new Blob([csvContent], { type: "text/csv" }), "leads.csv");

      const uploadRes = await fetch(`${API}/upload-csv`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadRes.ok) throw new Error("CSV upload failed");

      const { csv_id } = await uploadRes.json();

      /* Send emails */
      setProgress(40);
      setProgressMessage("Sending emails...");

      const sendRes = await fetch(`${API}/send-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          csvId: csv_id,
          senders,
          template,
          totalEmails,
        }),
      });

      if (!sendRes.ok) throw new Error("Email sending failed");

      setProgress(100);
      setProgressMessage("Emails sent successfully!");

      showToast(`Successfully sent ${totalEmails} emails`, "success");

      localStorage.clear();

      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Something went wrong", "error");
      setLoading(false);
      setProgress(0);
    }
  };

  if (!csvData || !template) {
    return (
      <AuthGuard>
        <Container>
          <p className="py-10 text-center">Loading...</p>
        </Container>
      </AuthGuard>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <AuthGuard>
      <Container>
        <div className="py-10">
          <h1 className="text-5xl font-bold mb-3">Preview & Send</h1>
          <p className="text-gray-600 mb-8">
            {csvData.rows.length} leads • {senders.length} sender(s)
          </p>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Preview */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
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
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold">SUBJECT</p>
                    <p className="font-bold">{preview.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">BODY</p>
                    <div className="border p-4 rounded whitespace-pre-wrap">
                      {preview.body}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action */}
            <div className="space-y-4">
              {!loading ? (
                <button
                  onClick={handleSendEmails}
                  className="w-full bg-green-600 text-white py-4 rounded-lg font-bold"
                >
                  🚀 Send Emails
                </button>
              ) : (
                <div className="bg-white p-6 rounded shadow">
                  <p className="text-center font-semibold mb-2">
                    {progressMessage}
                  </p>
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
