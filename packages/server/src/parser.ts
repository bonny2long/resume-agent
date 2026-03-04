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
  const fallbackResult = universalFallback(rawText);

  const hasData =
    (aiResult.experiences?.length ?? 0) > 0 ||
    (aiResult.projects?.length ?? 0) > 0 ||
    (aiResult.education?.length ?? 0) > 0 ||
    (aiResult.skills?.technical?.length ?? 0) > 0;

  let parsed: ParsedResume;
  if (hasData) {
    console.log("✓ AI parsed successfully");
    mergeContactFallback(aiResult, rawText);
    parsed = normalizeResult(mergeParsedData(aiResult, fallbackResult));
  } else {
    console.log("⚠ AI failed — using universal fallback parser");
    parsed = fallbackResult;
  }

  return {
    parsed,
    rawText,
    resumeData: parsed,
  };
}

function mergeParsedData(primary: ParsedResume, fallback: ParsedResume): ParsedResume {
  const skills = {
    technical: [] as string[],
    languages: [] as string[],
    frameworks: [] as string[],
    tools: [] as string[],
  };
  mergeSkills(skills, primary.skills ?? createEmpty().skills);
  mergeSkills(skills, fallback.skills ?? createEmpty().skills);

  return {
    personalInfo: {
      ...(fallback.personalInfo ?? {}),
      ...(primary.personalInfo ?? {}),
    },
    summary: {
      short: primary.summary?.short || fallback.summary?.short || "",
      long: primary.summary?.long || fallback.summary?.long || "",
    },
    experiences:
      (primary.experiences?.length ?? 0) > 0
        ? primary.experiences
        : fallback.experiences,
    projects:
      (primary.projects?.length ?? 0) > 0
        ? primary.projects
        : fallback.projects,
    skills,
    education:
      (primary.education?.length ?? 0) > 0
        ? primary.education
        : fallback.education,
  };
}

// ─── AI Parsing (Updated with Tool Use) ───────────────────────────────────────

async function parseWithAI(text: string): Promise<ParsedResume> {
  const systemPrompt = `You are an expert resume parser. Extract structured data from ANY resume format: traditional, creative, academic, international, hybrid, and non-standard layouts.\n\nRules:\n1) Be resume-agnostic and do not rely on strict section names.\n2) If content is in unusual places, map it to the closest field.\n3) Extract ALL projects if present, including side projects, open-source work, capstones, and portfolio items.\n4) Extract EVERY achievement bullet with metrics when present.\n5) summary.short must be 2-3 sentences (concise value proposition).\n6) summary.long must be 4-6 sentences (deeper narrative and strengths).\n7) Do NOT invent facts, numbers, outcomes, or claims not present in text.\n8) Preserve tense/status from source wording (e.g., "building" must not become "built").\n9) Prefer original wording and avoid marketing buzzwords when possible.`;

  const userPrompt = `Parse every piece of information from this resume. Handle ALL formats and inconsistent spacing/layout. Ensure projects are extracted even when embedded under experience or portfolio wording.\n\nResume text:\n\n${text.slice(0, 15000)}`;

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
  if (!result.summary.short && !result.summary.long) {
    const inferredSummary = deriveSummaryFromText(text);
    result.summary.short = inferredSummary.short;
    result.summary.long = inferredSummary.long;
  }
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
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!isProjectHeader(line)) {
      i++;
      continue;
    }

    const name = cleanProjectName(line);
    const descriptionLines: string[] = [];
    let techSource = line;
    i++;

    while (i < lines.length) {
      const current = lines[i];
      if (!current) {
        i++;
        if (descriptionLines.length > 0) break;
        continue;
      }

      if (isProjectHeader(current) && descriptionLines.length > 0) {
        break;
      }

      const bullet = BULLET_PATTERN.exec(current);
      if (bullet) {
        descriptionLines.push(bullet[1]);
        techSource += ` ${bullet[1]}`;
        i++;
        continue;
      }

      if (/^(tech|tools|stack)\s*:/i.test(current)) {
        techSource += ` ${current}`;
        i++;
        continue;
      }

      if (descriptionLines.length === 0 || current.length <= 180) {
        descriptionLines.push(current);
        techSource += ` ${current}`;
        i++;
        continue;
      }

      break;
    }

    const description = descriptionLines.join(" ").slice(0, 450).trim();
    if (!name || name.length < 3 || name.length > 90) continue;
    if (!description) continue;

    projects.push({
      name,
      description,
      technologies: extractTechFromText(techSource),
    });
  }

  return dedupeProjects(projects).slice(0, 15);
}

function isProjectHeader(line: string): boolean {
  if (!line) return false;
  if (line.length < 3 || line.length > 100) return false;
  if (BULLET_PATTERN.test(line)) return false;
  if (/[.!?]$/.test(line)) return false;
  if (/^(experience|education|skills|summary|certifications?)/i.test(line))
    return false;
  if (/^(responsibilities|achievements|technologies|tools)\b/i.test(line))
    return false;
  if (
    /^(architected|built|building|created|developed|design(?:ed|ing)|implemented|led|managed|delivered)\b/i.test(
      line,
    )
  ) {
    return false;
  }
  if (line.split(/\s+/).length > 9) return false;
  return /[A-Za-z]/.test(line);
}

function cleanProjectName(line: string): string {
  let name = line
    .replace(/^projects?\s*[:\-]\s*/i, "")
    .replace(/^project\s*[:\-]\s*/i, "")
    .trim();

  if (name.includes("|")) name = name.split("|")[0].trim();
  if (name.includes(" - ")) name = name.split(" - ")[0].trim();

  return name.replace(/\s{2,}/g, " ").slice(0, 90).trim();
}

function dedupeProjects(projects: ParsedResume["projects"]): ParsedResume["projects"] {
  const seen = new Set<string>();
  return projects.filter((project) => {
    const key = project.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  "tailwind css",
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
  "node.js",
  "nodejs",
  "postgresql",
  "mysql",
  "prisma",
  "openai",
  "claude",
  "gemini",
  "anthropic",
  "cohere",
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

const SKILL_LABEL_PREFIX =
  /^(languages?|frontend|backend|state|testing|tools?|frameworks?|technical|technologies|data\s+systems?|infrastructure)\s*:\s*/i;
const SKILL_NOISE_PATTERN =
  /\b(i\.?c\.?\s*stars|chicago|south bend|nappanee|union local|intern|united airlines|illinois|indiana)\b/i;

function extractSkillCandidates(raw: string): string[] {
  if (!raw) return [];

  const cleaned = raw
    .replace(/[\u2022\u25CF\u25AA\u25E6]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  return cleaned
    .split(/[,;|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeSkillToken(raw: string): string {
  let token = `${raw || ""}`
    .trim()
    .replace(SKILL_LABEL_PREFIX, "")
    .replace(/[()]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (!token) return "";

  token = token
    .replace(/\bjavascript\s*\(es\d\+\)\b/gi, "javascript")
    .replace(/\bjavascript\s*es\d\+\b/gi, "javascript")
    .replace(/\btailwind\s*css\b/gi, "tailwind")
    .replace(/\bnodejs\b/gi, "node.js")
    .replace(/\bgemini\)+/gi, "gemini")
    .replace(/\s+/g, " ")
    .trim();

  const lowered = token.toLowerCase();
  if (lowered === "object object") return "";
  if (SKILL_NOISE_PATTERN.test(lowered)) return "";
  if (
    lowered.length <= 2 &&
    !KNOWN_LANGUAGES.has(lowered) &&
    !KNOWN_FRAMEWORKS.has(lowered) &&
    !KNOWN_TOOLS.has(lowered)
  ) {
    return "";
  }
  if (lowered.length < 2 || lowered.length > 40) return "";
  if (lowered.split(/\s+/).length > 5) return "";

  if (
    /\b(background|advantage|problem solving|experience in|years|project|role)\b/i.test(
      lowered,
    ) &&
    !KNOWN_LANGUAGES.has(lowered) &&
    !KNOWN_FRAMEWORKS.has(lowered) &&
    !KNOWN_TOOLS.has(lowered)
  ) {
    return "";
  }

  return lowered;
}

function normalizeSkills(skills: ParsedResume["skills"]): ParsedResume["skills"] {
  const normalized: ParsedResume["skills"] = {
    technical: [],
    languages: [],
    frameworks: [],
    tools: [],
  };

  const seen = new Set<string>();
  const add = (category: keyof ParsedResume["skills"], token: string) => {
    if (!token || seen.has(token)) return;
    seen.add(token);
    normalized[category].push(capitalizeSkill(token));
  };

  const allInputs = [
    ...(skills?.languages ?? []),
    ...(skills?.frameworks ?? []),
    ...(skills?.tools ?? []),
    ...(skills?.technical ?? []),
  ];

  for (const input of allInputs) {
    const candidates = extractSkillCandidates(input);
    for (const candidate of candidates) {
      const token = normalizeSkillToken(candidate);
      if (!token) continue;

      if (KNOWN_LANGUAGES.has(token)) add("languages", token);
      else if (KNOWN_FRAMEWORKS.has(token)) add("frameworks", token);
      else if (KNOWN_TOOLS.has(token)) add("tools", token);
      else add("technical", token);
    }
  }

  return normalized;
}

function extractSkillsLegacy(text: string): ParsedResume["skills"] {
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

function extractSkills(text: string): ParsedResume["skills"] {
  const skills: ParsedResume["skills"] = {
    technical: [],
    languages: [],
    frameworks: [],
    tools: [],
  };

  const tokens = text
    .split(/[\n|/]+/)
    .flatMap((chunk) => extractSkillCandidates(chunk));

  for (const rawToken of tokens) {
    const token = normalizeSkillToken(rawToken);
    if (!token) continue;

    if (KNOWN_LANGUAGES.has(token)) skills.languages.push(token);
    else if (KNOWN_FRAMEWORKS.has(token)) skills.frameworks.push(token);
    else if (KNOWN_TOOLS.has(token)) skills.tools.push(token);
    else skills.technical.push(token);
  }

  return normalizeSkills(skills);
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
  jwt: "JWT",
  "oauth 2.0": "OAuth 2.0",
  react: "React",
  "react native": "React Native",
  "next.js": "Next.js",
  express: "Express",
  zustand: "Zustand",
  vue: "Vue.js",
  angular: "Angular",
  tailwind: "Tailwind CSS",
  "tailwind css": "Tailwind CSS",
  aws: "AWS",
  gcp: "GCP",
  git: "Git",
  "github actions": "GitHub Actions",
  "node.js": "Node.js",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  prisma: "Prisma",
  openai: "OpenAI",
  claude: "Claude",
  gemini: "Gemini",
  anthropic: "Anthropic",
  cohere: "Cohere",
  jest: "Jest",
  cypress: "Cypress",
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

  const normalized = normalizeSkills(target);
  target.technical = normalized.technical;
  target.languages = normalized.languages;
  target.frameworks = normalized.frameworks;
  target.tools = normalized.tools;
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
  result.projects = dedupeProjects(result.projects ?? []);
  if (result.projects.length === 0 && (result.experiences?.length ?? 0) > 0) {
    result.projects = deriveProjectsFromExperiences(result.experiences);
  }
  result.education = result.education ?? [];
  result.skills = normalizeSkills(
    result.skills ?? {
      technical: [],
      languages: [],
      frameworks: [],
      tools: [],
    },
  );
  result.summary = ensureSummaryLengths(result.summary);
  return result;
}

function ensureSummaryLengths(summary?: {
  short?: string;
  long?: string;
}): { short: string; long: string } {
  const shortRaw = removeRepeatedLead((summary?.short || "").trim());
  const longRaw = removeRepeatedLead((summary?.long || "").trim());
  const base = longRaw || shortRaw;

  if (!base) {
    return { short: "", long: "" };
  }

  const short = buildShortSummary(shortRaw, longRaw);
  const long = buildLongSummary(short, longRaw || shortRaw);

  return { short, long };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildShortSummary(shortText: string, longText: string): string {
  const source = ((shortText || "").trim() || (longText || "").trim()).trim();
  if (!source) return "";

  const sentences = splitSentences(source);
  const firstSentence = sentences[0] || source;
  let short = trimToCompleteSentence(firstSentence, 210, 45);

  if (short.length < 60 && sentences.length > 1) {
    short = trimToCompleteSentence(`${firstSentence} ${sentences[1]}`, 210, 70);
  }

  return short;
}

function buildLongSummary(shortText: string, longText: string): string {
  const source = (longText || "").trim() || shortText;
  if (!source) return "";

  const sentences = splitSentences(source);
  let long =
    sentences.length > 0 ? sentences.slice(0, 4).join(" ").trim() : source;

  if (splitSentences(long).length < 2 && shortText && !long.includes(shortText)) {
    long = `${shortText} ${long}`.trim();
  }

  return trimToCompleteSentence(long, 560, 120);
}

function trimAtWordBoundary(text: string, maxChars: number): string {
  const clean = (text || "").trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace < 0) return slice.trim();
  return slice.slice(0, lastSpace).trim();
}

function trimToCompleteSentence(
  text: string,
  maxChars: number,
  minCharsForSentenceCut: number,
): string {
  const wordTrimmed = trimAtWordBoundary(text, maxChars);
  const punctuationIndexes = [
    wordTrimmed.lastIndexOf("."),
    wordTrimmed.lastIndexOf("!"),
    wordTrimmed.lastIndexOf("?"),
  ];
  const lastPunctuation = Math.max(...punctuationIndexes);
  if (lastPunctuation >= minCharsForSentenceCut) {
    return wordTrimmed.slice(0, lastPunctuation + 1).trim();
  }
  return wordTrimmed;
}

function removeRepeatedLead(text: string): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  const repeatedMatch = clean.match(/^(.{8,90}?)\s+\1(\b|$)/i);
  if (repeatedMatch) {
    return clean.slice(repeatedMatch[1].length).trim();
  }
  return clean;
}

function deriveProjectsFromExperiences(
  experiences: ParsedResume["experiences"],
): ParsedResume["projects"] {
  return dedupeProjects(
    experiences
      .map((exp) => {
        const candidates = [exp.title, exp.company]
          .map((value) => (value || "").replace(/\s+/g, " ").trim())
          .filter(Boolean);

        const preferred =
          candidates.find(
            (value) =>
              value.length >= 3 &&
              value.length <= 70 &&
              value.split(/\s+/).length <= 10 &&
              !/^(architected|built|building|created|developed|design(?:ed|ing)|implemented|led|managed|delivered)\b/i.test(
                value,
              ),
          ) || candidates[0] || "";

        const name = preferred.slice(0, 90).trim();
        const description = (exp.description || "").replace(/\s+/g, " ").slice(0, 420).trim();
        if (!name || name.length < 3 || !description) return null;

        return {
          name,
          description,
          technologies: exp.technologies ?? [],
        };
      })
      .filter((project): project is NonNullable<typeof project> => Boolean(project)),
  ).slice(0, 6);
}

function deriveSummaryFromText(text: string): { short: string; long: string } {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^[\w.+%-]+@[\w.-]+\.[a-z]{2,}$/i.test(line) &&
        !/(linkedin\.com|github\.com|portfolio|^\+?\d[\d\s().-]{8,}$)/i.test(line) &&
        !/^[A-Z][A-Z\s.'-]{2,40}$/.test(line) &&
        !SECTION_PATTERNS.summary.test(line) &&
        !SECTION_PATTERNS.experience.test(line) &&
        !SECTION_PATTERNS.projects.test(line) &&
        !SECTION_PATTERNS.skills.test(line) &&
        !SECTION_PATTERNS.education.test(line),
    );

  const paragraph = lines.slice(0, 6).join(" ").replace(/\s+/g, " ").trim();
  if (!paragraph) return { short: "", long: "" };

  const short = buildShortSummary("", paragraph);
  const long = buildLongSummary(short, paragraph);
  return { short, long };
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
