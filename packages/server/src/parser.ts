import Anthropic from "@anthropic-ai/sdk";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { readFileSync } from "fs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export interface ParsedResume {
  personalInfo: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
  };
  summary: { short?: string; long?: string };
  experiences: Array<{
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string | null;
    current: boolean;
    description?: string;
    achievements: Array<{ description: string; metrics?: string }>;
    technologies: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
  }>;
  skills: {
    technical: string[];
    languages: string[];
    frameworks: string[];
    tools: string[];
  };
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export interface ParseResult {
  parsed: ParsedResume;
  rawText: string;
  resumeData: ParsedResume;
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

export async function extractText(
  filePath: string,
  fileName: string,
): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    const data = await pdf(readFileSync(filePath));
    return cleanText(data.text);
  } else if (ext === "docx" || ext === "doc") {
    const result = await mammoth.extractRawText({ path: filePath });
    return cleanText(result.value);
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{3,}/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function parseResumeFile(
  filePath: string,
  fileName: string,
): Promise<ParseResult> {
  console.log("=== Parsing:", fileName, "===");
  const rawText = await extractText(filePath, fileName);
  console.log("Text length:", rawText.length);

  const aiResult = await parseWithAI(rawText);

  const hasData =
    (aiResult.experiences?.length ?? 0) > 0 ||
    (aiResult.projects?.length ?? 0) > 0 ||
    (aiResult.education?.length ?? 0) > 0 ||
    (aiResult.skills?.technical?.length ?? 0) > 0;

  let parsed: ParsedResume;
  if (hasData) {
    console.log("✓ AI parsed successfully");
    mergeContactFallback(aiResult, rawText);
    parsed = normalizeResult(aiResult);
  } else {
    console.log("⚠ AI failed — using universal fallback parser");
    parsed = universalFallback(rawText);
  }

  return {
    parsed,
    rawText,
    resumeData: parsed,
  };
}

// ─── AI Parsing (Updated with Tool Use) ───────────────────────────────────────

async function parseWithAI(text: string): Promise<ParsedResume> {
  const systemPrompt = `You are an expert resume parser. Extract structured data from ANY resume format — traditional, creative, academic, international, or unconventional. Make your best guess rather than leaving things empty. Extract EVERY bullet point as an achievement with metrics if present.`;

  const userPrompt = `Parse every piece of information from this resume. Handle ALL formats. Resume text:\n\n${text.slice(0, 15000)}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: systemPrompt,
      tools: [
        {
          name: "extract_resume_data",
          description: "Extracts structured data from a resume.",
          input_schema: {
            type: "object",
            properties: {
              personalInfo: {
                type: "object",
                properties: {
                  fullName: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  location: { type: "string" },
                  linkedInUrl: { type: "string" },
                  githubUrl: { type: "string" },
                  portfolioUrl: { type: "string" },
                },
              },
              summary: {
                type: "object",
                properties: {
                  short: { type: "string" },
                  long: { type: "string" },
                },
              },
              experiences: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    company: { type: "string" },
                    title: { type: "string" },
                    location: { type: "string" },
                    startDate: { type: "string" },
                    endDate: { type: "string", nullable: true },
                    current: { type: "boolean" },
                    description: { type: "string" },
                    achievements: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          description: { type: "string" },
                          metrics: { type: "string" },
                        },
                      },
                    },
                    technologies: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "company",
                    "title",
                    "startDate",
                    "current",
                    "achievements",
                    "technologies",
                  ],
                },
              },
              projects: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    technologies: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["name", "description", "technologies"],
                },
              },
              skills: {
                type: "object",
                properties: {
                  technical: { type: "array", items: { type: "string" } },
                  languages: { type: "array", items: { type: "string" } },
                  frameworks: { type: "array", items: { type: "string" } },
                  tools: { type: "array", items: { type: "string" } },
                },
              },
              education: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    institution: { type: "string" },
                    degree: { type: "string" },
                    field: { type: "string" },
                    startDate: { type: "string" },
                    endDate: { type: "string" },
                  },
                  required: ["institution", "degree", "field"],
                },
              },
            },
            required: [
              "personalInfo",
              "summary",
              "experiences",
              "projects",
              "skills",
              "education",
            ],
          },
        },
      ],
      tool_choice: { type: "tool", name: "extract_resume_data" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolBlock = response.content.find(
      (block) => block.type === "tool_use",
    );

    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("Model failed to use the extraction tool.");
    }

    const parsed = toolBlock.input as ParsedResume;

    console.log(
      `AI → exp:${parsed.experiences?.length ?? 0} proj:${
        parsed.projects?.length ?? 0
      } edu:${parsed.education?.length ?? 0} skills:${
        parsed.skills?.technical?.length ?? 0
      }`,
    );
    return parsed;
  } catch (err: any) {
    console.error("AI parsing failed:", err.message);
    return createEmpty();
  }
}

// ─── Universal Fallback Parser ────────────────────────────────────────────────

function universalFallback(text: string): ParsedResume {
  const result = createEmpty();

  result.personalInfo.email =
    text.match(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? "";
  result.personalInfo.phone =
    text.match(
      /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/,
    )?.[0] ?? "";
  result.personalInfo.linkedInUrl =
    text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ??
    "";
  result.personalInfo.githubUrl =
    text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i)?.[0] ?? "";

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  result.personalInfo.fullName =
    lines.find(
      (l) =>
        l.length > 2 &&
        l.length < 60 &&
        !l.match(/[@()\d]/) &&
        !l.match(/resume|curriculum|vitae|cv/i),
    ) ?? "";

  const sections = splitIntoSections(text);
  for (const [sectionName, sectionText] of Object.entries(sections)) {
    const type = classifySection(sectionName);
    switch (type) {
      case "summary":
        result.summary.long = sectionText.trim();
        result.summary.short = sectionText.trim().slice(0, 200);
        break;
      case "experience":
        result.experiences.push(...extractExperiences(sectionText));
        break;
      case "projects":
        result.projects.push(...extractProjects(sectionText));
        break;
      case "skills":
        mergeSkills(result.skills, extractSkills(sectionText));
        break;
      case "education":
        result.education.push(...extractEducation(sectionText));
        break;
    }
  }

  if (result.skills.technical.length === 0)
    mergeSkills(result.skills, extractSkills(text));
  return normalizeResult(result);
}

// ─── Section Detection ────────────────────────────────────────────────────────

const SECTION_PATTERNS: Record<string, RegExp> = {
  summary:
    /^(summary|objective|profile|about|overview|professional\s+summary|career\s+objective)/i,
  experience:
    /^(experience|work|employment|career|history|professional\s+experience|work\s+history|employment\s+history|relevant\s+experience|internship)/i,
  projects:
    /^(projects?|portfolio|personal\s+projects?|open.?source|side\s+projects?|academic\s+projects?)/i,
  skills:
    /^(skills?|technical\s+skills?|core\s+competencies|competencies|technologies|expertise|proficiencies|tools?)/i,
  education:
    /^(education|academic|schooling|degrees?|qualifications?|certifications?|training)/i,
};

function splitIntoSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = text.split("\n");
  const headerShape = /^[A-Z][A-Z\s&\/.-]{1,45}$|^.{1,45}:$/;

  let currentSection = "header";
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      sections[currentSection] =
        (sections[currentSection] ?? "") + "\n" + buffer.join("\n");
      buffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      buffer.push("");
      continue;
    }

    const isKnownSection = Object.values(SECTION_PATTERNS).some((re) =>
      re.test(trimmed),
    );
    const isShapedHeader = trimmed.length < 50 && headerShape.test(trimmed);

    if (isKnownSection || isShapedHeader) {
      flush();
      currentSection = trimmed.toLowerCase().replace(/:$/, "").trim();
    } else {
      buffer.push(trimmed);
    }
  }
  flush();
  return sections;
}

function classifySection(name: string): string {
  for (const [type, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(name)) return type;
  }
  return "unknown";
}

// ─── Experience Extraction ────────────────────────────────────────────────────

const DATE_PATTERN =
  /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|q[1-4]|spring|summer|fall|winter)?\s*,?\s*(?:19|20)\d{2}\s*(?:[-–—to]+\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|q[1-4]|spring|summer|fall|winter|present|current|now)?\s*,?\s*(?:19|20)?\d{0,4})?/gi;
const BULLET_PATTERN = /^[•·▪▸▶➤\-–—*>]\s+(.+)/;

function extractExperiences(text: string): ParsedResume["experiences"] {
  const experiences: ParsedResume["experiences"] = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (BULLET_PATTERN.test(line)) {
      i++;
      continue;
    }
    if (!/\b(19|20)\d{2}\b/.test(line)) {
      i++;
      continue;
    }

    const entry = parseJobBlock(lines, i);
    if (entry) {
      const { _nextIndex, ...clean } = entry as any;
      experiences.push(clean);
      i = _nextIndex ?? i + 1;
    } else {
      i++;
    }
  }
  return experiences;
}

function parseJobBlock(lines: string[], startIndex: number): any {
  const headerLines: string[] = [];
  const bulletLines: string[] = [];
  let i = startIndex;

  while (i < lines.length && headerLines.length < 4) {
    const line = lines[i];
    if (BULLET_PATTERN.test(line) || !line.trim()) break;
    headerLines.push(line.trim());
    i++;
  }
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      break;
    }
    const bulletMatch = BULLET_PATTERN.exec(line);
    if (bulletMatch) {
      bulletLines.push(bulletMatch[1]);
      i++;
    } else if (!/\b(19|20)\d{2}\b/.test(line)) {
      bulletLines.push(line);
      i++;
    } else break;
  }

  if (headerLines.length === 0) return null;

  const combined = headerLines.join(" | ");
  const dates = combined.match(DATE_PATTERN) ?? [];
  const startDate = dates[0] ?? "";
  const isCurrent = /present|current|now/i.test(combined);
  const endDate = isCurrent ? "Present" : (dates[1] ?? "");

  const stripped = combined
    .replace(DATE_PATTERN, "")
    .replace(/\bpresent\b|\bcurrent\b/gi, "")
    .trim();
  const parts = stripped
    .split(/[|,@–—\t]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const title = parts[0] ?? "";
  const company = parts[1] ?? parts[0] ?? "";
  const location =
    parts.find((p) => /^[A-Z][a-z]+(,\s*[A-Z]{2})?$/.test(p)) ?? "";

  if (!title && !company) return null;

  return {
    company,
    title,
    location,
    startDate,
    endDate: endDate || null,
    current: isCurrent,
    description: bulletLines.join(" ").slice(0, 500),
    achievements: bulletLines.map((b) => ({
      description: b,
      metrics: extractMetrics(b),
    })),
    technologies: extractTechFromText(bulletLines.join(" ")),
    _nextIndex: i,
  };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

function extractProjects(text: string): ParsedResume["projects"] {
  const projects: ParsedResume["projects"] = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    const name = lines[0];
    if (name.length > 80 || name.length < 3) continue;
    if (/^(experience|education|skills|summary)/i.test(name)) continue;
    const description = lines
      .slice(1)
      .map((l) => BULLET_PATTERN.exec(l)?.[1] ?? l)
      .join(" ")
      .slice(0, 400);
    projects.push({
      name,
      description,
      technologies: extractTechFromText(block),
    });
  }
  return projects.slice(0, 15);
}

// ─── Skills ───────────────────────────────────────────────────────────────────

const KNOWN_LANGUAGES = new Set([
  "javascript",
  "typescript",
  "python",
  "java",
  "c++",
  "c#",
  "ruby",
  "go",
  "rust",
  "php",
  "swift",
  "kotlin",
  "scala",
  "r",
  "matlab",
  "html",
  "css",
  "sql",
  "graphql",
  "bash",
  "shell",
  "powershell",
  "perl",
  "dart",
]);
const KNOWN_FRAMEWORKS = new Set([
  "react",
  "react native",
  "vue",
  "angular",
  "next.js",
  "svelte",
  "tailwind",
  "bootstrap",
  "redux",
  "zustand",
  "jquery",
  "express",
  "django",
  "flask",
  "spring",
  "rails",
  "laravel",
  "asp.net",
  "fastapi",
  "nuxt",
  "gatsby",
  "nestjs",
  "phoenix",
]);
const KNOWN_TOOLS = new Set([
  "git",
  "github",
  "gitlab",
  "docker",
  "kubernetes",
  "jenkins",
  "terraform",
  "ansible",
  "circleci",
  "travis",
  "github actions",
  "aws",
  "azure",
  "gcp",
  "google cloud",
  "heroku",
  "vercel",
  "netlify",
  "firebase",
  "jira",
  "figma",
  "webpack",
  "vite",
  "jest",
  "cypress",
  "selenium",
  "playwright",
  "pytest",
  "postman",
]);

function extractSkills(text: string): ParsedResume["skills"] {
  const skills: ParsedResume["skills"] = {
    technical: [],
    languages: [],
    frameworks: [],
    tools: [],
  };
  const tokens = text
    .split(/[\n,|•·▪▸▶➤*>\t/]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 1 && t.length < 40);
  const seen = new Set<string>();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (KNOWN_LANGUAGES.has(token))
      skills.languages.push(capitalizeSkill(token));
    else if (KNOWN_FRAMEWORKS.has(token))
      skills.frameworks.push(capitalizeSkill(token));
    else if (KNOWN_TOOLS.has(token)) skills.tools.push(capitalizeSkill(token));
    else if (token.split(" ").length <= 3)
      skills.technical.push(capitalizeSkill(token));
  }
  return skills;
}

const SKILL_CAPS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  "c++": "C++",
  "c#": "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  graphql: "GraphQL",
  react: "React",
  "next.js": "Next.js",
  vue: "Vue.js",
  angular: "Angular",
  aws: "AWS",
  gcp: "GCP",
  git: "Git",
  docker: "Docker",
  kubernetes: "Kubernetes",
};
function capitalizeSkill(s: string): string {
  return (
    SKILL_CAPS[s.toLowerCase()] ??
    s
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

function mergeSkills(
  target: ParsedResume["skills"],
  source: ParsedResume["skills"],
) {
  const add = (arr: string[], items: string[]) => {
    const existing = new Set(arr.map((s) => s.toLowerCase()));
    for (const item of items)
      if (!existing.has(item.toLowerCase())) arr.push(item);
  };
  add(target.technical, source.technical);
  add(target.languages, source.languages);
  add(target.frameworks, source.frameworks);
  add(target.tools, source.tools);
}

// ─── Education ────────────────────────────────────────────────────────────────

const DEGREE_PATTERNS = [
  /\bph\.?d\.?\b/i,
  /\bdoctor(?:ate)?\b/i,
  /\bmaster(?:'?s)?\b/i,
  /\bm\.?[sa]\.?\b/i,
  /\bmba\b/i,
  /\bbachelor(?:'?s)?\b/i,
  /\bb\.?[sa]\.?(?:c\.?)?\b/i,
  /\ba\.?[as]\.?(?:s\.?)?\b/i,
  /\bassociate(?:'?s)?\b/i,
  /\bdiploma\b/i,
  /\bcertificate\b/i,
];
const INSTITUTION_KEYWORDS = [
  "university",
  "college",
  "institute",
  "school",
  "academy",
  "polytechnic",
  "community",
  "technical",
  "vocational",
];

function extractEducation(text: string): ParsedResume["education"] {
  const education: ParsedResume["education"] = [];
  const blocks = text
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const block of blocks) {
    const hasInstitution = INSTITUTION_KEYWORDS.some((k) =>
      block.toLowerCase().includes(k),
    );
    const degreeMatch = DEGREE_PATTERNS.find((p) => p.test(block));
    if (!hasInstitution && !degreeMatch) continue;

    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const institution =
      lines.find((l) =>
        INSTITUTION_KEYWORDS.some((k) => l.toLowerCase().includes(k)),
      ) ?? lines[0];
    const degreeRaw = degreeMatch ? (block.match(degreeMatch)?.[0] ?? "") : "";
    const inMatch = block.match(/\bin\s+([A-Z][^,\n|]{3,40})/i);
    const field = inMatch ? inMatch[1].trim() : "";
    const dates = block.match(DATE_PATTERN) ?? [];

    education.push({
      institution: institution.slice(0, 100),
      degree: degreeRaw || "See institution",
      field,
      startDate: dates[0] ?? undefined,
      endDate: dates[1] ?? undefined,
    });
  }
  return education;
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function extractMetrics(text: string): string {
  return (
    text
      .match(/[\d,.]+%|\$[\d,.]+[kmb]?|\d+[kmb]\+?|\d+x|\d+\/\d+/gi)
      ?.join(", ") ?? ""
  );
}

function extractTechFromText(text: string): string[] {
  const lower = text.toLowerCase();
  return [...KNOWN_LANGUAGES, ...KNOWN_FRAMEWORKS, ...KNOWN_TOOLS]
    .filter((t) => lower.includes(t))
    .map(capitalizeSkill)
    .slice(0, 20);
}

function mergeContactFallback(result: ParsedResume, text: string) {
  const i = result.personalInfo;
  if (!i.email)
    i.email = text.match(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? "";
  if (!i.phone)
    i.phone =
      text.match(
        /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/,
      )?.[0] ?? "";
  if (!i.linkedInUrl)
    i.linkedInUrl =
      text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ??
      "";
  if (!i.githubUrl)
    i.githubUrl =
      text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i)?.[0] ?? "";
}

function normalizeResult(result: ParsedResume): ParsedResume {
  result.experiences = (result.experiences ?? []).map((e) => ({
    ...e,
    achievements: e.achievements ?? [],
    technologies: e.technologies ?? [],
  }));
  result.projects = result.projects ?? [];
  result.education = result.education ?? [];
  result.skills = result.skills ?? {
    technical: [],
    languages: [],
    frameworks: [],
    tools: [],
  };
  result.summary = result.summary ?? { short: "", long: "" };
  return result;
}

function createEmpty(): ParsedResume {
  return {
    personalInfo: { fullName: "" },
    summary: { short: "", long: "" },
    experiences: [],
    projects: [],
    skills: { technical: [], languages: [], frameworks: [], tools: [] },
    education: [],
  };
}
