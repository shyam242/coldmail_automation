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

export default function TemplatePage() {
  const router = useRouter();
  const [csvData, setCSVData] = useState<CSVData | null>(null);
  const [template, setTemplate] = useState({
    subject: "",
    body: "",
  });
  const [preview, setPreview] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [previewRowIndex, setPreviewRowIndex] = useState(0);

  useEffect(() => {
    // Load CSV data from localStorage
    const saved = localStorage.getItem("csvData");
    if (saved) {
      setCSVData(JSON.parse(saved));
    } else {
      showToast("No CSV data found. Please upload CSV first.", "error");
      router.push("/upload");
    }
  }, [router]);

  const generatePreview = (rowIndex: number) => {
    if (!csvData || !template.subject || !template.body) return;

    const row = csvData.rows[rowIndex];
    const dataMap: Record<string, string> = {};

    csvData.headers.forEach((header, idx) => {
      dataMap[header] = row[idx] || "";
    });

    // Replace placeholders
    let subject = template.subject;
    let body = template.body;

    csvData.headers.forEach((header) => {
      const regex = new RegExp(`\\{${header}\\}`, "g");
      subject = subject.replace(regex, dataMap[header]);
      body = body.replace(regex, dataMap[header]);
    });

    setPreview({ subject, body });
  };

  useEffect(() => {
    if (csvData && template.subject && template.body) {
      generatePreview(previewRowIndex);
    }
  }, [template, previewRowIndex, csvData]);

  const handleSave = () => {
    if (!template.subject || !template.body) {
      showToast("Please fill subject and body", "error");
      return;
    }

    localStorage.setItem("emailTemplate", JSON.stringify(template));
    showToast("Template saved! Moving to preview...", "success");
    router.push("/preview");
  };

  return (
    <AuthGuard>
      <Container>
        <div className="py-8">
          <h1 className="text-5xl font-bold mb-2">Email Template</h1>
          <p className="text-gray-600 text-lg mb-8">
            Create your email template. Use {"{"}name{"}"}, {"{"}company{"}"} etc. to add dynamic content.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Template Editor */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-4">Template Editor</h2>

                {/* Available Placeholders */}
                {csvData && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Available placeholders:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {csvData.headers.map((header) => (
                        <span
                          key={header}
                          className="bg-blue-200 text-blue-900 px-3 py-1 rounded text-sm cursor-pointer hover:bg-blue-300 transition"
                          onClick={() => {
                            setTemplate((prev) => ({
                              ...prev,
                              body: prev.body + `{${header}}`,
                            }));
                          }}
                          title="Click to insert"
                        >
                          {"{"}
                          {header}
                          {"}"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject Input */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={template.subject}
                    onChange={(e) =>
                      setTemplate({ ...template, subject: e.target.value })
                    }
                    placeholder="e.g., Meeting with {name} at {company}"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Body Input */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Email Body
                  </label>
                  <textarea
                    value={template.body}
                    onChange={(e) =>
                      setTemplate({ ...template, body: e.target.value })
                    }
                    placeholder="Dear {name},&#10;&#10;I wanted to reach out to you at {company}..."
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand h-64"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-4">Preview</h2>

                {/* Row Selector */}
                {csvData && csvData.rows.length > 1 && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">
                      Preview with row:
                    </label>
                    <select
                      value={previewRowIndex}
                      onChange={(e) => setPreviewRowIndex(Number(e.target.value))}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {csvData.rows.map((_, idx) => (
                        <option key={idx} value={idx}>
                          Row {idx + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {preview ? (
                  <div className="bg-gray-50 rounded-lg p-6 border">
                    <div className="mb-4">
                      <p className="text-xs text-gray-600 font-semibold">SUBJECT</p>
                      <p className="text-lg font-bold text-gray-900">
                        {preview.subject || "(empty subject)"}
                      </p>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-xs text-gray-600 font-semibold">BODY</p>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {preview.body || "(empty body)"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                    <p>Add subject and body to see preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => router.push("/senders")}
              className="px-8 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-50 transition"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
            >
              Continue to Preview & Send →
            </button>
          </div>
        </div>
      </Container>
    </AuthGuard>
  );
}
