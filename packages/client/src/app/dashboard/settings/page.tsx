"use client";

import { useState, useEffect } from "react";
import { Save, Key, Settings as SettingsIcon, Github, Globe } from "lucide-react";

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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [settings, setSettings] = useState<UserSettings | null>(null);
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
        setMessage({ type: "success", text: "Settings saved!" });
        fetchSettings();
      } else {
        setMessage({ type: "error", text: "Failed to save settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong" });
    }
    setSaving(false);
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure your API keys and preferences
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* AI Providers */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
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
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
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

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
