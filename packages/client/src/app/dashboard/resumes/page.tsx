"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FileText, Calendar, Trash2, Link as LinkIcon } from "lucide-react";

interface Resume {
  id: string;
  fullName: string;
  email: string;
  summaryShort: string;
  updatedAt: string;
  createdAt: string;
  experiences: { id: string }[];
  projects: { id: string }[];
  skills: { id: string }[];
  tailoredFromId: string | null;
  jobDescription: string | null;
  resumeData: {
    tailoredFor?: {
      jobTitle?: string;
      companyName?: string;
    };
  } | null;
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resume?")) return;

    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        setResumes(resumes.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete resume:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading resumes...</div>
      </div>
    );
  }

  return (
    <div className="ra-page">
      <div className="ra-panel flex items-center justify-between p-5 md:p-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Resumes</h1>
          <p className="text-slate-600 mt-1">
            {resumes.length} resume{resumes.length !== 1 ? "s" : ""} in your workspace
          </p>
        </div>
        <Link
          href="/dashboard/upload"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Upload Resume
        </Link>
      </div>

      {resumes.length === 0 ? (
        <div className="ra-empty">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="ra-empty-title mb-2">No resumes yet</p>
          <p className="ra-empty-copy mb-4">
            Upload a master resume to start tailoring and generating cover letters.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Upload Resume
            </Link>
            <Link
              href="/dashboard/stories"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Update My Story
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className="ra-panel p-6 hover:border-blue-300 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <button
                  onClick={() => handleDelete(resume.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2 flex-wrap">
                {resume.fullName || "Untitled Resume"}
                {resume.tailoredFromId && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    {resume.resumeData?.tailoredFor?.companyName || resume.resumeData?.tailoredFor?.jobTitle || "Tailored"}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                {resume.summaryShort || "No summary"}
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                <span>{resume.experiences.length} experiences</span>
                <span>{resume.projects.length} projects</span>
                <span>{resume.skills.length} skills</span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-4 h-4" />
                  {new Date(resume.updatedAt).toLocaleDateString()}
                </div>
                <Link
                  href={`/dashboard/resumes/${resume.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Open Resume
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
