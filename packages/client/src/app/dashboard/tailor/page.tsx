"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Wand2, Loader2, Check, Link2, Briefcase, Mail, Download } from "lucide-react";

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
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<OrchestratorResult | null>(
    null,
  );
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
        let data: any = null;
        try {
          data = await response.json();
        } catch {
          // no-op
        }
        const detail =
          data?.error ? `${data.message || "Failed to tailor resume"}: ${data.error}` :
          data?.message ? data.message
          : `Failed to tailor resume (HTTP ${response.status})`;
        console.error("Tailor request failed", { status: response.status, data });
        setMessage({ type: "error", text: detail });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong" });
    }
    setSubmitting(false);
  };

  const handleParseJobUrl = async () => {
    if (!jobUrl.trim()) {
      setMessage({ type: "error", text: "Please enter a job posting URL first" });
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
        setMessage({ type: "error", text: data.message || "Failed to parse job URL" });
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

      setMessage({ type: "success", text: "Imported job description from URL" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to fetch job posting URL" });
    }

    setParsingUrl(false);
  };

  const handleRunApplicationWorkflow = async () => {
    if (!selectedResumeId || !jobUrl.trim()) {
      setMessage({
        type: "error",
        text: "Select a resume and provide a job posting URL to run the full workflow",
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
          text: data?.message || "Failed to run application workflow",
        });
        return;
      }

      setWorkflowResult(data.result || null);
      setMessage({
        type: "success",
        text: "Application workflow completed. Review hiring manager, LinkedIn, and email drafts in Preview.",
      });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to run application workflow" });
    }

    setWorkflowSubmitting(false);
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
        let errorMessage = "Failed to download file";
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
      setMessage({ type: "error", text: "Failed to download file" });
    } finally {
      setDownloadingPath(null);
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

      {masterResumes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No master resumes found</p>
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
                <option value="">Choose a master resume...</option>
                {masterResumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.fullName || "Untitled"} - {new Date(resume.createdAt).toLocaleDateString()}
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

            <button
              onClick={handleRunApplicationWorkflow}
              disabled={workflowSubmitting || !selectedResumeId || !jobUrl.trim()}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {workflowSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running Full Workflow...
                </>
              ) : (
                <>
                  <Briefcase className="w-5 h-5" />
                  Run Full Apply Workflow
                </>
              )}
            </button>
          </div>

          {/* Preview Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
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

                <div className="space-y-2 text-sm text-gray-700">
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
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
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
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">
                      {workflowResult.followUpEmail.body}
                    </p>
                  </div>
                ) : null}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Workflow Summary</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {workflowResult.summary}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Your tailored resume or full workflow output will appear here after processing.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
