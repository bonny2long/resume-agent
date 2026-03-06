"use client";

import { useState, useEffect } from "react";
import { Save, Key, Settings as SettingsIcon, Github, Globe, Loader2 } from "lucide-react";

interface UserSettings {
  id: string;
  preferredLlm: string;
  enableWebScraping: boolean;
  enableGithubSync: boolean;
  enableLinkedIn: boolean;
  anthropicKey: string;
  openaiKey: string;
  cohereKey: string;
  geminiKey: string;
}

interface GitHubSyncResult {
  repositoriesSynced: number;
  repositoriesProcessed: number;
  skillsExtracted: number;
  resumeSync: {
    added: number;
    updated: number;
    total: number;
  };
  skillsBankPath: string;
  topSkills: Array<{
    name: string;
    confidence: number;
    category?: string;
    source: "language" | "topic" | "readme";
    repositories: string[];
  }>;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [githubToken, setGithubToken] = useState("");
  const [githubSyncResult, setGithubSyncResult] = useState<GitHubSyncResult | null>(null);
  const [githubSyncMessage, setGithubSyncMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [form, setForm] = useState({
    preferredLlm: "anthropic",
    enableWebScraping: true,
    enableGithubSync: true,
    enableLinkedIn: false,
    anthropicKey: "",
    openaiKey: "",
    cohereKey: "",
    geminiKey: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/settings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        setGithubToken(localStorage.getItem("resume_agent_github_token") || "");
        setForm({
          preferredLlm: data.settings.preferredLlm || "anthropic",
          enableWebScraping: data.settings.enableWebScraping ?? true,
          enableGithubSync: data.settings.enableGithubSync ?? true,
          enableLinkedIn: data.settings.enableLinkedIn ?? false,
          anthropicKey: data.settings.anthropicKey || "",
          openaiKey: data.settings.openaiKey || "",
          cohereKey: data.settings.cohereKey || "",
          geminiKey: data.settings.geminiKey || "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        },
      );

      if (response.ok) {
        localStorage.setItem("resume_agent_github_token", githubToken.trim());
        setMessage({
          type: "success",
          text: "Save complete. Restart the server if you changed API keys so providers reload.",
        });
        fetchSettings();
      } else {
        setMessage({ type: "error", text: "Couldn't save settings. Try again." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Couldn't save settings. Try again." });
    }
    setSaving(false);
  };

  const handleSyncGitHubSkills = async () => {
    setSyncingGithub(true);
    setMessage(null);
    setGithubSyncResult(null);
    setGithubSyncMessage({ type: "info", text: "Sync started. Checking GitHub repositories..." });
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      localStorage.setItem("resume_agent_github_token", githubToken.trim());

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/github/sync-skills`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            githubToken: githubToken.trim() || undefined,
            saveToResume: true,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const isRouteMissing = response.status === 404;
        const text = isRouteMissing
          ? "GitHub sync endpoint not found. Restart the server so new routes load."
          : data?.error || data?.message || "Couldn't sync GitHub skills. Try again.";
        setGithubSyncMessage({
          type: "error",
          text,
        });
        setMessage({
          type: "error",
          text,
        });
        return;
      }

      setGithubSyncResult((data?.result || null) as GitHubSyncResult | null);
      setGithubSyncMessage({
        type: "success",
        text: "Sync complete. Skills bank generated and resume skills updated.",
      });
      setMessage({
        type: "success",
        text: "GitHub sync complete. Skills bank updated and ready for job matching.",
      });
    } catch (error) {
      setGithubSyncMessage({
        type: "error",
        text: "Couldn't sync GitHub skills. Check token/server and try again.",
      });
      setMessage({
        type: "error",
        text: "Couldn't sync GitHub skills. Try again.",
      });
    } finally {
      setSyncingGithub(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="ra-page">
      <div className="ra-panel p-5 md:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">
          Configure your API keys and preferences
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* AI Providers */}
      <div className="ra-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Key className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Providers</h2>
            <p className="text-sm text-gray-600">Configure your API keys</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred LLM Provider
            </label>
            <select
              value={form.preferredLlm}
              onChange={(e) => setForm({ ...form, preferredLlm: e.target.value })}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
              <option value="cohere">Cohere</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={form.anthropicKey}
                onChange={(e) => setForm({ ...form, anthropicKey: e.target.value })}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">For resume parsing & generation</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={form.openaiKey}
                onChange={(e) => setForm({ ...form, openaiKey: e.target.value })}
                placeholder="sk-proj-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cohere API Key
              </label>
              <input
                type="password"
                value={form.cohereKey}
                onChange={(e) => setForm({ ...form, cohereKey: e.target.value })}
                placeholder="..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={form.geminiKey}
                onChange={(e) => setForm({ ...form, geminiKey: e.target.value })}
                placeholder="..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="ra-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Features</h2>
            <p className="text-sm text-gray-600">Enable or disable features</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enableWebScraping}
              onChange={(e) => setForm({ ...form, enableWebScraping: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">Enable Web Scraping</span>
            </div>
            <span className="text-xs text-gray-500">(For job posting analysis)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enableGithubSync}
              onChange={(e) => setForm({ ...form, enableGithubSync: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <div className="flex items-center gap-2">
              <Github className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">Enable GitHub Sync</span>
            </div>
            <span className="text-xs text-gray-500">(For project extraction)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enableLinkedIn}
              onChange={(e) => setForm({ ...form, enableLinkedIn: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">Enable LinkedIn Integration</span>
            <span className="text-xs text-gray-500">(For hiring manager research)</span>
          </label>
        </div>
      </div>

      {/* GitHub Skills Bank */}
      <div className="ra-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Github className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">GitHub Skills Bank</h2>
            <p className="text-sm text-gray-600">
              Sync repositories, extract skills, and refresh the skill bank used by job match scoring.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              For dev mode, this token is stored in browser local storage on this device.
            </p>
          </div>
          <button
            onClick={handleSyncGitHubSkills}
            disabled={syncingGithub || !form.enableGithubSync}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncingGithub ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing GitHub...
              </>
            ) : (
              "Sync GitHub Skills"
            )}
          </button>
        </div>

        {!form.enableGithubSync ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
            Enable GitHub Sync above to run this action.
          </p>
        ) : null}

        {githubSyncMessage ? (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              githubSyncMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : githubSyncMessage.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {githubSyncMessage.text}
          </div>
        ) : null}

        {githubSyncResult ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-emerald-900">
              Sync Summary
            </p>
            <p className="text-sm text-emerald-800">
              Repositories synced: {githubSyncResult.repositoriesSynced}
            </p>
            <p className="text-sm text-emerald-800">
              Skills extracted: {githubSyncResult.skillsExtracted}
            </p>
            <p className="text-sm text-emerald-800">
              Resume skills added: {githubSyncResult.resumeSync.added}
            </p>
            <p className="text-xs text-emerald-700 break-all">
              Skills bank JSON: {githubSyncResult.skillsBankPath}
            </p>
          </div>
        ) : null}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        {saving ? "Saving..." : "Save Settings"}
      </button>
      <p className="text-xs text-slate-500">
        Next: run Tailor Resume or Generate Cover Letter to validate your keys.
      </p>
    </div>
  );
}
