import Anthropic from "@anthropic-ai/sdk";
import {
  getJobWebScraperService,
  ScrapedJobPosting,
} from "../services/job-web-scraper.js";

export interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MatchResult {
  score: number;
  matched: string[];
  missing: string[];
  extras: string[];
}

export interface JobAnalysis {
  title: string;
  company: string;
  location: string;
  salary?: string;
  jobType?: string;
  remote?: boolean;
  requiredSkills: string[];
  preferredSkills: string[];
  requiredYearsExperience?: number;
  educationRequired?: string;
  responsibilities: string[];
  qualifications: string[];
  benefits?: string[];
  keywords: string[];
  experienceLevel:
    | "entry"
    | "junior"
    | "mid"
    | "senior"
    | "staff"
    | "principal"
    | "executive";
  techStack: string[];
  industryKeywords: string[];
  postedDate?: Date;
  applicationDeadline?: Date;
  originalUrl: string;
  rawDescription: string;
}

const COMMON_SKILLS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "Go",
  "Rust",
  "SQL",
  "React",
  "Next.js",
  "Node.js",
  "Express",
  "Django",
  "Flask",
  "FastAPI",
  "GraphQL",
  "REST",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "CI/CD",
  "Git",
  "PyTorch",
  "TensorFlow",
  "LLM",
  "RAG",
  "AI",
  "Machine Learning",
];

function extractJsonObject(text: string): any | null {
  const clean = (text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

export class JobAnalyzerAgent {
  private scraper = getJobWebScraperService();

  async analyzeJobFromUrl(url: string): Promise<AgentResponse<JobAnalysis>> {
    let scrapedData: ScrapedJobPosting | null = null;
    try {
      scrapedData = await this.scraper.scrapeJobPosting(url);

      let analysis: JobAnalysis;
      const apiKey = process.env.ANTHROPIC_API_KEY || "";
      if (apiKey) {
        analysis = await this.parseJobWithAI(scrapedData.description, scrapedData, apiKey);
      } else {
        analysis = this.extractBasicInfoFromText(scrapedData.description, scrapedData);
      }

      const enriched = this.enrichAnalysis(analysis, url, scrapedData.description);
      return { success: true, data: enriched };
    } catch (error: any) {
      if (scrapedData?.description) {
        return {
          success: true,
          data: this.extractBasicInfoFromText(scrapedData.description, scrapedData),
        };
      }
      return { success: false, error: error?.message || "Job analysis failed" };
    }
  }

  async analyzeJobFromText(
    jobText: string,
    basicInfo?: Partial<JobAnalysis>,
  ): Promise<AgentResponse<JobAnalysis>> {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY || "";
      if (!apiKey) {
        return { success: true, data: this.extractBasicInfoFromText(jobText, basicInfo) };
      }
      const analysis = await this.parseJobWithAI(jobText, basicInfo || {}, apiKey);
      return { success: true, data: this.enrichAnalysis(analysis, basicInfo?.originalUrl || "", jobText) };
    } catch (error: any) {
      return { success: false, error: error?.message || "Job analysis failed" };
    }
  }

  calculateMatchScore(userSkills: string[], jobAnalysis: JobAnalysis): MatchResult {
    const normalizeSkill = (skill: string) => skill.toLowerCase().trim();
    const userSkillsNormalized = userSkills.map(normalizeSkill);
    const requiredSkillsNormalized = jobAnalysis.requiredSkills.map(normalizeSkill);
    const preferredSkillsNormalized = jobAnalysis.preferredSkills.map(normalizeSkill);

    const matched = requiredSkillsNormalized.filter((skill) =>
      userSkillsNormalized.includes(skill),
    );
    const missing = requiredSkillsNormalized.filter(
      (skill) => !userSkillsNormalized.includes(skill),
    );
    const extras = preferredSkillsNormalized.filter(
      (skill) =>
        userSkillsNormalized.includes(skill) && !requiredSkillsNormalized.includes(skill),
    );

    const requiredMatch =
      requiredSkillsNormalized.length > 0
        ? (matched.length / requiredSkillsNormalized.length) * 100
        : 100;
    const preferredBonus = extras.length * 2;
    const score = Math.min(100, Math.round(requiredMatch + preferredBonus));

    return {
      score,
      matched,
      missing,
      extras,
    };
  }

  private extractBasicInfoFromText(
    jobText: string,
    basicInfo?: Partial<JobAnalysis>,
  ): JobAnalysis {
    const analysis = basicInfo || {};
    const title = (analysis.title || "Software Engineer").trim();
    const company = (analysis.company || "Unknown Company").trim();
    const location = (analysis.location || "Remote").trim();
    const skills = this.extractSkillsFromText(jobText);

    return {
      title,
      company,
      location,
      salary: analysis.salary,
      jobType: analysis.jobType || "Full-time",
      remote: /remote/i.test(location) || /\bremote\b/i.test(jobText),
      requiredSkills: skills,
      preferredSkills: [],
      requiredYearsExperience: this.extractYearsExperience(jobText),
      educationRequired: this.extractEducationRequirement(jobText),
      responsibilities: this.extractSectionBullets(jobText, [
        "responsibilities",
        "essential functions",
        "what you'll do",
      ]),
      qualifications: this.extractSectionBullets(jobText, [
        "qualifications",
        "requirements",
        "desired experience",
      ]),
      benefits: this.extractSectionBullets(jobText, ["benefits"]),
      keywords: this.extractKeywords(jobText, skills),
      experienceLevel: this.inferExperienceLevel(title),
      techStack: skills,
      industryKeywords: ["technology", "software"],
      postedDate: undefined,
      applicationDeadline: undefined,
      originalUrl: analysis.originalUrl || "",
      rawDescription: jobText.trim(),
    };
  }

  private extractSkillsFromText(jobText: string): string[] {
    const lower = jobText.toLowerCase();
    const found = COMMON_SKILLS.filter((skill) => lower.includes(skill.toLowerCase()));
    return [...new Set(found)];
  }

  private extractSectionBullets(text: string, headers: string[]): string[] {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const lowerHeaders = headers.map((header) => header.toLowerCase());
    const out: string[] = [];
    let collecting = false;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (lowerHeaders.some((header) => lowerLine.includes(header))) {
        collecting = true;
        continue;
      }

      if (collecting && /^[A-Z][A-Za-z\s&]{2,40}:?$/.test(line)) {
        break;
      }

      if (collecting) {
        const cleaned = line
          .replace(/^[-*•]\s*/, "")
          .replace(/\s+/g, " ")
          .trim();
        if (cleaned.length >= 10) out.push(cleaned);
      }
    }

    return out.slice(0, 12);
  }

  private extractKeywords(jobText: string, skills: string[]): string[] {
    const keywordCandidates = [
      ...skills,
      ...this.extractSectionBullets(jobText, ["requirements", "qualifications"]).flatMap((line) =>
        line
          .split(/[,/|]/)
          .map((part) => part.trim())
          .filter((part) => part.length > 2 && part.length < 32),
      ),
    ];

    const uniq = new Set<string>();
    for (const keyword of keywordCandidates) {
      const clean = keyword.replace(/[^\w+\-. ]/g, "").trim();
      if (clean) uniq.add(clean);
    }
    return Array.from(uniq).slice(0, 20);
  }

  private extractEducationRequirement(text: string): string | undefined {
    const matches = text.match(
      /\b(bachelor(?:'s)?|master(?:'s)?|ph\.?d\.?|degree)\b[\s\S]{0,80}/i,
    );
    return matches?.[0]?.replace(/\s+/g, " ").trim();
  }

  private async parseJobWithAI(
    jobText: string,
    basicInfo: Partial<JobAnalysis>,
    apiKey: string,
  ): Promise<JobAnalysis> {
    const anthropic = new Anthropic({ apiKey });
    const maxLength = 20000;
    const truncatedText =
      jobText.length > maxLength ? `${jobText.substring(0, maxLength)}\n...[truncated]` : jobText;

    const prompt = `You are an expert job posting analyzer. Parse this job description and extract structured information.\n\nJob Description:\n${truncatedText}\n\n${basicInfo?.title ? `Title: ${basicInfo.title}` : ""}\n${basicInfo?.company ? `Company: ${basicInfo.company}` : ""}\n${basicInfo?.location ? `Location: ${basicInfo.location}` : ""}\n\nReturn only valid JSON with fields:\n{\n  "title": "string",\n  "company": "string",\n  "location": "string",\n  "salary": "string or empty",\n  "jobType": "Full-time|Part-time|Contract|Internship|",\n  "remote": true,\n  "requiredSkills": ["..."],\n  "preferredSkills": ["..."],\n  "requiredYearsExperience": 0,\n  "educationRequired": "string",\n  "responsibilities": ["..."],\n  "qualifications": ["..."],\n  "benefits": ["..."],\n  "keywords": ["..."],\n  "experienceLevel": "entry|junior|mid|senior|staff|principal|executive",\n  "techStack": ["..."],\n  "industryKeywords": ["..."]\n}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2400,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected AI response format");
    }

    const parsed = extractJsonObject(content.text);
    if (!parsed || Array.isArray(parsed)) {
      throw new Error("Failed to parse AI job analysis JSON");
    }

    return {
      title: typeof parsed.title === "string" ? parsed.title : basicInfo.title || "",
      company:
        typeof parsed.company === "string"
          ? parsed.company
          : basicInfo.company || "",
      location:
        typeof parsed.location === "string"
          ? parsed.location
          : basicInfo.location || "",
      salary: typeof parsed.salary === "string" ? parsed.salary : undefined,
      jobType: typeof parsed.jobType === "string" ? parsed.jobType : undefined,
      remote: Boolean(parsed.remote),
      requiredSkills: toStringArray(parsed.requiredSkills),
      preferredSkills: toStringArray(parsed.preferredSkills),
      requiredYearsExperience:
        typeof parsed.requiredYearsExperience === "number"
          ? parsed.requiredYearsExperience
          : undefined,
      educationRequired:
        typeof parsed.educationRequired === "string"
          ? parsed.educationRequired
          : undefined,
      responsibilities: toStringArray(parsed.responsibilities),
      qualifications: toStringArray(parsed.qualifications),
      benefits: toStringArray(parsed.benefits),
      keywords: toStringArray(parsed.keywords),
      experienceLevel: this.normalizeExperienceLevel(parsed.experienceLevel),
      techStack: toStringArray(parsed.techStack),
      industryKeywords: toStringArray(parsed.industryKeywords),
      postedDate: undefined,
      applicationDeadline: undefined,
      originalUrl: basicInfo.originalUrl || "",
      rawDescription: jobText.trim(),
    };
  }

  private enrichAnalysis(
    analysis: JobAnalysis,
    url: string,
    rawDescription: string,
  ): JobAnalysis {
    const dedupe = (arr: string[]) =>
      Array.from(new Set((arr || []).map((item) => item.trim()).filter(Boolean)));

    const requiredSkills = dedupe(analysis.requiredSkills);
    const preferredSkills = dedupe(analysis.preferredSkills).filter(
      (skill) => !requiredSkills.some((required) => required.toLowerCase() === skill.toLowerCase()),
    );
    const techStack = dedupe([...analysis.techStack, ...requiredSkills]);
    const keywords = dedupe([...analysis.keywords, ...requiredSkills]).slice(0, 24);

    const title = (analysis.title || "").trim();
    const experienceLevel = analysis.experienceLevel || this.inferExperienceLevel(title);

    return {
      ...analysis,
      title: title || "Software Engineer",
      company: (analysis.company || "Unknown Company").trim(),
      location: (analysis.location || "").trim(),
      requiredSkills,
      preferredSkills,
      techStack,
      keywords,
      responsibilities: dedupe(analysis.responsibilities),
      qualifications: dedupe(analysis.qualifications),
      benefits: dedupe(analysis.benefits || []),
      industryKeywords: dedupe(analysis.industryKeywords),
      requiredYearsExperience:
        analysis.requiredYearsExperience || this.extractYearsExperience(rawDescription),
      educationRequired:
        analysis.educationRequired || this.extractEducationRequirement(rawDescription),
      remote:
        typeof analysis.remote === "boolean"
          ? analysis.remote
          : /\bremote|hybrid\b/i.test(analysis.location || rawDescription),
      experienceLevel,
      originalUrl: url,
      rawDescription: rawDescription.trim(),
    };
  }

  private normalizeExperienceLevel(value: unknown): JobAnalysis["experienceLevel"] {
    const raw = `${value || ""}`.toLowerCase().trim();
    if (
      raw === "entry" ||
      raw === "junior" ||
      raw === "mid" ||
      raw === "senior" ||
      raw === "staff" ||
      raw === "principal" ||
      raw === "executive"
    ) {
      return raw;
    }
    return "mid";
  }

  private inferExperienceLevel(title: string): JobAnalysis["experienceLevel"] {
    const lower = (title || "").toLowerCase();
    if (lower.includes("intern") || lower.includes("entry")) return "entry";
    if (/\b(junior|jr)\b/.test(lower)) return "junior";
    if (/\b(senior|sr)\b/.test(lower)) return "senior";
    if (lower.includes("staff")) return "staff";
    if (/\b(principal|lead)\b/.test(lower)) return "principal";
    if (/\b(director|vp|head|chief)\b/.test(lower)) return "executive";
    return "mid";
  }

  private extractYearsExperience(text: string): number | undefined {
    const patterns = [
      /(\d+)\+?\s*years?\s*of\s*experience/i,
      /(\d+)\+?\s*yrs?\s*experience/i,
      /experience:\s*(\d+)\+?\s*years?/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return parseInt(match[1], 10);
    }
    return undefined;
  }
}

let jobAnalyzerAgent: JobAnalyzerAgent | null = null;

export function getJobAnalyzerAgent(): JobAnalyzerAgent {
  if (!jobAnalyzerAgent) {
    jobAnalyzerAgent = new JobAnalyzerAgent();
  }
  return jobAnalyzerAgent;
}

export default getJobAnalyzerAgent;
