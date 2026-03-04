"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Briefcase,
  Code,
  GraduationCap,
  Database,
  FileText,
  Link as LinkIcon,
  Wand2,
  Target,
  Users,
  Loader2,
} from "lucide-react";

interface Resume {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedInUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  summaryShort: string;
  summaryLong: string;
  updatedAt: string;
  createdAt: string;
  experiences: Experience[];
  projects: Project[];
  skills: Skill[];
  education: Education[];
  certifications: Certification[];
  resumeData: any;
  rawText: string;
  tailoredFromId: string | null;
  jobDescription: string | null;
}

interface Experience {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  url: string;
  startDate: string;
  endDate: string | null;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  proficiency: string;
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string | null;
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
}

export default function ResumeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "details" | "experience" | "projects" | "skills" | "education" | "data" | "agents"
  >("details");
  const [agentRunning, setAgentRunning] = useState<string | null>(null);
  const [lastAgentType, setLastAgentType] = useState<string | null>(null);
  const [agentResults, setAgentResults] = useState<any>(null);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);

  useEffect(() => {
    fetchResume();
  }, [params.id]);

  const fetchResume = async () => {
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/${params.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setResume(data.resume);
      }
    } catch (error) {
      console.error("Failed to fetch resume:", error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!resume) return;

    setSaving(true);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/${resume.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: resume.fullName,
            email: resume.email,
            phone: resume.phone,
            location: resume.location,
            summaryShort: resume.summaryShort,
            summaryLong: resume.summaryLong,
            linkedInUrl: resume.linkedInUrl,
            githubUrl: resume.githubUrl,
            portfolioUrl: resume.portfolioUrl,
          }),
        },
      );
    } catch (error) {
      console.error("Failed to save:", error);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!resume) return;
    if (!confirm("Are you sure you want to delete this resume? This cannot be undone.")) return;

    setSaving(true);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/${resume.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        router.push("/dashboard/resumes");
      } else {
        alert("Failed to delete resume");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
    setSaving(false);
  };

  const handleRegenerateSummary = async () => {
    if (!resume) return;
    setRegeneratingSummary(true);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/${resume.id}/regenerate-summary`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setResume({ ...resume, summaryShort: data.summaryShort, summaryLong: data.summaryLong });
      } else {
        console.error("Failed to regenerate summary");
      }
    } catch (error) {
      console.error("Failed to regenerate summary:", error);
    }
    setRegeneratingSummary(false);
  };

  const runAgent = async (agentType: string) => {
    if (!resume) return;
    
    setAgentRunning(agentType);
    setLastAgentType(agentType);
    setAgentResults(null);
    
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const endpoints: Record<string, string> = {
        quantify: "/api/agents/quantify-achievements",
        harvard: "/api/agents/harvard-summary",
        ats: "/api/agents/ats-optimize",
        behavioral: "/api/agents/behavioral-coach",
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${endpoints[agentType]}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ resumeId: resume.id }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setAgentResults(data.result);
      } else {
        const data = await response.json();
        alert(data.message || "Agent failed");
      }
    } catch (error) {
      console.error("Agent failed:", error);
    }
    setAgentRunning(null);
  };

  const renderAgentResults = () => {
    if (!agentResults) return null;

    if (lastAgentType === "harvard" && Array.isArray(agentResults.summaries)) {
      return (
        <div className="space-y-3">
          {agentResults.summaries.map((item: any, index: number) => (
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                {item.style || `Version ${index + 1}`}
              </p>
              <p className="text-sm text-gray-800">{item.text || ""}</p>
            </div>
          ))}
        </div>
      );
    }

    if (lastAgentType === "quantify" && Array.isArray(agentResults.achievements)) {
      return (
        <div className="space-y-3">
          {agentResults.achievements.map((item: any, index: number) => (
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                {item.category || "achievement"}
              </p>
              <p className="text-sm text-gray-700 mb-2">{item.original || ""}</p>
              <p className="text-sm text-gray-900 font-medium">{item.rewritten || ""}</p>
            </div>
          ))}
        </div>
      );
    }

    if (lastAgentType === "behavioral" && Array.isArray(agentResults.stories)) {
      return (
        <div className="space-y-3">
          {agentResults.stories.map((story: any, index: number) => (
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                {story.category || "story"}
              </p>
              <p className="text-sm text-gray-900 font-medium mb-2">{story.question || ""}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Situation:</span> {story.situation || ""}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Task:</span> {story.task || ""}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Action:</span> {story.action || ""}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Result:</span> {story.result || ""}</p>
            </div>
          ))}
        </div>
      );
    }

    if (lastAgentType === "ats") {
      return (
        <div className="space-y-4">
          {typeof agentResults.score === "number" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                ATS Score: <span className="font-semibold">{agentResults.score}/100</span>
              </p>
            </div>
          )}
          {Array.isArray(agentResults.suggestions) && agentResults.suggestions.length > 0 && (
            <div className="space-y-2">
              {agentResults.suggestions.map((suggestion: any, index: number) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-800">{suggestion.text || ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-[500px] overflow-y-auto">
        {JSON.stringify(agentResults, null, 2)}
      </pre>
    );
  };

  const handleAddExperience = async () => {
    if (!resume) return;

    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/resumes/${resume.id}/experiences`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company: "New Company",
            jobTitle: "Job Title",
            startDate: new Date().toISOString(),
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setResume({
          ...resume,
          experiences: [...resume.experiences, data.experience],
        });
      }
    } catch (error) {
      console.error("Failed to add experience:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Resume not found</p>
        <Link
          href="/dashboard/resumes"
          className="text-blue-600 hover:underline mt-2 inline-block"
        >
          Back to Resumes
        </Link>
      </div>
    );
  }

  const displayProjects =
    resume.projects.length > 0
      ? resume.projects
      : Array.isArray(resume.resumeData?.projects)
        ? resume.resumeData.projects.map((project: any, index: number) => ({
            id: `resume-data-${index}`,
            name: project?.name || `Project ${index + 1}`,
            description: project?.description || "",
            url: "",
            startDate: "",
            endDate: null,
          }))
        : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/resumes"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {resume.fullName || "Untitled Resume"}
              </h1>
              {resume.tailoredFromId && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                  Tailored
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm">
              Last updated: {new Date(resume.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          <Trash2 className="w-5 h-5" />
          Delete
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6 overflow-x-auto">
          {[
            { id: "details", label: "Details", icon: Briefcase },
            { id: "experience", label: "Experience", icon: Briefcase },
            { id: "projects", label: "Projects", icon: Code },
            { id: "skills", label: "Skills", icon: Code },
            { id: "education", label: "Education", icon: GraduationCap },
            { id: "agents", label: "AI Agents", icon: Wand2 },
            { id: "data", label: "Raw Data", icon: Database },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "details" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={resume.fullName}
                onChange={(e) =>
                  setResume({ ...resume, fullName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={resume.email}
                onChange={(e) =>
                  setResume({ ...resume, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={resume.phone}
                onChange={(e) =>
                  setResume({ ...resume, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={resume.location}
                onChange={(e) =>
                  setResume({ ...resume, location: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={resume.linkedInUrl || ""}
                onChange={(e) =>
                  setResume({ ...resume, linkedInUrl: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GitHub URL
              </label>
              <input
                type="url"
                value={resume.githubUrl || ""}
                onChange={(e) =>
                  setResume({ ...resume, githubUrl: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">Summary</span>
            <button
              onClick={handleRegenerateSummary}
              disabled={regeneratingSummary}
              className="flex items-center gap-1.5 text-sm bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {regeneratingSummary ? "Generating..." : "Regenerate from Story"}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary (Short)
            </label>
            <textarea
              value={resume.summaryShort}
              onChange={(e) =>
                setResume({ ...resume, summaryShort: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary (Long)
            </label>
            <textarea
              value={resume.summaryLong || ""}
              onChange={(e) =>
                setResume({ ...resume, summaryLong: e.target.value })
              }
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {activeTab === "experience" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleAddExperience}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Experience
            </button>
          </div>
          {resume.experiences.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No experiences added yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {resume.experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white border border-gray-200 rounded-lg p-6"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {exp.title}
                      </h3>
                      <p className="text-gray-600">{exp.company}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {new Date(exp.startDate).toLocaleDateString()} -{" "}
                        {exp.current
                          ? "Present"
                          : exp.endDate
                            ? new Date(exp.endDate).toLocaleDateString()
                            : ""}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-3">{exp.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "projects" && (
        <div className="space-y-4">
          {displayProjects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Code className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No projects added yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayProjects.map((project: Project) => (
                <div
                  key={project.id}
                  className="bg-white border border-gray-200 rounded-lg p-6"
                >
                  <h3 className="font-semibold text-gray-900">
                    {project.name}
                  </h3>
                  <p className="text-gray-600 mt-2">{project.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "skills" && (
        <div className="space-y-4">
          {resume.skills.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Code className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No skills added yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {resume.skills.map((skill) => (
                <span
                  key={skill.id}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "education" && (
        <div className="space-y-4">
          {resume.education.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No education added yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {resume.education.map((edu) => (
                <div
                  key={edu.id}
                  className="bg-white border border-gray-200 rounded-lg p-6"
                >
                  <h3 className="font-semibold text-gray-900">
                    {edu.degree} in {edu.field}
                  </h3>
                  <p className="text-gray-600">{edu.institution}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "data" && (
        <div className="space-y-6">
          {/* Tailored Resume Info */}
          {resume.tailoredFromId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <LinkIcon className="w-5 h-5" />
                <span className="font-medium">Tailored Resume</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                This resume was tailored from your master resume for a specific job.
              </p>
              {resume.jobDescription && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-yellow-800">Job Description:</p>
                  <p className="text-sm text-yellow-700 mt-1 max-h-32 overflow-y-auto">
                    {resume.jobDescription.slice(0, 500)}...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Raw Text */}
          {resume.rawText && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Raw Text</h3>
              </div>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                {resume.rawText}
              </pre>
            </div>
          )}

          {/* Resume Data JSON */}
          {resume.resumeData && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Full Resume Data (JSON)</h3>
              </div>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                {JSON.stringify(resume.resumeData, null, 2)}
              </pre>
            </div>
          )}

          {!resume.rawText && !resume.resumeData && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No raw data stored for this resume</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "agents" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Resume Enhancement Agents</h3>
            <p className="text-sm text-gray-600 mb-6">
              Run AI agents to enhance your resume with quantifiable achievements, professional summaries, ATS optimization, and interview prep.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => runAgent("quantify")}
                disabled={agentRunning !== null}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">Quantify Achievements</span>
                </div>
                <p className="text-sm text-gray-500">Add metrics and quantifiable impact to your achievements (McKinsey-style)</p>
              </button>

              <button
                onClick={() => runAgent("harvard")}
                disabled={agentRunning !== null}
                className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Harvard Summaries</span>
                </div>
                <p className="text-sm text-gray-500">Generate 5 professional summary versions</p>
              </button>

              <button
                onClick={() => runAgent("ats")}
                disabled={agentRunning !== null}
                className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Code className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-gray-900">ATS Optimizer</span>
                </div>
                <p className="text-sm text-gray-500">Optimize for applicant tracking systems (Google-style)</p>
              </button>

              <button
                onClick={() => runAgent("behavioral")}
                disabled={agentRunning !== null}
                className="p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-orange-600" />
                  <span className="font-medium text-gray-900">Interview Coach</span>
                </div>
                <p className="text-sm text-gray-500">Generate STAR method stories for behavioral interviews</p>
              </button>
            </div>

            {agentRunning && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-blue-700">Running {agentRunning} agent...</span>
              </div>
            )}
          </div>

          {agentResults && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Results</h3>
              {renderAgentResults()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
