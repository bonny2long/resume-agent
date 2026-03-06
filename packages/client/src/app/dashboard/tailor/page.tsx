"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Wand2, Loader2, Check, Link2, Briefcase, Mail, Download, Search } from "lucide-react";

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

interface OrchestratorEmailDraft {
  to: string;
  subject: string;
  body: string;
  tone: string;
  type: string;
}

interface OrchestratorResult {
  applicationId: string;
  jobTitle: string;
  companyName: string;
  resumePath: string;
  coverLetterPath: string;
  skillsSnapshotPath?: string;
  hiringManagerName?: string;
  hiringManagerLinkedIn?: string;
  linkedInMessage?: string;
  followUpEmail?: OrchestratorEmailDraft;
  summary: string;
}

interface HiringManagerCandidate {
  name?: string;
  title?: string;
  linkedInUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  confidence?: number;
  source?: string;
  verified?: boolean;
}

interface HiringManagerLookupResult {
  jobId: string;
  jobTitle: string;
  companyName: string;
  searchMethod: string;
  topMatch?: HiringManagerCandidate | null;
  savedHiringManager?: HiringManagerCandidate | null;
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
  const [jobUrl, setJobUrl] = useState("");
  const [parsingUrl, setParsingUrl] = useState(false);
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);
  const [findingManager, setFindingManager] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<OrchestratorResult | null>(
    null,
  );
  const [hiringManagerResult, setHiringManagerResult] =
    useState<HiringManagerLookupResult | null>(null);
  const masterResumes = resumes.filter((resume) => !resume.tailoredFromId);

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
        const allResumes = data.resumes || [];
        setResumes(allResumes);
        const latestMaster = allResumes.find((resume: Resume) => !resume.tailoredFromId);
        if (!selectedResumeId && latestMaster?.id) {
          setSelectedResumeId(latestMaster.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch resumes:", error);
    }
    setLoading(false);
  };

  const handleTailor = async () => {
    if (!selectedResumeId || !jobDescription) {
      setMessage({
        type: "error",
        text: "Select a master resume and provide a job description (or import from URL) to tailor.",
      });
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
        setMessage({ type: "success", text: "Tailor complete. Opening your tailored resume." });
        setTimeout(() => {
          router.push(`/dashboard/resumes/${data.tailoredResume.id}`);
        }, 1500);
      } else {
        let data: any = null;
        try {
          data = await response.json();
        } catch {
          // no-op
        }
        const detail =
          data?.error ? `${data.message || "Couldn't tailor resume"}: ${data.error}` :
          data?.message ? data.message
          : `Couldn't tailor resume (HTTP ${response.status})`;
        console.error("Tailor request failed", { status: response.status, data });
        setMessage({ type: "error", text: detail });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't tailor resume. Try again." });
    }
    setSubmitting(false);
  };

  const handleParseJobUrl = async () => {
    if (!jobUrl.trim()) {
      setMessage({ type: "error", text: "Enter a job posting URL to import." });
      return;
    }

    setParsingUrl(true);
    setMessage(null);

    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/jobs/parse-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: jobUrl.trim() }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: data.message || "Couldn't import the job URL. Try again." });
        return;
      }

      const parsed = data.job || {};
      if (typeof parsed.jobDescription === "string" && parsed.jobDescription.trim()) {
        setJobDescription(parsed.jobDescription.trim());
      }
      if (!jobTitle && typeof parsed.jobTitle === "string" && parsed.jobTitle.trim()) {
        setJobTitle(parsed.jobTitle.trim());
      }
      if (!companyName && typeof parsed.companyName === "string" && parsed.companyName.trim()) {
        setCompanyName(parsed.companyName.trim());
      }

      setMessage({ type: "success", text: "Import complete. Job details added from URL." });
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't import the job URL. Try again." });
    }

    setParsingUrl(false);
  };

  const handleRunApplicationWorkflow = async () => {
    if (!selectedResumeId || !jobUrl.trim()) {
      setMessage({
        type: "error",
        text: "Select a resume and enter a job posting URL to run the workflow.",
      });
      return;
    }

    setWorkflowSubmitting(true);
    setMessage(null);
    setWorkflowResult(null);

    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/agents/application-orchestrator`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jobUrl: jobUrl.trim(),
            resumeId: selectedResumeId,
            enhanced: true,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        setMessage({
          type: "error",
          text: data?.message || "Couldn't run the workflow. Try again.",
        });
        return;
      }

      setWorkflowResult(data.result || null);
      setMessage({
        type: "success",
        text: "Workflow complete. Review outputs and outreach drafts in Preview.",
      });
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't run the workflow. Try again." });
    }

    setWorkflowSubmitting(false);
  };

  const handleFindHiringManager = async () => {
    if (!jobUrl.trim()) {
      setMessage({
        type: "error",
        text: "Enter a job posting URL to find a hiring manager.",
      });
      return;
    }

    setFindingManager(true);
    setMessage(null);

    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/agents/hiring-manager-finder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jobUrl: jobUrl.trim(),
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        setMessage({
          type: "error",
          text: data?.message || "Couldn't find a hiring manager. Try again.",
        });
        return;
      }

      setHiringManagerResult(data.result || null);
      setMessage({
        type: "success",
        text: "Lookup complete. Review confidence and contact details in Preview.",
      });
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't find a hiring manager. Try again." });
    }

    setFindingManager(false);
  };

  const handleDownloadOutput = async (filePath: string) => {
    if (!filePath) return;
    setDownloadingPath(filePath);

    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/files/download?path=${encodeURIComponent(filePath)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        let errorMessage = "Couldn't download file. Try again.";
        try {
          const data = await response.json();
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
      const fromPath = filePath.split(/[\\/]/).pop();
      const filename = fromHeader || fromPath || "output";

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't download file. Try again." });
    } finally {
      setDownloadingPath(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading resume options...</div>
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
          <h1 className="text-2xl font-bold text-slate-900">Tailor Resume</h1>
          <p className="text-slate-600 mt-1">
            Create a job-specific version of your master resume
          </p>
        </div>
      </div>

      {masterResumes.length === 0 ? (
        <div className="ra-empty">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="ra-empty-title">No master resumes found</p>
          <p className="ra-empty-copy mb-4">
            Upload a master resume first. Tailoring, workflow orchestration, and hiring-manager search all start from it.
          </p>
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Upload Resume
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,860px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,900px)_minmax(0,780px)]">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Select Resume */}
            <div className="ra-panel p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                1. Select Master Resume
              </h2>
                <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a master resume...</option>
                {masterResumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.fullName || "Untitled"} - {new Date(resume.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Job Details */}
            <div className="ra-panel p-6">
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
                    Job Posting URL (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                      placeholder="https://jobs.company.com/..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleParseJobUrl}
                      disabled={parsingUrl || !jobUrl.trim()}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {parsingUrl ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      {parsingUrl ? "Importing..." : "Import URL"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Description *
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={12}
                    placeholder="Paste the full job description, or import it from a URL above..."
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={handleTailor}
                disabled={submitting || !selectedResumeId || !jobDescription}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-6 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

              <button
                onClick={handleFindHiringManager}
                disabled={findingManager || !jobUrl.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 px-6 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {findingManager ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Finding Hiring Manager...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Find Hiring Manager
                  </>
                )}
              </button>
            </div>
            <button
              onClick={handleRunApplicationWorkflow}
              disabled={workflowSubmitting || !selectedResumeId || !jobUrl.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-6 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {workflowSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running Workflow...
                </>
              ) : (
                <>
                  <Briefcase className="w-5 h-5" />
                  Run Full Workflow
                </>
              )}
            </button>
          </div>

          {/* Preview Section */}
          <div className="ra-panel overflow-x-hidden p-6 xl:sticky xl:top-24 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto xl:min-w-[520px]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preview
            </h2>
            {workflowResult ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-emerald-900">
                    {workflowResult.jobTitle} at {workflowResult.companyName}
                  </p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Application ID: {workflowResult.applicationId}
                  </p>
                </div>

                <div className="space-y-2 text-sm text-gray-700 break-all">
                  <p><span className="font-medium">Resume Output:</span> {workflowResult.resumePath}</p>
                  <button
                    type="button"
                    onClick={() => handleDownloadOutput(workflowResult.resumePath)}
                    disabled={downloadingPath === workflowResult.resumePath}
                    className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingPath === workflowResult.resumePath ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Download Resume
                  </button>
                  <p><span className="font-medium">Cover Letter Output:</span> {workflowResult.coverLetterPath}</p>
                  <button
                    type="button"
                    onClick={() => handleDownloadOutput(workflowResult.coverLetterPath)}
                    disabled={downloadingPath === workflowResult.coverLetterPath}
                    className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingPath === workflowResult.coverLetterPath ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Download Cover Letter
                  </button>
                  {workflowResult.skillsSnapshotPath ? (
                    <>
                      <p><span className="font-medium">Skills Snapshot:</span> {workflowResult.skillsSnapshotPath}</p>
                      <button
                        type="button"
                        onClick={() => handleDownloadOutput(workflowResult.skillsSnapshotPath!)}
                        disabled={downloadingPath === workflowResult.skillsSnapshotPath}
                        className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloadingPath === workflowResult.skillsSnapshotPath ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        Download Skills JSON
                      </button>
                    </>
                  ) : null}
                  <p><span className="font-medium">Hiring Manager:</span> {workflowResult.hiringManagerName || "Not found"}</p>
                  <p><span className="font-medium">Hiring Manager LinkedIn:</span> {workflowResult.hiringManagerLinkedIn || "Not available"}</p>
                </div>

                {workflowResult.linkedInMessage ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">LinkedIn Message Draft</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {workflowResult.linkedInMessage}
                    </p>
                  </div>
                ) : null}

                {workflowResult.followUpEmail ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Follow-up Email Draft
                    </p>
                    <p className="text-xs text-blue-800 mb-1">
                      To: {workflowResult.followUpEmail.to || "(add recipient email)"}
                    </p>
                    <p className="text-xs text-blue-800 mb-3">
                      Subject: {workflowResult.followUpEmail.subject}
                    </p>
                    <p className="text-sm text-blue-900 whitespace-pre-wrap break-words">
                      {workflowResult.followUpEmail.body}
                    </p>
                  </div>
                ) : null}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Workflow Summary</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-all">
                    {workflowResult.summary}
                  </p>
                </div>
              </div>
            ) : hiringManagerResult ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-900">
                    Hiring Manager Lookup
                  </p>
                  <p className="text-xs text-slate-700 mt-1">
                    {hiringManagerResult.jobTitle} at {hiringManagerResult.companyName}
                  </p>
                </div>

                {(() => {
                  const manager =
                    hiringManagerResult.savedHiringManager ||
                    hiringManagerResult.topMatch ||
                    null;
                  if (!manager) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-900">
                          No strong hiring manager match found yet.
                        </p>
                        <p className="mt-1 text-xs text-amber-800">
                          Next: verify company name in URL import, then run lookup again or run full workflow for broader signals.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 space-y-2">
                      <p>
                        <span className="font-medium">Name:</span> {manager.name || "Not available"}
                      </p>
                      <p>
                        <span className="font-medium">Title:</span> {manager.title || "Not available"}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span> {manager.email || "Not available"}
                      </p>
                      <p>
                        <span className="font-medium">LinkedIn:</span> {manager.linkedInUrl || "Not available"}
                      </p>
                      <p>
                        <span className="font-medium">Confidence:</span>{" "}
                        {typeof manager.confidence === "number" ? `${manager.confidence}%` : "N/A"}
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Your workflow preview will appear here.</p>
                <p className="mt-1 text-sm text-gray-400">
                  Next: import a job URL, then run Tailor Resume, Find Hiring Manager, or Run Full Workflow.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
