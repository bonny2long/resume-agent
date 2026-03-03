"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Plus, 
  FileText, 
  Briefcase, 
  Mail, 
  Users,
  ArrowRight,
  TrendingUp,
  Clock
} from "lucide-react";

interface Stats {
  totalResumes: number;
  tailoredResumes: number;
  storiesCount: number;
}

interface Resume {
  id: string;
  fullName: string;
  summaryShort: string;
  tailoredFromId: string | null;
  createdAt: string;
  resumeData: {
    tailoredFor?: {
      jobTitle?: string;
      companyName?: string;
    };
  } | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalResumes: 0,
    tailoredResumes: 0,
    storiesCount: 0,
  });
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const [resumesRes, storiesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/resumes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (resumesRes.ok) {
        const resumesData = await resumesRes.json();
        const resumes = resumesData.resumes || [];
        setResumes(resumes.slice(0, 5)); // Store first 5 resumes
        const tailored = resumes.filter((r: any) => r.tailoredFromId).length;
        setStats(prev => ({
          ...prev,
          totalResumes: resumes.length,
          tailoredResumes: tailored,
        }));
      }

      if (storiesRes.ok) {
        const storiesData = await storiesRes.json();
        setStats(prev => ({
          ...prev,
          storiesCount: (storiesData.stories?.length || 0) + (storiesData.voiceProfiles?.length || 0),
        }));
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
    setLoading(false);
  };

  const quickActions = [
    {
      title: "Upload Resume",
      description: "Add a new master resume",
      href: "/dashboard/upload",
      icon: Plus,
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      title: "Tailor Resume",
      description: "Create job-specific version",
      href: "/dashboard/tailor",
      icon: Briefcase,
      color: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
      title: "Cover Letter",
      description: "Generate personalized letter",
      href: "/dashboard/cover-letter",
      icon: Mail,
      color: "bg-green-600 hover:bg-green-700",
    },
    {
      title: "My Story",
      description: "Career story & voice",
      href: "/dashboard/stories",
      icon: Users,
      color: "bg-purple-600 hover:bg-purple-700",
    },
  ];

  const steps = [
    {
      title: "Upload your resume",
      description: "Add your master resume with all your experience",
      href: "/dashboard/upload",
    },
    {
      title: "Tell your story",
      description: "Add your career story for personalized applications",
      href: "/dashboard/stories",
    },
    {
      title: "Tailor for jobs",
      description: "Create job-specific resumes optimized for each role",
      href: "/dashboard/tailor",
    },
    {
      title: "Apply with confidence",
      description: "Generate cover letters and land your dream job",
      href: "/dashboard/cover-letter",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome to Resume Agent
        </h1>
        <p className="text-gray-600 mt-1">
          AI-powered job application assistant
        </p>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalResumes}</p>
                <p className="text-sm text-gray-500">Total Resumes</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.tailoredResumes}</p>
                <p className="text-sm text-gray-500">Tailored Versions</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.storiesCount}</p>
                <p className="text-sm text-gray-500">Story Profiles</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Resumes */}
      {resumes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Resumes</h2>
            <Link href="/dashboard/resumes" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumes.map((resume) => (
              <Link
                key={resume.id}
                href={`/dashboard/resumes/${resume.id}`}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 truncate">
                    {resume.fullName || "Untitled"}
                  </h3>
                  {resume.tailoredFromId && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                      {resume.resumeData?.tailoredFor?.companyName || "Tailored"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                  {resume.summaryShort || "No summary"}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(resume.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`p-4 ${action.color} text-white rounded-lg transition group`}
            >
              <div className="flex items-center gap-3 mb-2">
                <action.icon className="w-5 h-5" />
                <span className="font-semibold">{action.title}</span>
              </div>
              <p className="text-sm text-white/80">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Getting Started
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((step, index) => (
            <Link
              key={step.href}
              href={step.href}
              className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition group"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-semibold text-sm group-hover:bg-blue-600 group-hover:text-white transition">
                {index + 1}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 group-hover:text-blue-700">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
