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
        setMessage({ type: "error", text: "Please upload a PDF or DOCX file" });
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
            text: "Resume uploaded successfully!",
          });
          setTimeout(() => {
            router.push("/dashboard/resumes");
          }, 1500);
        } else {
          const data = await response.json();
          setMessage({ type: "error", text: data.message || "Upload failed" });
        }
        setUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong" });
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
        setMessage({ type: "error", text: "Failed to create resume" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong" });
    }
    setUploading(false);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Resume</h1>
        <p className="text-gray-600 mt-1">
          Upload your existing resume or create a new one from scratch
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center mb-6 transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : selectedFile
              ? "border-green-500 bg-green-50"
              : "border-gray-300 hover:border-gray-400"
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
            <FileText className="w-12 h-12 text-green-600 mb-4" />
            <p className="font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-sm text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              onClick={() => setSelectedFile(null)}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Choose different file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">
              Drag and drop your resume here, or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-gray-400">Supports PDF and DOCX</p>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
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
      <div className="flex gap-4">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload Resume"}
        </button>

        <button
          onClick={handleCreateBlank}
          disabled={uploading}
          className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
        >
          Create Blank Resume
        </button>
      </div>
    </div>
  );
}
