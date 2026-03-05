"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Trash2, Copy, Check, FileText } from "lucide-react";

interface CoverLetter {
  id: string;
  jobTitle: string | null;
  companyName: string | null;
  subject: string;
  body: string;
  tone: string | null;
  createdAt: string;
  resume: {
    fullName: string;
  };
}

export default function SavedCoverLettersPage() {
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCl, setSelectedCl] = useState<CoverLetter | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchCoverLetters();
  }, []);

  const fetchCoverLetters = async () => {
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cover-letter`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setCoverLetters(data.coverLetters || []);
      }
    } catch (error) {
      console.error("Failed to fetch cover letters:", error);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cover letter?")) return;

    setDeleting(id);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cover-letter/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setCoverLetters(coverLetters.filter((cl) => cl.id !== id));
      if (selectedCl?.id === id) {
        setSelectedCl(null);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
    setDeleting(null);
  };

  const handleCopy = (cl: CoverLetter) => {
    const text = `Subject: ${cl.subject}\n\n${cl.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading saved cover letters...</div>
      </div>
    );
  }

  return (
    <div className="ra-page">
      <div className="ra-panel flex items-center gap-4 p-5 md:p-6">
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-100"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saved Cover Letters</h1>
          <p className="text-slate-600 mt-1">
            View and manage your saved cover letters
          </p>
        </div>
      </div>

      {coverLetters.length === 0 ? (
        <div className="ra-empty">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="ra-empty-title">No saved cover letters yet</p>
          <p className="ra-empty-copy mb-4">
            Create one from the Cover Letter page, save it, then return here to manage and reuse it.
          </p>
          <Link
            href="/dashboard/cover-letter"
            className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Generate Cover Letter
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-1 space-y-3">
            {coverLetters.map((cl) => (
              <div
                key={cl.id}
                onClick={() => setSelectedCl(cl)}
                className={`ra-panel p-4 cursor-pointer transition-all ${
                  selectedCl?.id === cl.id
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {cl.companyName || cl.jobTitle || "Cover Letter"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(cl.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(cl.id);
                    }}
                    disabled={deleting === cl.id}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            {selectedCl ? (
              <div className="ra-panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedCl.companyName || selectedCl.jobTitle || "Cover Letter"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      For: {selectedCl.resume.fullName} | Created:{" "}
                      {new Date(selectedCl.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(selectedCl)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-500 mb-1">Subject:</p>
                  <p className="text-gray-900 mb-4">{selectedCl.subject}</p>
                  <p className="text-sm font-medium text-gray-500 mb-1">Body:</p>
                  <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-gray-700 max-h-[500px] overflow-y-auto">
                    {selectedCl.body}
                  </div>
                </div>
              </div>
            ) : (
              <div className="ra-empty">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="ra-empty-title">Select a cover letter to preview.</p>
                <p className="ra-empty-copy">Pick a letter on the left, then copy or delete from this panel.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
