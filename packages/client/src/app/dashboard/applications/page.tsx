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
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        const tailored = (data.resumes || []).filter((r: any) => r.tailoredFromId || r.jobDescription);
        setApplications(tailored);
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
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
            <p className="text-gray-600 mt-1">
              Track your job applications and tailored resumes
            </p>
          </div>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No applications yet</p>
          <p className="text-sm text-gray-400 mb-6">
            Tailor a resume for a job to start tracking your applications
          </p>
          <Link
            href="/dashboard/tailor"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Tailor Resume
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const status = getStatusFromJob(app);
            return (
              <div
                key={app.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
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
                      View
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
