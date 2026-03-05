"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Plus, 
  Briefcase, 
  Building,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Trash2
} from "lucide-react";

interface Application {
  id: string;
  fullName: string;
  jobDescription: string;
  createdAt: string;
  tailoredFromId: string | null;
}

const statusColors: Record<string, string> = {
  interested: "bg-blue-100 text-blue-700",
  applied: "bg-yellow-100 text-yellow-700",
  interview: "bg-purple-100 text-purple-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newApp, setNewApp] = useState({
    jobTitle: "",
    companyName: "",
    resumeId: "",
  });

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/applications`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    }
    setLoading(false);
  };

  const getStatusFromJob = (app: Application): string => {
    if (app.jobDescription?.toLowerCase().includes("applied")) return "applied";
    if (app.jobDescription?.toLowerCase().includes("interview")) return "interview";
    return "interested";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading applications...</div>
      </div>
    );
  }

  return (
    <div className="ra-page">
      <div className="ra-panel flex items-center justify-between p-5 md:p-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
            <p className="text-slate-600 mt-1">
              Track application status and tailored resumes
            </p>
          </div>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="ra-empty">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="ra-empty-title">No applications yet</p>
          <p className="ra-empty-copy mb-5">
            Start by tailoring a resume for a target role. Tailored resumes automatically appear in this tracker.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/tailor"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Tailor Resume
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
          {applications.map((app) => {
            const status = getStatusFromJob(app);
            return (
              <div
                key={app.id}
                className="ra-panel p-4 transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Building className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {app.fullName || "Tailored Resume"}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {app.jobDescription?.slice(0, 200) || "No job description"}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                      {statusLabels[status]}
                    </span>
                    <Link
                      href={`/dashboard/resumes/${app.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View Resume
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
