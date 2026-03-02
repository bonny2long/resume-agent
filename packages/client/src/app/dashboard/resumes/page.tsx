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
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Resumes</h1>
          <p className="text-gray-600 mt-1">
            {resumes.length} resume{resumes.length !== 1 ? "s" : ""} in your
            bank
          </p>
        </div>
        <Link
          href="/dashboard/upload"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add Resume
        </Link>
      </div>

      {resumes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No resumes yet</p>
          <Link
            href="/dashboard/upload"
            className="text-blue-600 hover:underline"
          >
            Upload your first resume
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition"
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
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
