"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Wand2, Loader2, Check } from "lucide-react";

interface Resume {
  id: string;
  fullName: string;
  summaryShort: string;
  createdAt: string;
  tailoredFromId: string | null;
  resumeData: {
    tailoredFor?: {
      jobTitle?: string;
      companyName?: string;
    };
  } | null;
}

export default function TailorPage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setResumes(data.resumes || []);
      }
    } catch (error) {
      console.error("Failed to fetch resumes:", error);
    }
    setLoading(false);
  };

  const handleTailor = async () => {
    if (!selectedResumeId || !jobDescription) {
      setMessage({ type: "error", text: "Please select a resume and enter job description" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/${selectedResumeId}/tailor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jobDescription,
            jobTitle,
            companyName,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: "success", text: "Resume tailored successfully!" });
        setTimeout(() => {
          router.push(`/dashboard/resumes/${data.tailoredResume.id}`);
        }, 1500);
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.message || "Failed to tailor resume" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong" });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tailor Resume</h1>
          <p className="text-gray-600 mt-1">
            Create a job-specific version of your master resume
          </p>
        </div>
      </div>

      {resumes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No resumes found</p>
          <Link
            href="/dashboard/upload"
            className="text-blue-600 hover:underline"
          >
            Upload your first resume
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Select Resume */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                1. Select Master Resume
              </h2>
                <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a resume...</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.tailoredFromId ? `[Tailored: ${resume.resumeData?.tailoredFor?.companyName || resume.resumeData?.tailoredFor?.jobTitle || 'Job'}] ` : ''}{resume.fullName || "Untitled"} - {new Date(resume.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Job Details */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                2. Job Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Title (optional)
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Senior Software Engineer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name (optional)
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Google"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Description *
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={12}
                    placeholder="Paste the full job description here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div
                className={`p-4 rounded-lg flex items-center gap-3 ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                {message.type === "success" ? (
                  <Check className="w-5 h-5" />
                ) : null}
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleTailor}
              disabled={submitting || !selectedResumeId || !jobDescription}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Tailoring...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Tailor Resume
                </>
              )}
            </button>
          </div>

          {/* Preview Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preview
            </h2>
            <div className="text-gray-500 text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Your tailored resume will appear here after processing.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
