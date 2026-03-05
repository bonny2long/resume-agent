"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  Mail,
  Code2,
  Clock,
  Briefcase,
  Building,
} from "lucide-react";

interface OutputFileMeta {
  path: string;
  name: string;
  sizeBytes: number;
  updatedAt: string;
}

interface WorkflowOutput {
  resumeId: string;
  createdAt: string;
  jobTitle: string | null;
  companyName: string | null;
  jobDescription: string;
  files: {
    resume: OutputFileMeta | null;
    coverLetter: OutputFileMeta | null;
    skillsSnapshot: OutputFileMeta | null;
  };
}

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<WorkflowOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const totalFiles = useMemo(
    () =>
      outputs.reduce((count, output) => {
        if (output.files.resume) count += 1;
        if (output.files.coverLetter) count += 1;
        if (output.files.skillsSnapshot) count += 1;
        return count;
      }, 0),
    [outputs],
  );

  useEffect(() => {
    void fetchOutputs();
  }, []);

  const getToken = () =>
    localStorage.getItem("next-auth.session-token") ||
    localStorage.getItem("auth_token") ||
    "dev-token";

  const fetchOutputs = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/files/outputs`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = (await response.json()) as { outputs?: WorkflowOutput[]; message?: string };
      if (!response.ok) {
        setMessage({
          type: "error",
          text: data?.message || "Couldn't load outputs. Try again.",
        });
        return;
      }

      setOutputs(Array.isArray(data.outputs) ? data.outputs : []);
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't load outputs. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: OutputFileMeta) => {
    setDownloadingPath(file.path);
    setMessage(null);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/files/download?path=${encodeURIComponent(file.path)}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        },
      );

      if (!response.ok) {
        let errorMessage = "Couldn't download file. Try again.";
        try {
          const data = (await response.json()) as { message?: string };
          errorMessage = data?.message || errorMessage;
        } catch {
          // no-op
        }
        setMessage({ type: "error", text: errorMessage });
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fromHeader = disposition.match(/filename=\"?([^"]+)\"?/i)?.[1];
      const filename = fromHeader || file.name || "output";

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setMessage({ type: "success", text: `Download complete: ${filename}` });
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't download file. Try again." });
    } finally {
      setDownloadingPath(null);
    }
  };

  const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const renderFileRow = (label: string, file: OutputFileMeta | null, icon: React.ReactNode) => {
    if (!file) return null;
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            {icon}
            <span>{label}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 break-all">{file.path}</p>
          <p className="mt-1 text-xs text-gray-500">
            {formatBytes(file.sizeBytes)} - Updated {new Date(file.updatedAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleDownload(file)}
          disabled={downloadingPath === file.path}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloadingPath === file.path ? (
            <span>Downloading...</span>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download
            </>
          )}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading outputs...</div>
      </div>
    );
  }

  return (
    <div className="ra-page">
      <div className="ra-panel flex items-center justify-between gap-4 p-5 md:p-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Generated Outputs</h1>
            <p className="mt-1 text-slate-600">
              Browse and download resumes, cover letters, and skills snapshots.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 px-5 py-3 text-right">
          <p className="text-2xl font-bold text-blue-900">{totalFiles}</p>
          <p className="text-xs font-medium text-blue-700">Files available</p>
        </div>
      </div>

      {message ? (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {outputs.length === 0 ? (
        <div className="ra-empty">
          <Briefcase className="mb-2 h-11 w-11 text-slate-300" />
          <p className="ra-empty-title">No generated files yet</p>
          <p className="ra-empty-copy">
            Start from Tailor Resume, run a workflow, then come back here to download your resume, cover letter, and skills JSON.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/tailor"
              className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Tailor Resume
            </Link>
            <Link
              href="/dashboard/cover-letter"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Generate Cover Letter
            </Link>
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Upload Resume
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {outputs.map((output) => (
            <div key={output.resumeId} className="ra-panel p-5">
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                  <Building className="h-4 w-4" />
                  <span>{output.companyName || "Unknown Company"}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-sm text-blue-700">
                  <Briefcase className="h-4 w-4" />
                  <span>{output.jobTitle || "Unknown Role"}</span>
                </div>
                <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(output.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                {renderFileRow(
                  "Tailored Resume",
                  output.files.resume,
                  <FileText className="h-4 w-4 text-gray-600" />,
                )}
                {renderFileRow(
                  "Cover Letter",
                  output.files.coverLetter,
                  <Mail className="h-4 w-4 text-gray-600" />,
                )}
                {renderFileRow(
                  "Skills Snapshot",
                  output.files.skillsSnapshot,
                  <Code2 className="h-4 w-4 text-gray-600" />,
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
