"use client";

import Container from "@/src/components/container";
import AuthGuard from "@/src/components/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/src/components/Toast";

type CSVData = {
  headers: string[];
  rows: string[][];
};

export default function UploadPage() {
  const { authenticated } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [csvData, setCSVData] = useState<CSVData | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim());
        const rows = lines.slice(1).map(line => 
          line.split(",").map(cell => cell.trim())
        );
        
        setCSVData({ headers, rows });
        showToast("CSV uploaded successfully!", "success");
      } catch (error) {
        showToast("Error parsing CSV file", "error");
      }
    };
    reader.readAsText(file);
  };

  const handleAddColumn = () => {
    if (!csvData || !newColumnName.trim()) {
      showToast("Please enter a column name", "error");
      return;
    }

    const updatedData: CSVData = {
      headers: [...csvData.headers, newColumnName],
      rows: csvData.rows.map(row => [...row, ""]),
    };

    setCSVData(updatedData);
    setNewColumnName("");
    showToast(`Column '${newColumnName}' added successfully!`, "success");
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!csvData) return;

    const updatedRows = csvData.rows.map((row, idx) =>
      idx === rowIndex
        ? row.map((cell, cidx) => (cidx === colIndex ? value : cell))
        : row
    );

    setCSVData({
      headers: csvData.headers,
      rows: updatedRows,
    });
  };

  const handleSaveAndContinue = async () => {
    if (!csvData) {
      showToast("Please upload a CSV file first", "error");
      return;
    }

    // Check for required columns
    if (!csvData.headers.includes("email")) {
      showToast("CSV must contain 'email' column", "error");
      return;
    }

    setLoading(true);

    try {
      // Save to localStorage for next steps
      localStorage.setItem("csvData", JSON.stringify(csvData));

      showToast("CSV saved! Moving to senders setup...", "success");
      router.push("/senders");
    } catch (error) {
      showToast("Error saving CSV", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <Container>
        <div className="py-8">
          <h1 className="text-5xl font-bold mb-2">Upload CSV</h1>
          <p className="text-gray-600 text-lg mb-8">
            Upload your leads CSV file containing name, email, and company information
          </p>

          {!csvData ? (
            <div className="bg-gray-50 border-2 border-dashed border-brand rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-2xl font-bold mb-2">Drop your CSV here</h3>
              <p className="text-gray-600 mb-6">
                CSV should contain: name, email, and company columns
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
              >
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-8">
              {/* CSV Preview Section */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <h2 className="text-2xl font-bold">CSV Preview & Edit</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    {csvData.rows.length} rows, {csvData.headers.length} columns
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        {csvData.headers.map((header, idx) => (
                          <th
                            key={idx}
                            className="px-4 py-3 text-left text-sm font-semibold text-gray-700"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, 10).map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b hover:bg-gray-50">
                          {row.map((cell, colIdx) => (
                            <td key={colIdx} className="px-4 py-3">
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) =>
                                  handleCellChange(rowIdx, colIdx, e.target.value)
                                }
                                className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {csvData.rows.length > 10 && (
                  <div className="px-6 py-3 bg-gray-50 text-center text-sm text-gray-600">
                    Showing 10 of {csvData.rows.length} rows
                  </div>
                )}
              </div>

              {/* Add Column Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">Add New Column</h3>
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Column name (e.g., phone, industry)"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddColumn()}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <button
                    onClick={handleAddColumn}
                    className="bg-brand text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
                  >
                    Add Column
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setCSVData(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-8 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-50 transition"
                >
                  Upload Different CSV
                </button>
                <button
                  onClick={handleSaveAndContinue}
                  disabled={loading}
                  className="flex-1 bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Continue to Senders Setup →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Container>
    </AuthGuard>
  );
}
