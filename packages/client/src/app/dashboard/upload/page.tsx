"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".docx")) {
        setSelectedFile(file);
      } else {
        setMessage({ type: "error", text: "Use a PDF or DOCX file." });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setMessage(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];

        // Get token from localStorage (simplified for dev mode)
        const token =
          localStorage.getItem("next-auth.session-token") ||
          localStorage.getItem("auth_token") ||
          "dev-token";

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/upload`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fileName: selectedFile.name,
              content: base64,
              fullName: "",
              email: "",
            }),
          },
        );

        if (response.ok) {
          setMessage({
            type: "success",
            text: "Upload complete. Redirecting to Resumes to review parsed data.",
          });
          setTimeout(() => {
            router.push("/dashboard/resumes");
          }, 1500);
        } else {
          const data = await response.json();
          setMessage({ type: "error", text: data.message || "Couldn't upload resume. Try again." });
        }
        setUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't upload resume. Try again." });
      setUploading(false);
    }
  };

  const handleCreateBlank = async () => {
    setUploading(true);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: "New Resume",
            summaryShort: "Blank resume",
          }),
        },
      );

      if (response.ok) {
        router.push("/dashboard/resumes");
      } else {
        setMessage({ type: "error", text: "Couldn't create a blank resume. Try again in a few seconds." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't create a blank resume. Try again." });
    }
    setUploading(false);
  };

  return (
    <div className="ra-page">
      <div className="ra-panel p-5 md:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Upload Resume</h1>
        <p className="text-slate-600 mt-1">
          Upload your existing resume or create a new one from scratch
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Drop Zone */}
        <div
          className={`ra-panel border-2 border-dashed p-10 text-center transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50/80"
              : selectedFile
                ? "border-emerald-500 bg-emerald-50/80"
                : "border-slate-300 hover:border-slate-400"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex flex-col items-center">
              <FileText className="w-12 h-12 text-emerald-600 mb-4" />
              <p className="font-semibold text-slate-900">{selectedFile.name}</p>
              <p className="text-sm text-slate-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                onClick={() => setSelectedFile(null)}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-slate-400 mb-4" />
              <p className="text-slate-700 mb-2">
                Drag and drop your resume here, or{" "}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:underline font-medium"
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-slate-500">Supports PDF and DOCX</p>
            </div>
          )}
        </div>

        <div className="ra-panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Upload Tips
          </h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>- Use your most complete master resume.</li>
            <li>- Keep clear section headings for better parsing.</li>
            <li>- Include measurable outcomes in experience bullets.</li>
            <li>- Add project technologies directly in descriptions.</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            The parser creates an immutable upload snapshot used by tailoring.
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white py-3 px-6 font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload Resume"}
        </button>

        <button
          onClick={handleCreateBlank}
          disabled={uploading}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 py-3 px-6 font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          Create Blank Resume
        </button>
      </div>
    </div>
  );
}
