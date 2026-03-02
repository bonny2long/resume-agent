"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Wand2, Loader2, Copy, Check, Save } from "lucide-react";

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

export default function CoverLetterPage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tone, setTone] = useState("professional");
  
  const [coverLetter, setCoverLetter] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleGenerate = async () => {
    if (!selectedResumeId || !jobDescription) {
      setMessage({ type: "error", text: "Please select a resume and enter job description" });
      return;
    }

    setGenerating(true);
    setMessage(null);
    setCoverLetter(null);

    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cover-letter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            resumeId: selectedResumeId,
            jobDescription,
            jobTitle,
            companyName,
            tone,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        
        if (!data.coverLetter) {
          setMessage({ type: "error", text: "No cover letter returned from server" });
          setGenerating(false);
          return;
        }
        
        let cl = data.coverLetter;
        
        if (typeof cl === 'string') {
          try {
            cl = JSON.parse(cl);
          } catch {
            cl = { subject: 'Cover Letter', body: cl };
          }
        }
        
        if (cl && typeof cl.body === 'string') {
          let bodyText = cl.body.trim();
          
          if (bodyText.startsWith('{') || bodyText.startsWith('[')) {
            try {
              const parsed = JSON.parse(bodyText);
              bodyText = parsed.body || parsed.text || bodyText;
              if (parsed.subject) cl.subject = parsed.subject;
            } catch {}
          }
          
          bodyText = bodyText.replace(/^```json\n?/, '').replace(/```$/, '').trim();
          
          cl.body = bodyText;
        }
        
        if (cl && !cl.subject && jobTitle) {
          cl.subject = `Application for ${jobTitle} at ${companyName || 'the company'}`;
        }
        
        setCoverLetter(cl);
        setMessage({ type: "success", text: "Cover letter generated! Click Save to store it." });
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage({ type: "error", text: data?.message || "Failed to generate cover letter" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Something went wrong" });
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!coverLetter || !selectedResumeId) return;
    
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cover-letter/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            resumeId: selectedResumeId,
            jobTitle,
            companyName,
            jobDescription,
            subject: coverLetter.subject,
            body: coverLetter.body,
            tone,
          }),
        },
      );

      if (response.ok) {
        setMessage({ type: "success", text: "Cover letter saved!" });
      } else {
        setMessage({ type: "error", text: "Failed to save cover letter" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save" });
    }
  };

  const handleCopy = () => {
    if (!coverLetter) return;
    const text = `Subject: ${coverLetter.subject}\n\n${coverLetter.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <h1 className="text-2xl font-bold text-gray-900">Cover Letter</h1>
          <p className="text-gray-600 mt-1">
            Generate a personalized cover letter for your job application
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
                1. Select Resume
              </h2>
              <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a resume...</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.tailoredFromId ? `[${resume.resumeData?.tailoredFor?.companyName || resume.resumeData?.tailoredFor?.jobTitle || 'Tailored'}] ` : ''}{resume.fullName || "Untitled"} - {new Date(resume.createdAt).toLocaleDateString()}
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
                    Tone
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="professional">Professional</option>
                    <option value="enthusiastic">Enthusiastic</option>
                    <option value="friendly">Friendly</option>
                    <option value="formal">Formal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Description *
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={10}
                    placeholder="Paste the full job description here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedResumeId || !jobDescription}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Generate Cover Letter
                </>
              )}
            </button>
            
            {coverLetter && (
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700"
              >
                <Save className="w-5 h-5" />
                Save Cover Letter
              </button>
            )}
          </div>

          {/* Preview Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Preview
              </h2>
              {coverLetter && (
                <button
                  onClick={handleCopy}
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
              )}
            </div>
            
            {coverLetter ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Subject:</p>
                  <p className="text-gray-900">{coverLetter.subject}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Body:</p>
                  <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-gray-700 max-h-[500px] overflow-y-auto">
                    {coverLetter.body}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Your cover letter will appear here after generation.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
