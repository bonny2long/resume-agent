"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, FileText, MessageSquare, PenTool } from "lucide-react";

interface CareerStory {
  id: string;
  motivation: string;
  turningPoint: string;
  uniqueValue: string;
  transferableSkills: Record<string, string>;
  content: string;
  updatedAt: string;
}

interface AchievementStory {
  id: string;
  projectName: string;
  role: string;
  timeline: string;
  status: string;
  quantifiableAchievements: string[];
  technicalAchievements: string[];
  keyImpact: string;
}

interface VoiceProfile {
  id: string;
  tone: string;
  style: string;
  examples: string;
  avoidPhrases: string;
}

export default function StoriesPage() {
  const [activeTab, setActiveTab] = useState<"career" | "achievements" | "voice">("career");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAchievement, setSavingAchievement] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [careerStory, setCareerStory] = useState<CareerStory | null>(null);
  const [careerForm, setCareerForm] = useState({
    motivation: "",
    turningPoint: "",
    uniqueValue: "",
  });

  const [achievementStories, setAchievementStories] = useState<AchievementStory[]>([]);
  const [achievementForm, setAchievementForm] = useState({
    projectName: "",
    role: "",
    timeline: "",
    status: "",
    quantifiableAchievements: "",
    technicalAchievements: "",
    keyImpact: "",
  });

  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [voiceForm, setVoiceForm] = useState({
    tone: "professional",
    style: "concise",
    examples: "",
    avoidPhrases: "",
  });

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stories`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        
        const career = data.stories?.find((s: any) => s.type === "career_transition");
        if (career) {
          setCareerStory(career);
          setCareerForm({
            motivation: career.motivation || "",
            turningPoint: career.turningPoint || "",
            uniqueValue: career.uniqueValue || "",
          });
        }

        setAchievementStories(data.achievementStories || []);

        const voice = data.voiceProfiles?.[0];
        if (voice) {
          setVoiceProfile(voice);
          setVoiceForm({
            tone: voice.tone || "professional",
            style: voice.style || "concise",
            examples: voice.examples || "",
            avoidPhrases: voice.avoidPhrases || "",
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch stories:", error);
    }
    setLoading(false);
  };

  const handleSaveCareer = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stories/career`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(careerForm),
        },
      );

      if (response.ok) {
        setMessage({ type: "success", text: "Career story saved!" });
        fetchStories();
      } else {
        setMessage({ type: "error", text: "Failed to save career story" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong" });
    }
    setSaving(false);
  };

  const handleSaveVoice = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stories/voice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(voiceForm),
        },
      );

      if (response.ok) {
        setMessage({ type: "success", text: "Voice profile saved!" });
        fetchStories();
      } else {
        setMessage({ type: "error", text: "Failed to save voice profile" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong" });
    }
    setSaving(false);
  };

  const handleAddAchievement = async () => {
    if (!achievementForm.projectName.trim()) {
      setMessage({ type: "error", text: "Project name is required" });
      return;
    }
    setSavingAchievement(true);
    setMessage(null);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stories/achievement`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(achievementForm),
        },
      );

      if (response.ok) {
        setMessage({ type: "success", text: "Achievement saved!" });
        setAchievementForm({
          projectName: "",
          role: "",
          timeline: "",
          status: "",
          quantifiableAchievements: "",
          technicalAchievements: "",
          keyImpact: "",
        });
        fetchStories();
      } else {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: "error", text: (err as any).message || "Failed to save achievement" });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    }
    setSavingAchievement(false);
  };

  const handleDeleteAchievement = async (id: string) => {
    setDeletingId(id);
    setMessage(null);
    try {
      const token =
        localStorage.getItem("next-auth.session-token") ||
        localStorage.getItem("auth_token") ||
        "dev-token";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stories/achievement/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        setMessage({ type: "success", text: "Achievement deleted" });
        fetchStories();
      } else {
        setMessage({ type: "error", text: "Failed to delete achievement" });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    }
    setDeletingId(null);
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
        <h1 className="text-2xl font-bold text-gray-900">My Story</h1>
        <p className="text-gray-600 mt-1">
          Tell your career story and establish your professional voice
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {[
            { id: "career", label: "Career Story", icon: FileText },
            { id: "achievements", label: "Achievements", icon: Plus },
            { id: "voice", label: "Voice Profile", icon: PenTool },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
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

      {/* Career Story Tab */}
      {activeTab === "career" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Career Transition Story
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Share your career journey to help AI personalize your applications.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivation
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Why are you making this career change? What drives you?
            </p>
            <textarea
              value={careerForm.motivation}
              onChange={(e) => setCareerForm({ ...careerForm, motivation: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="I'm transitioning from marketing to software engineering because..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Turning Point
            </label>
            <p className="text-xs text-gray-500 mb-2">
              What moment or realization sparked this change?
            </p>
            <textarea
              value={careerForm.turningPoint}
              onChange={(e) => setCareerForm({ ...careerForm, turningPoint: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="During the pandemic, I started learning to code and discovered..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unique Value
            </label>
            <p className="text-xs text-gray-500 mb-2">
              What unique perspective do you bring from your previous career?
            </p>
            <textarea
              value={careerForm.uniqueValue}
              onChange={(e) => setCareerForm({ ...careerForm, uniqueValue: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="My background in marketing gives me a unique understanding of user needs..."
            />
          </div>

          <button
            onClick={handleSaveCareer}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save Career Story"}
          </button>
        </div>
      )}

      {/* Achievements Tab */}
      {activeTab === "achievements" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Achievement Stories
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Document your key achievements with quantifiable results.
            </p>

            {achievementStories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No achievement stories yet. Add your first one!
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {achievementStories.map((story) => (
                  <div
                    key={story.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {story.projectName}
                        </h3>
                        <p className="text-sm text-gray-600">{story.role}</p>
                        <p className="text-xs text-gray-400 mt-1">{story.timeline}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAchievement(story.id)}
                        disabled={deletingId === story.id}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {story.keyImpact && (
                      <p className="text-sm text-gray-600 mt-2">{story.keyImpact}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h3 className="font-medium text-gray-900">Add New Achievement</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={achievementForm.projectName}
                    onChange={(e) => setAchievementForm({ ...achievementForm, projectName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="E-commerce Platform Redesign"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Role
                  </label>
                  <input
                    type="text"
                    value={achievementForm.role}
                    onChange={(e) => setAchievementForm({ ...achievementForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Lead Developer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Impact
                </label>
                <textarea
                  value={achievementForm.keyImpact}
                  onChange={(e) => setAchievementForm({ ...achievementForm, keyImpact: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Led a team of 5 developers to rebuild the entire customer-facing platform, resulting in 40% increase in conversion rates..."
                />
              </div>

              <button
                onClick={handleAddAchievement}
                disabled={savingAchievement}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
                {savingAchievement ? "Saving..." : "Save Achievement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Profile Tab */}
      {activeTab === "voice" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Voice Profile
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Define your writing style to help AI generate content that sounds like you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tone
              </label>
              <select
                value={voiceForm.tone}
                onChange={(e) => setVoiceForm({ ...voiceForm, tone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="enthusiastic">Enthusiastic</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Style
              </label>
              <select
                value={voiceForm.style}
                onChange={(e) => setVoiceForm({ ...voiceForm, style: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
                <option value="narrative">Narrative</option>
                <option value="bullet">Bullet Points</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Example Phrases You Like
            </label>
            <textarea
              value={voiceForm.examples}
              onChange={(e) => setVoiceForm({ ...voiceForm, examples: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="I thrive in fast-paced environments where I can...&#10;Led cross-functional teams to deliver..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phrases to Avoid
            </label>
            <textarea
              value={voiceForm.avoidPhrases}
              onChange={(e) => setVoiceForm({ ...voiceForm, avoidPhrases: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Hard worker...&#10;Team player...&#10;Results-driven..."
            />
          </div>

          <button
            onClick={handleSaveVoice}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save Voice Profile"}
          </button>
        </div>
      )}
    </div>
  );
}
