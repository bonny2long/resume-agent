import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from "fs";
import { join, dirname, resolve, sep, extname, basename } from "path";
import { fileURLToPath } from "url";
import { prisma } from "@resume-agent/shared/src/client.js";
import { parseResumeFile } from "./parser.js";
import { getJobAnalyzerAgent } from "./agents/job-analyzer.js";
import { getLLMService } from "./services/llm.service.js";
import {
  type CoverLetterTone,
  applyCoverLetterTonePostProcessing,
  assessCoverLetterTone,
  getCoverLetterToneGuide,
  normalizeCoverLetterTone,
} from "./services/cover-letter-tone.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_ROOTS = [
  resolve(process.cwd(), "data", "outputs"),
  resolve(process.cwd(), "packages", "server", "data", "outputs"),
];

function resolveSafeOutputPath(rawPath: string): string | null {
  const requested = `${rawPath || ""}`.trim();
  if (!requested) return null;
  const absolutePath = resolve(requested);

  const allowed = OUTPUT_ROOTS.some(
    (root) => absolutePath === root || absolutePath.startsWith(root + sep),
  );
  if (!allowed) return null;
  return absolutePath;
}

function getFileContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".json") return "application/json";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

const fastify: FastifyInstance = Fastify({
  logger: true,
});

// Load environment variables
function loadEnv() {
  const envPath = join(__dirname, "../../.env");
  if (existsSync(envPath)) {
    const envFile = readFileSync(envPath, "utf-8");
    envFile.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join("=").trim();
        }
      }
    });
  }
}
loadEnv();

// Declare authenticate decorator
fastify.decorate("authenticate", async function (request: any, reply: any) {
  // Dev mode bypass - if token is "dev-token", use first user in DB
  const authHeader = request.headers.authorization;

  if (authHeader === "Bearer dev-token") {
    // Find or create dev user
    let devUser = await prisma.user.findFirst();
    if (!devUser) {
      devUser = await prisma.user.create({
        data: {
          email: "dev@localhost",
          name: "Dev User",
          passwordHash: await bcrypt.hash("dev", 10),
        },
      });
    }
    request.user = { id: devUser.id, email: devUser.email };
    return;
  }

  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ message: "Unauthorized" });
  }
});

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
});

// ==================== AUTH ROUTES ====================

// Register
fastify.post<{ Body: { email: string; password: string; name?: string } }>(
  "/api/auth/register",
  async (request, reply) => {
    const { email, password, name } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ message: "Email and password required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(400).send({ message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        passwordHash,
      },
    });

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
    };
  },
);

// Login
fastify.post<{ Body: { email: string; password: string } }>(
  "/api/auth/login",
  async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ message: "Email and password required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
    };
  },
);

// Get current user
fastify.get(
  "/api/auth/me",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    return { user };
  },
);

// ==================== RESUME ROUTES ====================

function parseDateSafely(value: string | Date | undefined | null, fallback = new Date()): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

function splitSentences(text: string): string[] {
  return (text || "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function trimAtWordBoundary(text: string, maxChars: number): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const sliced = clean.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trim();
}

function trimToSentenceBoundary(text: string, maxChars: number, minPunctuationIndex: number): string {
  const trimmed = trimAtWordBoundary(text, maxChars);
  const punctuationIndex = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("!"),
    trimmed.lastIndexOf("?"),
  );
  if (punctuationIndex >= minPunctuationIndex) {
    return trimmed.slice(0, punctuationIndex + 1).trim();
  }
  return trimmed;
}

function deRobotize(text: string): string {
  return (text || "")
    .replace(/\bproven expertise in\b/gi, "experience with")
    .replace(/\bdemonstrated ability to\b/gi, "ability to")
    .replace(/\bproduct-first mindset\b/gi, "focus on product quality")
    .replace(/\bresults-driven\b/gi, "focused")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSummaryPreview(text: string, maxChars = 280): string {
  const clean = deRobotize((text || "").replace(/\s+/g, " ").trim());
  if (!clean) return "";
  if (clean.length <= maxChars) return clean;

  const sentences = splitSentences(clean);
  let preview = "";
  for (const sentence of sentences) {
    const next = preview ? `${preview} ${sentence}` : sentence;
    if (next.length > maxChars) break;
    preview = next;
    if (preview.length >= 100 && splitSentences(preview).length >= 1) break;
  }
  if (preview) return trimToSentenceBoundary(preview, maxChars, 70);

  return trimToSentenceBoundary(clean, maxChars, 70);
}

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeAvoidPhrases(text: string, phrases: string[]): string {
  let result = text;
  for (const phrase of phrases) {
    const clean = phrase.trim();
    if (!clean) continue;
    result = result.replace(new RegExp(escapeRegex(clean), "gi"), "");
  }

  return result
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function enforceShortSummaryLength(text: string): string {
  const normalized = (text || "")
    .replace(/;\s+/g, ". ")
    .replace(/:\s+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = splitSentences(normalized);
  if (sentences.length === 0) return "";

  const normalizeLite = (sentence: string) =>
    sentence.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const uniqueSentences: string[] = [];
  for (const sentence of sentences) {
    const candidate = sentence.trim();
    if (!candidate) continue;
    const candidateKey = normalizeLite(candidate);
    if (!candidateKey) continue;
    const duplicated = uniqueSentences.some((existing) => {
      const existingKey = normalizeLite(existing);
      return (
        existingKey === candidateKey ||
        existingKey.includes(candidateKey) ||
        candidateKey.includes(existingKey)
      );
    });
    if (!duplicated) uniqueSentences.push(candidate);
  }

  const targetMin = 3;
  const targetMax = 4;
  const selected = uniqueSentences.slice(0, Math.min(targetMax, uniqueSentences.length));
  while (selected.length < targetMin && selected.length < uniqueSentences.length) {
    selected.push(uniqueSentences[selected.length]);
  }

  let short = selected.join(" ").trim();
  while (short.length < 240 && selected.length < Math.min(targetMax, uniqueSentences.length)) {
    selected.push(uniqueSentences[selected.length]);
    short = selected.join(" ").trim();
  }

  short = trimToSentenceBoundary(short, 520, 120);
  let finalSentences = splitSentences(short);
  if (finalSentences.length > targetMax) {
    short = finalSentences.slice(0, targetMax).join(" ");
    finalSentences = splitSentences(short);
  }
  if (finalSentences.length < targetMin && uniqueSentences.length >= targetMin) {
    short = uniqueSentences.slice(0, targetMin).join(" ");
  }

  return trimAtWordBoundary(short, 520);
}

function buildParagraphs(sentences: string[], targetParagraphs: number): string {
  if (sentences.length === 0) return "";

  const paragraphs: string[] = [];
  let cursor = 0;

  for (let p = 0; p < targetParagraphs; p++) {
    const remainingParagraphs = targetParagraphs - p;
    const remainingSentences = sentences.length - cursor;
    if (remainingSentences <= 0) break;

    const take = Math.ceil(remainingSentences / remainingParagraphs);
    const chunk = sentences.slice(cursor, cursor + take).join(" ").trim();
    if (chunk) paragraphs.push(chunk);
    cursor += take;
  }

  if (paragraphs.length < 2 && sentences.length >= 2) {
    const midpoint = Math.ceil(sentences.length / 2);
    return [
      sentences.slice(0, midpoint).join(" ").trim(),
      sentences.slice(midpoint).join(" ").trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return paragraphs.join("\n\n");
}

function enforceLongSummaryLength(text: string): string {
  const normalized = (text || "")
    .replace(/;\s+/g, ". ")
    .replace(/:\s+/g, ". ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = splitSentences(normalized);
  if (sentences.length === 0) return "";

  const uniqueSentences: string[] = [];
  for (const sentence of sentences) {
    if (uniqueSentences.some((existing) => isNearDuplicateSentence(sentence, existing))) continue;
    uniqueSentences.push(sentence);
  }

  let selected = uniqueSentences.slice(0, 10);
  if (selected.length < 6 && uniqueSentences.length > 6) {
    selected = uniqueSentences.slice(0, 6);
  }

  const targetParagraphs = selected.length >= 8 ? 3 : 2;
  let long = buildParagraphs(selected, targetParagraphs);

  if (long.length > 1700) {
    long = trimAtWordBoundary(long, 1700);
    const reSplit = splitSentences(long);
    if (reSplit.length >= 6) {
      long = buildParagraphs(reSplit.slice(0, 10), reSplit.length >= 8 ? 3 : 2);
    }
  }

  return long;
}

function buildCareerStorySnippet(careerStory: {
  motivation?: string | null;
  turningPoint?: string | null;
  uniqueValue?: string | null;
  transferableSkills?: unknown;
} | null): string {
  if (!careerStory) return "";
  const transferable = formatTransferableSkills(careerStory.transferableSkills);
  const primaryInputs = [
    careerStory.turningPoint || "",
    transferable,
    careerStory.motivation || "",
  ].filter(Boolean);
  const uniqueValue = `${careerStory.uniqueValue || ""}`.trim();
  const hasUniqueOverlap = primaryInputs.some((value) =>
    isNearDuplicateSentence(uniqueValue, `${value}`.trim()),
  );
  const optionalInputs =
    uniqueValue && !hasUniqueOverlap ? [uniqueValue] : [];
  const orderedInputs =
    primaryInputs.length > 0 ?
      [...primaryInputs, ...optionalInputs]
    : [careerStory.motivation || "", uniqueValue].filter(Boolean);

  const combined = orderedInputs
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!combined) return "";
  return trimToSentenceBoundary(cleanSummaryNarrative(deRobotize(combined)), 220, 70);
}

function parseAvoidPhrases(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(/\r?\n|,/)
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeSummaryForDedupe(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSentenceForSimilarity(text: string): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "into",
    "across",
    "about",
    "have",
    "has",
    "had",
    "been",
    "being",
    "are",
    "was",
    "were",
    "is",
    "to",
    "of",
    "in",
    "on",
    "at",
    "by",
    "an",
    "a",
  ]);
  return normalizeSummaryForDedupe(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function sentenceSimilarity(a: string, b: string): number {
  const aTokens = tokenizeSentenceForSimilarity(a);
  const bTokens = tokenizeSentenceForSimilarity(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = new Set([...aSet, ...bSet]).size || 1;
  return intersection / union;
}

function isNearDuplicateSentence(candidate: string, existing: string): boolean {
  const candidateNorm = normalizeSummaryForDedupe(candidate);
  const existingNorm = normalizeSummaryForDedupe(existing);
  if (!candidateNorm || !existingNorm) return false;
  if (candidateNorm === existingNorm) return true;
  if (
    candidateNorm.includes(existingNorm) ||
    existingNorm.includes(candidateNorm)
  ) {
    return true;
  }

  const candidateLead = tokenizeSentenceForSimilarity(candidate).slice(0, 4).join(" ");
  const existingLead = tokenizeSentenceForSimilarity(existing).slice(0, 4).join(" ");
  if (candidateLead && existingLead && candidateLead === existingLead) {
    return true;
  }

  return sentenceSimilarity(candidate, existing) >= 0.72;
}

function rewriteFirstPersonSentence(text: string): string {
  let sentence = text.trim();

  sentence = sentence
    .replace(/^i\W?ve\b/i, "")
    .replace(/^i\W?m\b/i, "")
    .replace(/^i\W?d\b/i, "")
    .replace(/^i\W?ll\b/i, "")
    .replace(/^i did transition from\b/i, "Transitioned from")
    .replace(/^i transitioned from\b/i, "Transitioned from")
    .replace(/^i transition(?:ing)? from\b/i, "Transitioning from")
    .replace(/^i (want|wanted) to\b/i, "Focused on")
    .replace(/^i have\b/i, "Brings")
    .replace(/^i bring\b/i, "Brings")
    .replace(/^i built\b/i, "Built")
    .replace(/^i developed\b/i, "Developed")
    .replace(/^i led\b/i, "Led")
    .replace(/^i\b/i, "");

  sentence = sentence
    .replace(/\bback\s+gtound\b/gi, "background")
    .replace(/\busnique\b/gi, "unique")
    .replace(/\bcommecial\b/gi, "commercial")
    .replace(/\bgive an advantage because bring\b/gi, "brings an advantage by")
    .replace(/\bdesign it clearly, secure it properly, and build it to last\b/gi, "builds clear, secure, and durable software")
    .replace(/\bhow\s+i\s+approach\b/gi, "how to approach")
    .replace(/\bbecause\s+i\s+(?:feel|felt|think|thought|believe|believed)\b[^.?!;]*/gi, "")
    .replace(/\bi\s+(?:feel|felt|think|thought|believe|believed)\b[^.?!;]*/gi, "")
    .replace(/\bi\s+(?:want|wanted)\s+to\b/gi, "focused on")
    // Fix mid-sentence "I" that leave broken grammar — rewrite to coherent form
    .replace(/\bthat if i\b/gi, "that taking control of the future meant")
    .replace(/\bif i\s+(?:want|wanted)\b/gi, "requiring")
    .replace(/\bif i\s+(?:need|needed)\b/gi, "requiring")
    .replace(/\bif i\b/gi, "once")
    .replace(/\bwhen i\b/gi, "when")
    .replace(/\bbecause i\b/gi, "through")
    .replace(/\bthat i\b/gi, "that")
    .replace(/\bmy\s+background\b/gi, "Background")
    .replace(/\bmy\b/gi, "")
    .replace(/\bme\b/gi, "")
    .replace(/^\W?(ve|m|d|ll)\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  return sentence.replace(/\s+/g, " ").trim();
}

function cleanSummaryNarrative(text: string): string {
  const genericPhrases = [
    "highly motivated",
    "detail-oriented",
    "enthusiastic",
    "passion for technology",
    "seeking to leverage",
    "feel like",
    "born to do",
    "better myself",
    "more opportunities",
  ];

  const seen = new Set<string>();
  const kept: string[] = [];

  for (const rawSentence of splitSentences(text)) {
    let sentence = rewriteFirstPersonSentence(rawSentence);
    if (!sentence) continue;

    for (const phrase of genericPhrases) {
      sentence = sentence.replace(new RegExp(escapeRegex(phrase), "gi"), "");
    }

    sentence = sentence
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (/\b(i|my|me|mine)\b/i.test(sentence)) {
      sentence = sentence
        .replace(/\b(i|my|me|mine)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    if (/\b(i|my|me|mine)\b/i.test(sentence)) continue;

    sentence = sentence
      .replace(/^(and|but|so|also)\s+/i, "")
      .replace(/^[,;:\-\s]+/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (sentence.length < 24) continue;

    const key = normalizeSummaryForDedupe(sentence);
    if (!key || seen.has(key)) continue;
    if (kept.some((existing) => isNearDuplicateSentence(sentence, existing))) continue;
    seen.add(key);

    if (!/[.!?]$/.test(sentence)) sentence = `${sentence}.`;
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    kept.push(sentence);
  }

  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function stripCandidateNameNarrative(
  text: string,
  candidateName?: string | null,
): string {
  const base = `${text || ""}`.trim();
  const fullName = `${candidateName || ""}`.trim();
  if (!base || !fullName) return base;

  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] && nameParts[0].length >= 3 ? nameParts[0] : "";
  const refs = Array.from(
    new Set(
      [fullName, firstName]
        .map((value) => `${value || ""}`.trim())
        .filter((value) => value.length >= 3),
    ),
  );
  if (refs.length === 0) return base;

  const rewritten = splitSentences(base)
    .map((rawSentence) => {
      let sentence = `${rawSentence || ""}`.trim();
      if (!sentence) return "";

      for (const ref of refs) {
        const escaped = escapeRegex(ref);
        sentence = sentence
          .replace(new RegExp(`^${escaped}\\b\\s+is\\s+(?:an?\\s+)?`, "i"), "")
          .replace(new RegExp(`^${escaped}\\b\\s+`, "i"), "")
          .replace(new RegExp(`\\b${escaped}'s\\b`, "gi"), "")
          .replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
      }

      sentence = sentence
        .replace(/^\s*is\s+(?:an?\s+)?/i, "")
        .replace(/^\s*(brings|carries|specializes|focuses|approaches)\b\s+/i, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.;!?])/g, "$1")
        .trim();

      if (!sentence || sentence.length < 20) return "";
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      if (!/[.!?]$/.test(sentence)) sentence = `${sentence}.`;
      return sentence;
    })
    .filter(Boolean);

  return rewritten.join(" ").trim();
}

function formatTransferableSkills(value: unknown): string {
  if (!value || typeof value !== "object") return "";

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, mapped]) => {
      const from = `${key || ""}`.trim();
      const to = typeof mapped === "string" ? mapped.trim() : "";
      if (!from || !to) return "";
      return `${from} -> ${to}`;
    })
    .filter(Boolean);

  return entries.slice(0, 6).join("; ");
}

type JobExtraction = {
  mustHaveSkills: string[];
  niceToHave: string[];
  responsibilities: string[];
  keywords: string[];
  senioritySignals: string[];
  roleFocus: string;
};

type ResumeEvidenceBullet = {
  id: string;
  sourceType: "experience" | "project";
  sourceIndex: number;
  parentId: string;
  title: string;
  company?: string;
  text: string;
  tags: string[];
  technologies?: string[];
  embedding?: number[];
};

type ResponsibilityMapping = {
  responsibility: string;
  evidenceIds: string[];
  notes?: string;
};

type JobMappingResult = {
  responsibilityMappings: ResponsibilityMapping[];
  missingGaps: string[];
  recommendedOrder: string[];
  selectedEvidenceIds: string[];
};

function sanitizeStringArray(value: unknown, maxItems = 12): string[] {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "number" || typeof item === "boolean") return `${item}`.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const picked =
          toStringValue(record.description) ||
          toStringValue(record.text) ||
          toStringValue(record.name) ||
          toStringValue(record.title) ||
          "";
        return picked.trim();
      }
      return "";
    })
    .filter((item) => Boolean(item) && normalizeSummaryForDedupe(item) !== "object object")
    .slice(0, maxItems);
}

function mergeUniqueStrings(...inputs: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const input of inputs) {
    for (const raw of input || []) {
      const value = `${raw || ""}`.trim();
      if (!value) continue;
      const key = normalizeSummaryForDedupe(value);
      if (key === "object object") continue;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(value);
    }
  }
  return merged;
}

function isLikelySkill(value: string): boolean {
  const v = `${value || ""}`.trim();
  if (!v) return false;
  if (v.length < 2 || v.length > 40) return false;
  if (/\b(chicago|south bend|nappanee|i\.c stars|intern|local\s*\d+)\b/i.test(v)) return false;
  if (/[,.!?]{2,}/.test(v)) return false;
  if (/\b(and|because|while|selected)\b/i.test(v) && v.split(" ").length > 3) return false;
  return true;
}

function splitDescriptionIntoBullets(text: string): string[] {
  const raw = `${text || ""}`.trim();
  if (!raw) return [];

  const normalized = raw
    .replace(/\r/g, "\n")
    .replace(/[\u2022\u25CF\u25AA\u25E6]/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const explicitBullets = normalized
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

  if (explicitBullets.length >= 2) {
    return explicitBullets.slice(0, 8);
  }

  return splitSentences(normalized).slice(0, 8);
}

function detectEvidenceTags(text: string): string[] {
  const value = normalizeSummaryForDedupe(text);
  const tags: string[] = [];
  if (/\b(performance|latency|throughput|optimi|speed|faster|scale)\b/.test(value)) {
    tags.push("performance");
  }
  if (/\b(reliab|uptime|incident|stability|durable)\b/.test(value)) {
    tags.push("reliability");
  }
  if (/\b(security|secure|auth|oauth|jwt|encryption|compliance)\b/.test(value)) {
    tags.push("security");
  }
  if (/\b(cost|saving|efficien|budget|resource)\b/.test(value)) {
    tags.push("cost");
  }
  if (/\b(developer experience|dx|tooling|workflow|automation)\b/.test(value)) {
    tags.push("dx");
  }
  if (/\b(lead|mentor|guide|collaborat|stakeholder|cross functional)\b/.test(value)) {
    tags.push("leadership");
  }
  return [...new Set(tags)];
}

function buildEvidenceBullets(input: {
  experiences: ImmutableExperience[];
  projects: ImmutableProject[];
  snapshot?: Record<string, unknown>;
}): ResumeEvidenceBullet[] {
  const evidence: ResumeEvidenceBullet[] = [];
  const snapshot = input.snapshot || {};
  const snapshotExperiences = Array.isArray(snapshot.experiences) ? snapshot.experiences : [];
  const snapshotProjects = Array.isArray(snapshot.projects) ? snapshot.projects : [];

  input.experiences.forEach((exp, expIndex) => {
    const snapshotExp = toRecord(snapshotExperiences[expIndex]);
    const snapshotBullets = sanitizeStringArray(snapshotExp.bullets, 10);
    const snapshotAchievements = extractAchievementDescriptions(snapshotExp.achievements, 10);
    const snapshotTechnologies = sanitizeStringArray(snapshotExp.technologies, 12);
    const generatedBullets = splitDescriptionIntoBullets(exp.description);
    const bullets = mergeUniqueStrings(
      snapshotBullets,
      snapshotAchievements,
      generatedBullets,
      snapshotTechnologies.map((tech) => `Used ${tech} in delivery and implementation`),
    ).slice(0, 12);
    const parentId = `exp_${expIndex}`;
    const embedding = Array.isArray(snapshotExp.embedding) ?
        (snapshotExp.embedding as number[]).filter((v) => typeof v === "number")
      : [];

    bullets.forEach((bullet, bulletIndex) => {
      const text = bullet.trim();
      if (!text) return;
      evidence.push({
        id: `${parentId}_b_${bulletIndex}`,
        sourceType: "experience",
        sourceIndex: expIndex,
        parentId,
        title: exp.title,
        company: exp.company,
        text,
        tags: detectEvidenceTags(text),
        technologies: snapshotTechnologies,
        embedding: embedding.length > 0 ? embedding : undefined,
      });
    });
  });

  input.projects.forEach((project, projectIndex) => {
    const snapshotProject = toRecord(snapshotProjects[projectIndex]);
    const snapshotBullets = sanitizeStringArray(snapshotProject.bullets, 8);
    const snapshotAchievements = extractAchievementDescriptions(snapshotProject.achievements, 8);
    const snapshotTechnologies = sanitizeStringArray(snapshotProject.technologies, 12);
    const generatedBullets = splitDescriptionIntoBullets(project.description);
    const bullets = mergeUniqueStrings(
      snapshotBullets,
      snapshotAchievements,
      generatedBullets,
      snapshotTechnologies.map((tech) => `Built with ${tech}`),
    ).slice(0, 10);
    const parentId = `proj_${projectIndex}`;
    const embedding = Array.isArray(snapshotProject.embedding) ?
        (snapshotProject.embedding as number[]).filter((v) => typeof v === "number")
      : [];

    bullets.forEach((bullet, bulletIndex) => {
      const text = bullet.trim();
      if (!text) return;
      evidence.push({
        id: `${parentId}_b_${bulletIndex}`,
        sourceType: "project",
        sourceIndex: projectIndex,
        parentId,
        title: project.name,
        company: "",
        text,
        tags: detectEvidenceTags(text),
        technologies: snapshotTechnologies,
        embedding: embedding.length > 0 ? embedding : undefined,
      });
    });
  });

  return evidence;
}

function dotProduct(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += a[i] * b[i];
  return sum;
}

function vectorMagnitude(a: number[]): number {
  return Math.sqrt(a.reduce((acc, value) => acc + value * value, 0));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  const denominator = vectorMagnitude(a) * vectorMagnitude(b);
  if (!denominator) return 0;
  return dotProduct(a, b) / denominator;
}

function keywordDictionary(): string[] {
  return [
    "typescript",
    "javascript",
    "python",
    "node",
    "node.js",
    "react",
    "next.js",
    "graphql",
    "rest",
    "sql",
    "postgresql",
    "mysql",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "terraform",
    "ci/cd",
    "git",
    "testing",
    "unit testing",
    "integration testing",
    "e2e",
    "api",
    "system design",
    "microservices",
    "data engineering",
    "etl",
    "airflow",
    "spark",
    "pandas",
    "fastapi",
    "django",
    "spring",
    "c#",
    "java",
    "go",
  ];
}

function inferRoleFocus(text: string, title: string): string {
  const combined = `${title} ${text}`.toLowerCase();
  if (/\bplatform\b/.test(combined)) return "platform";
  if (/\bbackend|api|server|microservice|data\b/.test(combined)) return "backend";
  if (/\bfrontend|ui|ux|react|next\b/.test(combined)) return "frontend";
  if (/\bfull[\s-]?stack\b/.test(combined)) return "fullstack";
  return "software-engineering";
}

function fallbackExtractJobProfile(jobDescription: string, jobTitle?: string): JobExtraction {
  const text = `${jobDescription || ""}`.trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const responsibilityLines = lines
    .filter((line) =>
      /^(\d+[\).]|[-*])\s+/.test(line) ||
      /\b(design|develop|maintain|collaborate|optimize|troubleshoot|participate|contribute)\b/i.test(line),
    )
    .map((line) => line.replace(/^(\d+[\).]|[-*])\s+/, "").trim());

  const dictionary = keywordDictionary();
  const lowered = ` ${text.toLowerCase()} `;
  const keywords = dictionary.filter((keyword) => lowered.includes(` ${keyword.toLowerCase()} `));

  const senioritySignals = [
    "owning",
    "ownership",
    "mentoring",
    "system design",
    "architecture",
    "cross-functional",
    "stakeholder",
    "code review",
  ].filter((signal) => lowered.includes(signal));

  const mustHaveSkills = keywords.slice(0, 10);
  const responsibilities = responsibilityLines.slice(0, 10);

  return {
    mustHaveSkills,
    niceToHave: keywords.slice(10, 16),
    responsibilities: responsibilities.length > 0 ? responsibilities : splitSentences(text).slice(0, 8),
    keywords: keywords.slice(0, 20),
    senioritySignals,
    roleFocus: inferRoleFocus(text, jobTitle || ""),
  };
}

function normalizeJobExtraction(raw: any, fallback: JobExtraction): JobExtraction {
  const merged = {
    mustHaveSkills: sanitizeStringArray(raw?.mustHaveSkills, 12),
    niceToHave: sanitizeStringArray(raw?.niceToHave, 12),
    responsibilities: sanitizeStringArray(raw?.responsibilities, 10),
    keywords: sanitizeStringArray(raw?.keywords, 24),
    senioritySignals: sanitizeStringArray(raw?.senioritySignals, 10),
    roleFocus: `${raw?.roleFocus || ""}`.trim().toLowerCase(),
  };

  const roleFocus = ["backend", "frontend", "fullstack", "platform", "data", "software-engineering"].includes(merged.roleFocus)
    ? merged.roleFocus
    : fallback.roleFocus;

  return {
    mustHaveSkills: mergeUniqueStrings(fallback.mustHaveSkills, merged.mustHaveSkills).slice(0, 12),
    niceToHave: mergeUniqueStrings(fallback.niceToHave, merged.niceToHave).slice(0, 12),
    responsibilities: mergeUniqueStrings(fallback.responsibilities, merged.responsibilities).slice(0, 10),
    keywords: mergeUniqueStrings(fallback.keywords, merged.keywords).slice(0, 24),
    senioritySignals: mergeUniqueStrings(fallback.senioritySignals, merged.senioritySignals).slice(0, 12),
    roleFocus,
  };
}

function scoreEvidenceBullet(
  bullet: ResumeEvidenceBullet,
  job: JobExtraction,
  requestEmbedding: number[] = [],
): { score: number; matchedKeywords: string[] } {
  const text = `${bullet.title} ${bullet.company || ""} ${bullet.text}`;
  const textNorm = normalizeSummaryForDedupe(text);
  const matchedKeywords = [...new Set(
    [...job.mustHaveSkills, ...job.keywords]
      .map((k) => k.trim())
      .filter(Boolean)
      .filter((keyword) => textNorm.includes(normalizeSummaryForDedupe(keyword))),
  )];
  const techMatches = (bullet.technologies || []).filter((tech) =>
    [...job.mustHaveSkills, ...job.keywords].some((keyword) =>
      normalizeSummaryForDedupe(tech).includes(normalizeSummaryForDedupe(keyword)) ||
      normalizeSummaryForDedupe(keyword).includes(normalizeSummaryForDedupe(tech)),
    ),
  );

  const responsibilitiesScore = job.responsibilities.reduce((acc, responsibility) => {
    return Math.max(acc, sentenceSimilarity(text, responsibility));
  }, 0);

  const seniorityHits = job.senioritySignals.filter((signal) =>
    textNorm.includes(normalizeSummaryForDedupe(signal)),
  ).length;

  const keywordScore = matchedKeywords.length * 1.8 + techMatches.length * 1.2;
  const tagScore = bullet.tags.length * 0.4;
  const sourceBoost = bullet.sourceType === "experience" ? 0.7 : 0.2;
  const lexicalScore = responsibilitiesScore * 5 + keywordScore + seniorityHits * 0.9 + tagScore + sourceBoost;
  const embeddingScore =
    requestEmbedding.length > 0 && Array.isArray(bullet.embedding) ?
      cosineSimilarity(requestEmbedding, bullet.embedding || []) * 3
    : 0;

  return { score: lexicalScore + embeddingScore, matchedKeywords };
}

function rankEvidenceBullets(
  bullets: ResumeEvidenceBullet[],
  job: JobExtraction,
  limit = 24,
): Array<ResumeEvidenceBullet & { score: number; matchedKeywords: string[] }> {
  const pseudoQueryEmbedding: number[] = [];
  const ranked = bullets
    .map((bullet) => {
      const scored = scoreEvidenceBullet(bullet, job, pseudoQueryEmbedding);
      return {
        ...bullet,
        score: scored.score,
        matchedKeywords: scored.matchedKeywords,
      };
    })
    .sort((a, b) => b.score - a.score);

  const selected: Array<ResumeEvidenceBullet & { score: number; matchedKeywords: string[] }> = [];
  const selectedIds = new Set<string>();
  const addIfMissing = (item: ResumeEvidenceBullet & { score: number; matchedKeywords: string[] }) => {
    if (selectedIds.has(item.id)) return;
    selected.push(item);
    selectedIds.add(item.id);
  };

  const topExperienceParents = [...new Set(
    ranked.filter((item) => item.sourceType === "experience").map((item) => item.parentId),
  )].slice(0, 3);

  for (const parentId of topExperienceParents) {
    const pick = ranked.find((item) => item.parentId === parentId);
    if (pick) addIfMissing(pick);
  }

  const topProject = ranked.find((item) => item.sourceType === "project");
  if (topProject) addIfMissing(topProject);

  for (const item of ranked) {
    if (selected.length >= limit) break;
    addIfMissing(item);
  }

  return selected.slice(0, limit);
}

function buildRuleBasedMapping(
  job: JobExtraction,
  rankedEvidence: Array<ResumeEvidenceBullet & { score: number; matchedKeywords: string[] }>,
): JobMappingResult {
  const mappings: ResponsibilityMapping[] = [];
  const selectedEvidenceIds = new Set<string>();

  for (const responsibility of job.responsibilities.slice(0, 10)) {
    const candidates = rankedEvidence
      .map((evidence) => ({
        evidence,
        score:
          sentenceSimilarity(responsibility, evidence.text) * 5 +
          sentenceSimilarity(responsibility, `${evidence.title} ${evidence.company || ""}`) * 2 +
          sentenceSimilarity(responsibility, (evidence.technologies || []).join(", ")) * 1.5 +
          evidence.score * 0.15,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((candidate) => candidate.score > 0.35);

    const evidenceIds = candidates.map((candidate) => candidate.evidence.id);
    evidenceIds.forEach((id) => selectedEvidenceIds.add(id));
    if (evidenceIds.length > 0) {
      mappings.push({ responsibility, evidenceIds });
    }
  }

  if (mappings.length === 0) {
    rankedEvidence.slice(0, 8).forEach((item) => selectedEvidenceIds.add(item.id));
  }

  const coveredResponsibilities = new Set(mappings.map((mapping) => mapping.responsibility));
  const missingGaps = job.responsibilities.filter((item) => !coveredResponsibilities.has(item)).slice(0, 6);
  const recommendedOrder = [...new Set(
    rankedEvidence
      .filter((item) => selectedEvidenceIds.has(item.id))
      .map((item) => item.parentId),
  )].slice(0, 8);

  return {
    responsibilityMappings: mappings,
    missingGaps,
    recommendedOrder,
    selectedEvidenceIds: [...selectedEvidenceIds],
  };
}

type TailoringAlignmentReport = {
  score: number;
  keywordCoverage: number;
  responsibilityCoverage: number;
  issues: string[];
};

function assessTailoringAlignment(input: {
  job: JobExtraction;
  summaryShort: string;
  summaryLong: string;
  experienceDescriptions: string[];
  selectedSkills: string[];
  baselineSkills: string[];
  mapping: JobMappingResult;
}): TailoringAlignmentReport {
  const issues: string[] = [];
  const fullText = `${input.summaryShort} ${input.summaryLong} ${input.experienceDescriptions.join(" ")}`
    .toLowerCase();
  const mustKeywords = [...new Set(
    [...input.job.mustHaveSkills, ...input.job.keywords].map((item) =>
      normalizeSummaryForDedupe(item),
    ).filter(Boolean),
  )];
  const matched = mustKeywords.filter((keyword) => keyword && fullText.includes(keyword));
  const keywordCoverage = mustKeywords.length > 0 ? matched.length / mustKeywords.length : 1;

  const mappedResponsibilities = input.mapping.responsibilityMappings.filter(
    (item) => item.evidenceIds.length > 0,
  ).length;
  const responsibilityCoverage =
    input.job.responsibilities.length > 0 ?
      mappedResponsibilities / input.job.responsibilities.length
    : 1;

  const baselineSkillKeys = new Set(input.baselineSkills.map((skill) => normalizeSkillKey(skill)));
  const invalidSkills = input.selectedSkills.filter(
    (skill) => !baselineSkillKeys.has(normalizeSkillKey(skill)),
  );

  if (keywordCoverage < 0.45) issues.push("low_keyword_coverage");
  if (responsibilityCoverage < 0.5) issues.push("low_responsibility_coverage");
  if (invalidSkills.length > 0) issues.push("non_resume_skills_detected");

  let score = 100;
  score -= Math.max(0, (0.6 - keywordCoverage) * 45);
  score -= Math.max(0, (0.6 - responsibilityCoverage) * 40);
  score -= invalidSkills.length > 0 ? 20 : 0;
  score = Math.max(0, Math.round(score));

  return {
    score,
    keywordCoverage: Number(keywordCoverage.toFixed(3)),
    responsibilityCoverage: Number(responsibilityCoverage.toFixed(3)),
    issues,
  };
}

function normalizeSkillKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]/g, "");
}

function selectTailoredSkills(
  job: JobExtraction,
  baselineSkills: string[],
  modelSkills: string[] = [],
): string[] {
  const baselineMap = new Map<string, string>();
  for (const skill of baselineSkills) {
    const trimmed = `${skill || ""}`.trim();
    if (!trimmed) continue;
    baselineMap.set(normalizeSkillKey(trimmed), trimmed);
  }

  const desiredOrder = [
    ...job.mustHaveSkills,
    ...job.keywords,
    ...job.niceToHave,
    ...modelSkills,
  ]
    .map((item) => `${item || ""}`.trim())
    .filter(Boolean);

  const selected: string[] = [];
  const seen = new Set<string>();
  for (const desired of desiredOrder) {
    const key = normalizeSkillKey(desired);
    const baselineSkill = baselineMap.get(key);
    if (!baselineSkill || seen.has(key)) continue;
    selected.push(baselineSkill);
    seen.add(key);
    if (selected.length >= 16) break;
  }

  if (selected.length < 8) {
    for (const skill of baselineSkills) {
      const key = normalizeSkillKey(skill);
      if (seen.has(key)) continue;
      selected.push(skill);
      seen.add(key);
      if (selected.length >= 12) break;
    }
  }

  return selected;
}

function reduceShortLongOverlap(shortSummary: string, longSummary: string): { short: string; long: string } {
  const shortSentences = splitSentences(shortSummary);
  const paragraphs = splitParagraphs(longSummary);
  if (shortSentences.length === 0 || paragraphs.length === 0) {
    return { short: shortSummary, long: longSummary };
  }

  const filteredParagraphs = paragraphs.map((paragraph, paragraphIndex) => {
    const longSentences = splitSentences(paragraph);
    const filtered = longSentences.filter((sentence) => {
      if (paragraphIndex > 0) return true;
      return !shortSentences.some((shortSentence) => isNearDuplicateSentence(sentence, shortSentence));
    });
    return (filtered.length >= 2 ? filtered : longSentences).join(" ").trim();
  });

  const rebuiltLong = filteredParagraphs.filter(Boolean).join("\n\n").trim();
  return {
    short: shortSummary,
    long: rebuiltLong || longSummary,
  };
}

function buildTailoredSummaries(input: {
  generatedSummary?: string;
  generatedSummaryShort?: string;
  generatedSummaryLong?: string;
  sourceShort?: string | null;
  sourceLong?: string | null;
  storySnippet?: string;
  avoidPhrases?: string[];
  candidateName?: string | null;
}): { short: string; long: string } {
  const generatedSummary = cleanSummaryNarrative(
    deRobotize((input.generatedSummary || "").replace(/\s+/g, " ").trim()),
  );
  const generatedSummaryShort = cleanSummaryNarrative(deRobotize(
    (input.generatedSummaryShort || "").replace(/\s+/g, " ").trim(),
  ));
  const generatedSummaryLong = cleanSummaryNarrative(deRobotize(
    (input.generatedSummaryLong || "").replace(/\s+/g, " ").trim(),
  ));
  const fallback = cleanSummaryNarrative(deRobotize(
    `${(input.sourceLong || "").trim()} ${(input.sourceShort || "").trim()}`
      .replace(/\s+/g, " ")
      .trim(),
  ));
  const story = cleanSummaryNarrative(
    deRobotize((input.storySnippet || "").replace(/\s+/g, " ").trim()),
  );
  const avoidPhrases = input.avoidPhrases || [];

  const baseLong =
    generatedSummaryLong ||
    generatedSummary ||
    generatedSummaryShort ||
    fallback;

  if (!baseLong && !story) {
    return { short: "", long: "" };
  }

  const hasTransitionSignal = /\btransition(?:ed|ing)?\b|\bbackground in\b|\bbrings\b/i;
  const shouldAppendStory = Boolean(story) && (!baseLong || !hasTransitionSignal.test(baseLong));
  const enrichedLong = shouldAppendStory ? `${baseLong} ${story}`.trim() : baseLong;
  let long = enforceLongSummaryLength(cleanSummaryNarrative(enrichedLong));
  let short = enforceShortSummaryLength(
    cleanSummaryNarrative(generatedSummaryShort || generatedSummary || long),
  );

  if (!short) short = enforceShortSummaryLength(long);
  if (!long) long = short;
  if (long.length < short.length) long = short;

  short = cleanSummaryNarrative(removeAvoidPhrases(deRobotize(short), avoidPhrases));
  long = cleanSummaryNarrative(removeAvoidPhrases(deRobotize(long), avoidPhrases));
  short = cleanSummaryNarrative(stripCandidateNameNarrative(short, input.candidateName));
  long = cleanSummaryNarrative(stripCandidateNameNarrative(long, input.candidateName));

  short = enforceShortSummaryLength(
    cleanSummaryNarrative(`${generatedSummaryShort} ${generatedSummary} ${short}`.trim()) || long,
  );
  if (splitSentences(long).length < 6) {
    const expansion = cleanSummaryNarrative(
      `${generatedSummaryLong} ${generatedSummary} ${fallback} ${story}`.trim(),
    );
    long = enforceLongSummaryLength(cleanSummaryNarrative(`${long} ${expansion}`.trim()));
  } else {
    long = enforceLongSummaryLength(long);
  }

  short = enforceShortSummaryLength(short || long);
  if (splitSentences(short).length < 3) {
    short = enforceShortSummaryLength(long);
  }
  if (!long) long = short;
  const reducedOverlap = reduceShortLongOverlap(short, long);
  short = enforceShortSummaryLength(reducedOverlap.short || short);
  long = enforceLongSummaryLength(reducedOverlap.long || long);

  return { short, long };
}

type SummaryQualityReport = {
  score: number;
  passed: boolean;
  issues: string[];
};

function splitParagraphs(text: string): string[] {
  return (text || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function findSummaryArtifacts(text: string): string[] {
  const patterns = [
    /\bback gtound\b/i,
    /\busnique\b/i,
    /\bcommecial\b/i,
    /\bapllication\b/i,
    /\bive\b/i,
    /\bi m\b/i,
    /^\W?(ve|m|d|ll)\b/i,
  ];

  const hits: string[] = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) hits.push(pattern.source);
  }
  return hits;
}

function findNearDuplicateSentences(text: string): number {
  const sentences = splitSentences(text);
  let duplicates = 0;
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      if (isNearDuplicateSentence(sentences[i], sentences[j])) {
        duplicates += 1;
        break;
      }
    }
  }
  return duplicates;
}

function assessSummaryQuality(shortSummary: string, longSummary: string): SummaryQualityReport {
  let score = 100;
  const issues: string[] = [];

  const shortSentences = splitSentences(shortSummary);
  if (shortSentences.length < 3 || shortSentences.length > 5) {
    score -= 20;
    issues.push("summaryShort_sentence_count");
  }

  const paragraphs = splitParagraphs(longSummary);
  if (paragraphs.length < 2 || paragraphs.length > 3) {
    score -= 20;
    issues.push("summaryLong_paragraph_count");
  }

  for (const paragraph of paragraphs) {
    const sentenceCount = splitSentences(paragraph).length;
    if (sentenceCount < 2 || sentenceCount > 4) {
      score -= 8;
      issues.push("summaryLong_paragraph_sentence_count");
    }
  }

  if (/\b(i|my|me|mine)\b/i.test(`${shortSummary} ${longSummary}`)) {
    score -= 15;
    issues.push("first_person_pronouns");
  }

  const duplicateCount = findNearDuplicateSentences(`${shortSummary} ${longSummary}`);
  if (duplicateCount > 0) {
    score -= Math.min(18, duplicateCount * 6);
    issues.push("near_duplicate_sentences");
  }

  const artifactCount = findSummaryArtifacts(`${shortSummary} ${longSummary}`).length;
  if (artifactCount > 0) {
    score -= Math.min(15, artifactCount * 5);
    issues.push("grammar_or_typo_artifacts");
  }

  if ((shortSummary || "").length < 260) {
    score -= 8;
    issues.push("summaryShort_too_thin");
  }
  if ((longSummary || "").length < 650) {
    score -= 10;
    issues.push("summaryLong_too_thin");
  }

  score = Math.max(0, score);
  const passed = score >= 80 &&
    !issues.includes("summaryShort_sentence_count") &&
    !issues.includes("summaryLong_paragraph_count") &&
    !issues.includes("near_duplicate_sentences") &&
    !issues.includes("grammar_or_typo_artifacts");

  return { score, passed, issues };
}

function extractNumericTokens(text: string): string[] {
  return Array.from(
    new Set(
      (text.toLowerCase().match(/\$?[\d,.]+%?|\b\d+[kmb]\b/g) || []).map((token) =>
        token.replace(/,/g, ""),
      ),
    ),
  );
}

function sanitizeTailoredDescription(
  tailoredDescription: string | undefined,
  sourceDescription: string | null | undefined,
): string {
  const stripObjectTokens = (value: string) =>
    value
      .replace(/\[object object\]\.?/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

  const tailored = stripObjectTokens((tailoredDescription || "").trim());
  const source = stripObjectTokens((sourceDescription || "").trim());
  if (!source) return tailored;
  if (!tailored) return source;

  const sourceIsInProgress = /\b(building|developing|designing|creating|implementing|working on|in progress|currently)\b/i.test(source);
  const tailoredSoundsCompleted = /\b(built|architected|implemented|launched|delivered|completed|created|designed)\b/i.test(
    tailored,
  );
  const tailoredShowsProgress = /\b(building|developing|designing|creating|supporting|currently|in progress)\b/i.test(
    tailored,
  );
  if (sourceIsInProgress && (tailoredSoundsCompleted || !tailoredShowsProgress)) {
    return source;
  }

  const sourceNumbers = extractNumericTokens(source);
  const tailoredNumbers = extractNumericTokens(tailored);
  const hasUnseenNumber = tailoredNumbers.some((token) => !sourceNumbers.includes(token));
  if (hasUnseenNumber) {
    return source;
  }

  return deRobotize(tailored);
}

function parseSkillProficiency(value: string | undefined): "beginner" | "intermediate" | "advanced" | "expert" {
  const normalized = (value || "").toLowerCase();
  if (
    normalized === "beginner" ||
    normalized === "intermediate" ||
    normalized === "advanced" ||
    normalized === "expert"
  ) {
    return normalized;
  }
  return "intermediate";
}

type ImmutableExperience = {
  title: string;
  company: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  current: boolean;
  location: string;
};

type ImmutableProject = {
  name: string;
  description: string;
  role: string;
  githubUrl: string | null;
  liveUrl: string | null;
  startDate: Date;
  endDate: Date | null;
  featured: boolean;
};

type ImmutableEducation = {
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate: Date | null;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildEducationFactText(education: Array<{ degree?: string | null; field?: string | null; institution?: string | null }>): string {
  if (!Array.isArray(education) || education.length === 0) {
    return "No formal education records provided. Candidate may be self-taught.";
  }

  const lines = education
    .map((entry) => {
      const degree = `${entry.degree || ""}`.trim();
      const field = `${entry.field || ""}`.trim();
      const institution = `${entry.institution || ""}`.trim();
      return [degree, field, institution].filter(Boolean).join(" - ");
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join("; ") : "No formal education records provided. Candidate may be self-taught.";
}

function sanitizeCoverLetterClaims(
  text: string,
  education: Array<{ degree?: string | null; field?: string | null; institution?: string | null }>,
): string {
  let cleaned = `${text || ""}`.trim();
  if (!cleaned) return cleaned;

  const educationBlob = education
    .map((entry) => `${entry.degree || ""} ${entry.field || ""} ${entry.institution || ""}`.toLowerCase())
    .join(" ");
  const hasCSDegree = /\b(computer science|software engineering)\b/i.test(educationBlob);
  const hasAnyDegree = /\b(b\.?s\.?|bachelor|a\.?a\.?s\.?|associate|m\.?s\.?|master|phd|doctorate)\b/i.test(
    educationBlob,
  );

  if (!hasCSDegree) {
    cleaned = cleaned.replace(
      /\b(strong|solid|robust)?\s*foundation in computer science\b/gi,
      "strong software engineering fundamentals built through self-directed learning",
    );
    cleaned = cleaned.replace(
      /\bdegree in computer science\b/gi,
      "self-directed software engineering training",
    );
  }

  if (!hasAnyDegree) {
    cleaned = cleaned.replace(
      /\bbachelor(?:'s)? degree\b/gi,
      "professional experience and self-directed training",
    );
  }

  cleaned = cleaned.replace(
    /\bwith a strong software engineering fundamentals\b/gi,
    "with strong software engineering fundamentals",
  );

  return cleaned
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .trim();
}

function finalizeCoverLetterBody(
  text: string,
  tone: CoverLetterTone,
  education: Array<{ degree?: string | null; field?: string | null; institution?: string | null }>,
): string {
  const sanitized = sanitizeCoverLetterClaims(text, education);
  const toned = applyCoverLetterTonePostProcessing(sanitized, tone);
  return sanitizeCoverLetterClaims(toned, education);
}

function extractAchievementDescriptions(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((achievement) => toStringValue((achievement as any)?.description || achievement))
    .filter(Boolean)
    .slice(0, maxItems);
}

function enrichSnapshotForEvidence(
  snapshot: Record<string, unknown>,
  fallbackResumeData: Record<string, unknown>,
): Record<string, unknown> {
  const sourceExperiences = Array.isArray(snapshot.experiences) ? snapshot.experiences : [];
  const fallbackExperiences = Array.isArray(fallbackResumeData.experiences) ? fallbackResumeData.experiences : [];
  const sourceProjects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const fallbackProjects = Array.isArray(fallbackResumeData.projects) ? fallbackResumeData.projects : [];

  const baseExperiences = sourceExperiences.length > 0 ? sourceExperiences : fallbackExperiences;
  const baseProjects = sourceProjects.length > 0 ? sourceProjects : fallbackProjects;

  const experiences = baseExperiences.map((item, index) => {
    const primary = toRecord(item);
    const fallback = toRecord(fallbackExperiences[index]);
    const description = toStringValue(primary.description) || toStringValue(fallback.description);
    const achievements = mergeUniqueStrings(
      extractAchievementDescriptions(primary.achievements, 12),
      extractAchievementDescriptions(fallback.achievements, 12),
    ).slice(0, 12);
    const technologies = mergeUniqueStrings(
      sanitizeStringArray(primary.technologies, 12),
      sanitizeStringArray(fallback.technologies, 12),
    ).slice(0, 12);
    const bullets = mergeUniqueStrings(
      sanitizeStringArray(primary.bullets, 12),
      splitDescriptionIntoBullets(description),
      achievements,
    ).slice(0, 12);
    return {
      ...fallback,
      ...primary,
      description,
      achievements,
      technologies,
      bullets,
    };
  });

  const projects = baseProjects.map((item, index) => {
    const primary = toRecord(item);
    const fallback = toRecord(fallbackProjects[index]);
    const description = toStringValue(primary.description) || toStringValue(fallback.description);
    const achievements = mergeUniqueStrings(
      extractAchievementDescriptions(primary.achievements, 10),
      extractAchievementDescriptions(fallback.achievements, 10),
    ).slice(0, 10);
    const technologies = mergeUniqueStrings(
      sanitizeStringArray(primary.technologies, 12),
      sanitizeStringArray(fallback.technologies, 12),
    ).slice(0, 12);
    const bullets = mergeUniqueStrings(
      sanitizeStringArray(primary.bullets, 10),
      splitDescriptionIntoBullets(description),
      achievements,
    ).slice(0, 10);
    return {
      ...fallback,
      ...primary,
      description,
      achievements,
      technologies,
      bullets,
    };
  });

  return {
    ...fallbackResumeData,
    ...snapshot,
    experiences,
    projects,
  };
}

function dateToIsoDate(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(value as any);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatYearMonth(value: Date | null | undefined): string {
  if (!value) return "Unknown";
  return value.toISOString().slice(0, 7);
}

function toImmutableExperience(value: any): ImmutableExperience {
  const startDate = parseDateSafely(value?.startDate, new Date());
  const current = Boolean(value?.current);
  const endDate = current ? null : (value?.endDate ? parseDateSafely(value.endDate, startDate) : null);
  return {
    title: toStringValue(value?.title) || "Role",
    company: toStringValue(value?.company) || "Company",
    description: toStringValue(value?.description),
    startDate,
    endDate,
    current,
    location: toStringValue(value?.location),
  };
}

function toImmutableProject(value: any): ImmutableProject {
  const startDate = parseDateSafely(value?.startDate, new Date());
  const endDate = value?.endDate ? parseDateSafely(value.endDate, startDate) : null;
  return {
    name: toStringValue(value?.name) || "Project",
    description: toStringValue(value?.description),
    role: toStringValue(value?.role),
    githubUrl: toStringValue(value?.githubUrl || value?.url) || null,
    liveUrl: toStringValue(value?.liveUrl) || null,
    startDate,
    endDate,
    featured: Boolean(value?.featured),
  };
}

function toImmutableEducation(value: any): ImmutableEducation {
  const startDate = parseDateSafely(value?.startDate, new Date());
  const endDate = value?.endDate ? parseDateSafely(value.endDate, startDate) : null;
  return {
    institution: toStringValue(value?.institution) || "Institution",
    degree: toStringValue(value?.degree),
    field: toStringValue(value?.field),
    startDate,
    endDate,
  };
}

function buildUploadSnapshot(parsed: any, fileName: string) {
  const skillsObject = toRecord(parsed?.skills);
  const allSkills = [
    ...(Array.isArray(parsed?.skills) ? parsed.skills : []),
    ...(Array.isArray(skillsObject.technical) ? (skillsObject.technical as string[]) : []),
    ...(Array.isArray(skillsObject.languages) ? (skillsObject.languages as string[]) : []),
    ...(Array.isArray(skillsObject.frameworks) ? (skillsObject.frameworks as string[]) : []),
    ...(Array.isArray(skillsObject.tools) ? (skillsObject.tools as string[]) : []),
  ]
    .map((skill) => `${skill || ""}`.trim())
    .filter(Boolean);

  const uniqueSkills = [...new Set(allSkills.map((skill) => skill.toLowerCase()))]
    .map((key) => allSkills.find((skill) => skill.toLowerCase() === key)!)
    .filter((skill) => Boolean(skill) && isLikelySkill(skill));

  return {
    sourceFileName: fileName,
    capturedAt: new Date().toISOString(),
    summary: {
      short: toStringValue(parsed?.summary?.short),
      long: toStringValue(parsed?.summary?.long),
    },
    experiences: (Array.isArray(parsed?.experiences) ? parsed.experiences : []).map((exp: any) => ({
      title: toStringValue(exp?.title),
      company: toStringValue(exp?.company),
      description: toStringValue(exp?.description),
      achievements: extractAchievementDescriptions(exp?.achievements, 12),
      technologies: sanitizeStringArray(exp?.technologies, 12),
      bullets: mergeUniqueStrings(
        splitDescriptionIntoBullets(toStringValue(exp?.description)),
        extractAchievementDescriptions(exp?.achievements, 12),
      ).slice(0, 12),
      embedding: Array.isArray(exp?.embedding) ?
          exp.embedding.filter((value: unknown) => typeof value === "number")
        : [],
      startDate: dateToIsoDate(exp?.startDate),
      endDate: dateToIsoDate(exp?.endDate),
      current: Boolean(exp?.current),
      location: toStringValue(exp?.location),
    })),
    projects: (Array.isArray(parsed?.projects) ? parsed.projects : []).map((proj: any) => ({
      name: toStringValue(proj?.name),
      description: toStringValue(proj?.description),
      achievements: extractAchievementDescriptions(proj?.achievements, 10),
      technologies: sanitizeStringArray(proj?.technologies, 12),
      bullets: mergeUniqueStrings(
        splitDescriptionIntoBullets(toStringValue(proj?.description)),
        extractAchievementDescriptions(proj?.achievements, 10),
      ).slice(0, 10),
      embedding: Array.isArray(proj?.embedding) ?
          proj.embedding.filter((value: unknown) => typeof value === "number")
        : [],
      role: toStringValue(proj?.role),
      githubUrl: toStringValue(proj?.githubUrl || proj?.url),
      liveUrl: toStringValue(proj?.liveUrl),
      startDate: dateToIsoDate(proj?.startDate),
      endDate: dateToIsoDate(proj?.endDate),
      featured: Boolean(proj?.featured),
    })),
    education: (Array.isArray(parsed?.education) ? parsed.education : []).map((edu: any) => ({
      institution: toStringValue(edu?.institution),
      degree: toStringValue(edu?.degree),
      field: toStringValue(edu?.field),
      startDate: dateToIsoDate(edu?.startDate),
      endDate: dateToIsoDate(edu?.endDate),
    })),
    skills: uniqueSkills,
  };
}

// Get user's resumes
fastify.get(
  "/api/resumes",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const resumes = await prisma.masterResume.findMany({
      where: { userId: request.user.id },
      include: {
        experiences: { take: 5 },
        projects: { take: 3 },
        skills: { take: 10 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return { resumes };
  },
);

// Get single resume
fastify.get<{ Params: { id: string } }>(
  "/api/resumes/:id",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params;

    const resume = await prisma.masterResume.findFirst({
      where: { id, userId: request.user.id },
      include: {
        experiences: {
          include: { achievements: true, technologies: true },
          orderBy: { startDate: "desc" },
        },
        projects: {
          include: { technologies: true },
          orderBy: { startDate: "desc" },
        },
        skills: true,
        education: { orderBy: { startDate: "desc" } },
        certifications: { orderBy: { issueDate: "desc" } },
      },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    return { resume };
  },
);

// Create resume
fastify.post(
  "/api/resumes",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const data = request.body as any;

    const resume = await prisma.masterResume.create({
      data: {
        userId: request.user.id,
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        location: data.location || "",
        summaryShort: data.summaryShort || "",
        summaryLong: data.summaryLong || "",
        linkedInUrl: data.linkedInUrl,
        githubUrl: data.githubUrl,
        portfolioUrl: data.portfolioUrl,
      },
    });

    return { resume };
  },
);

// Update resume
fastify.put<{ Params: { id: string } }>(
  "/api/resumes/:id",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params;
    const data = request.body as any;

    const resume = await prisma.masterResume.updateMany({
      where: { id, userId: request.user.id },
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        location: data.location,
        summaryShort: data.summaryShort,
        summaryLong: data.summaryLong,
        linkedInUrl: data.linkedInUrl,
        githubUrl: data.githubUrl,
        portfolioUrl: data.portfolioUrl,
      },
    });

    if (resume.count === 0) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    return { success: true };
  },
);

// Regenerate summaryShort and summaryLong for a master resume using the user's story + voice
fastify.post<{ Params: { id: string } }>(
  "/api/resumes/:id/regenerate-summary",
  { preHandler: [fastify.authenticate] },
  async (request: any, reply) => {
    const { id } = request.params;

    const [masterResume, careerStory, voiceProfile] = await Promise.all([
      prisma.masterResume.findFirst({
        where: { id, userId: request.user.id },
        include: {
          experiences: { orderBy: { startDate: "desc" }, take: 5 },
          skills: { take: 20 },
        },
      }),
      prisma.userStory.findFirst({
        where: { userId: request.user.id, type: "career_transition" },
        select: { motivation: true, turningPoint: true, uniqueValue: true },
      }),
      prisma.userVoiceProfile.findFirst({
        where: { userId: request.user.id },
        select: { tone: true, style: true, examples: true, avoidPhrases: true },
      }),
    ]);

    if (!masterResume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const skillsList = masterResume.skills.map((s: any) => s.name).join(", ");
    const experienceLines = masterResume.experiences
      .map((e: any) => `${e.title} at ${e.company}${e.description ? ": " + e.description.slice(0, 120) : ""}`)
      .join("\n");

    const avoidList = parseAvoidPhrases(voiceProfile?.avoidPhrases);

    // Build name variants to strip from output as a safety net
    const nameParts = (masterResume.fullName || "").trim().split(/\s+/).filter((p: string) => p.length >= 3);
    const nameVariants = Array.from(new Set([masterResume.fullName, ...nameParts])).filter(Boolean);

    const systemPrompt = `You are an expert resume writer. Write a professional resume summary in the style of a strong LinkedIn About section — specific, grounded, no corporate filler.

OUTPUT FORMAT RULES (non-negotiable):
- summaryShort: one paragraph, 3-5 sentences.
- summaryLong: 2-3 paragraphs separated by blank lines. Paragraph 1: professional identity and skills. Paragraph 2: real projects and specific technologies. Paragraph 3 (optional): what the trades background brings to software work.
- NEVER start any sentence with a person's name or use any name in the body.
- NEVER use pronouns: no "they", "their", "he", "she", "his", "her", "them".
- Write in anonymous third person — start sentences with the role or verb: "A software engineer who...", "Brings...", "Built...", "Designed...", "Works across...".
- NEVER use: "passionate", "driven", "dedicated", "compelling", "eager", "motivated by", "leverage", "synergy", "innovative solutions", "proven track record", "results-oriented".
${avoidList.length > 0 ? `- Also avoid: ${avoidList.join(", ")}.` : ""}
- Voice: ${voiceProfile?.tone || "direct"}, ${voiceProfile?.style || "concise"}. Specific over vague. Real project names over generic claims.

Return strict JSON: { "summaryShort": "...", "summaryLong": "..." }`;

    const userPrompt = `Skills: ${skillsList || "Not provided"}

Recent Experience:
${experienceLines || "Not provided"}

Career Story Context (use as themes, do NOT copy verbatim):
- What sparked the career change: ${careerStory?.turningPoint || "Not provided"}
- What drives the work: ${careerStory?.motivation || "Not provided"}
- What the background brings: ${careerStory?.uniqueValue || "Not provided"}

${voiceProfile?.examples ? `Writing style examples to match:\n${voiceProfile.examples.slice(0, 600)}` : ""}

Write summaryShort and summaryLong. Synthesize the career story themes into original prose — do not copy the story text.`;

    const llmService = getLLMService();
    const result = await llmService.completeJSON<{ summaryShort: string; summaryLong: string }>(
      userPrompt,
      { systemPrompt, maxTokens: 1800, temperature: 0.45 },
    );

    if (!result.success || !result.data) {
      return reply.status(500).send({ message: "Summary generation failed" });
    }

    let newShort = (typeof result.data.summaryShort === "string" ? result.data.summaryShort : "").trim();
    let newLong = (typeof result.data.summaryLong === "string" ? result.data.summaryLong : "").trim();

    // Run through existing first-person → third-person rewriter and deduplicator
    newShort = cleanSummaryNarrative(deRobotize(newShort));
    newLong = cleanSummaryNarrative(deRobotize(newLong));

    // Safety net: strip candidate name from output regardless of LLM compliance
    for (const variant of nameVariants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const nameRe = new RegExp(`\\b${escaped}\\b`, "gi");
      newShort = newShort.replace(nameRe, "").replace(/\s{2,}/g, " ").trim();
      newLong = newLong.replace(nameRe, "").replace(/\s{2,}/g, " ").trim();
    }

    // Strip leading "is a" / "is an" fragments left after name removal
    newShort = newShort.replace(/^is (a|an)\b/i, "A").replace(/\.\s+is (a|an)\b/gi, ". A").trim();
    newLong = newLong.replace(/^is (a|an)\b/i, "A").replace(/\.\s+is (a|an)\b/gi, ". A").trim();

    // Strip forbidden phrases — catch full contextual phrases to avoid leaving fragments
    const forbiddenPhrases: [RegExp, string][] = [
      [/\beager to \w+\b/gi, ""],
      [/\bpassionate(?: about| for)? \w+\b/gi, ""],
      [/\bdriven by [^,.]+/gi, ""],
      [/\bdriven\b/gi, ""],
      [/\bdedicated(?: to)?(?: \w+)?\b/gi, ""],
      [/\beverag(?:e|ing) [^,.]+/gi, ""],
      [/\bleverage\b/gi, ""],
      [/\bsynergy\b/gi, ""],
      [/\binnovative solutions\b/gi, "solutions"],
      [/\bproven track record\b/gi, ""],
      [/\bresults-oriented\b/gi, ""],
    ];
    for (const [re, replacement] of forbiddenPhrases) {
      newShort = newShort.replace(re, replacement).replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
      newLong = newLong.replace(re, replacement).replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
    }

    // Apply user's own avoid phrases
    if (avoidList.length > 0) {
      newShort = removeAvoidPhrases(newShort, avoidList);
      newLong = removeAvoidPhrases(newLong, avoidList);
    }

    // Force output shape regardless of model drift:
    // - Short: 3-5 sentences, single paragraph
    // - Long: 2-3 paragraphs
    const uniqueLongSentences: string[] = [];
    const pushUniqueLongSentence = (candidate: string) => {
      const sentence = `${candidate || ""}`.trim();
      if (!sentence) return;
      if (uniqueLongSentences.some((existing) => isNearDuplicateSentence(existing, sentence))) return;
      uniqueLongSentences.push(sentence);
    };

    const longSeed = cleanSummaryNarrative(deRobotize(newLong || newShort));
    splitSentences(longSeed).forEach(pushUniqueLongSentence);
    splitSentences(cleanSummaryNarrative(deRobotize(newShort))).forEach(pushUniqueLongSentence);

    if (uniqueLongSentences.length === 0) {
      return reply.status(500).send({ message: "Generated summary was empty" });
    }

    const longSelected = uniqueLongSentences.slice(
      0,
      Math.max(4, Math.min(8, uniqueLongSentences.length)),
    );
    const targetLongParagraphs = longSelected.length >= 7 ? 3 : 2;
    let enforcedLong = buildParagraphs(longSelected, targetLongParagraphs);
    const longParagraphs = splitParagraphs(enforcedLong);
    if (longParagraphs.length > 3) {
      enforcedLong = `${longParagraphs[0]}\n\n${longParagraphs[1]}\n\n${longParagraphs.slice(2).join(" ").trim()}`.trim();
    }
    if (splitParagraphs(enforcedLong).length < 2 && longSelected.length >= 2) {
      enforcedLong = buildParagraphs(longSelected, 2);
    }
    const cleanedLongParagraphs = splitParagraphs(enforcedLong)
      .slice(0, 3)
      .map((paragraph) => cleanSummaryNarrative(deRobotize(paragraph)))
      .filter(Boolean);
    if (cleanedLongParagraphs.length < 2) {
      const rebuilt = buildParagraphs(longSelected, 2);
      enforcedLong = splitParagraphs(rebuilt)
        .slice(0, 2)
        .map((paragraph) => cleanSummaryNarrative(deRobotize(paragraph)))
        .filter(Boolean)
        .join("\n\n")
        .trim();
    } else {
      enforcedLong = cleanedLongParagraphs.slice(0, 3).join("\n\n").trim();
    }

    let enforcedShort = enforceShortSummaryLength(cleanSummaryNarrative(deRobotize(newShort || enforcedLong)));
    let shortSentences = splitSentences(enforcedShort);
    if (shortSentences.length > 5) {
      enforcedShort = shortSentences.slice(0, 5).join(" ");
      shortSentences = splitSentences(enforcedShort);
    }
    if (shortSentences.length < 3) {
      const fromLong = splitSentences(enforcedLong);
      const expanded = [...shortSentences];
      for (const sentence of fromLong) {
        if (expanded.some((existing) => isNearDuplicateSentence(existing, sentence))) continue;
        expanded.push(sentence);
        if (expanded.length >= 3) break;
      }
      enforcedShort = enforceShortSummaryLength(expanded.join(" "));
      shortSentences = splitSentences(enforcedShort);
      if (shortSentences.length > 5) {
        enforcedShort = shortSentences.slice(0, 5).join(" ");
      }
    }

    newShort = enforcedShort.trim();
    newLong = enforcedLong.trim();

    if (!newShort) {
      return reply.status(500).send({ message: "Generated summary was empty" });
    }

    await prisma.masterResume.update({
      where: { id },
      data: { summaryShort: newShort, summaryLong: newLong || newShort },
    });

    return { summaryShort: newShort, summaryLong: newLong || newShort };
  },
);

// Delete resume
fastify.delete<{ Params: { id: string } }>(
  "/api/resumes/:id",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params;

    await prisma.masterResume.deleteMany({
      where: { id, userId: request.user.id },
    });

    return { success: true };
  },
);

// Add experience to resume
fastify.post<{ Params: { resumeId: string } }>(
  "/api/resumes/:resumeId/experiences",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId } = request.params;
    const data = request.body as any;

    const resume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
      select: { id: true },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const startDate = parseDateSafely(data.startDate);
    const current = data.isCurrentRole || data.current || false;
    const endDate = current
      ? null
      : (data.endDate ? parseDateSafely(data.endDate, startDate) : null);

    const experience = await prisma.experience.create({
      data: {
        resumeId,
        company: data.company || "New Company",
        title: data.jobTitle || data.title || "Job Title",
        location: data.location || "",
        startDate,
        endDate,
        current,
        description: data.description || "",
        embedding: [],
      },
    });

    return { experience };
  },
);

// Add project to resume
fastify.post<{ Params: { resumeId: string } }>(
  "/api/resumes/:resumeId/projects",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId } = request.params;
    const data = request.body as any;

    const resume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
      select: { id: true },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const startDate = parseDateSafely(data.startDate);
    const endDate = parseDateSafely(data.endDate, startDate);

    const project = await prisma.project.create({
      data: {
        resumeId,
        name: data.name || "New Project",
        description: data.description || "",
        role: data.role || "",
        githubUrl: data.githubUrl || data.url || null,
        liveUrl: data.liveUrl || null,
        featured: data.featured || false,
        startDate,
        endDate,
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
        embedding: [],
      },
    });

    return { project };
  },
);

// Add skill to resume
fastify.post<{ Params: { resumeId: string } }>(
  "/api/resumes/:resumeId/skills",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId } = request.params;
    const data = request.body as any;

    const resume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
      select: { id: true },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const skill = await prisma.skill.create({
      data: {
        resumeId,
        name: data.name || "New Skill",
        category: data.category || "technical",
        proficiency: parseSkillProficiency(data.proficiency),
      },
    });

    return { skill };
  },
);

// Upload resume (base64 encoded file) - parses with AI
fastify.post<{
  Body: {
    fileName: string;
    content: string;
  };
}>(
  "/api/resumes/upload",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { fileName, content } = request.body;

    // Save file to uploads directory
    const uploadsDir = join(process.cwd(), "data/uploads");
    try {
      mkdirSync(uploadsDir, { recursive: true });
    } catch (e) {
      // Directory may already exist
    }

    const filePath = join(uploadsDir, `${Date.now()}-${fileName}`);
    const buffer = Buffer.from(content, "base64");
    writeFileSync(filePath, buffer);

    // Parse resume with AI
    let parsed;
    let rawText = "";
    let resumeData = null;
    try {
      const result = await parseResumeFile(filePath, fileName);
      parsed = result.parsed;
      rawText = result.rawText;
      resumeData = result.resumeData;
    } catch (error: any) {
      console.error("Failed to parse resume:", error.message);
      // Continue with basic resume if parsing fails
      parsed = {
        personalInfo: { fullName: "Unknown" },
        summary: { short: `Uploaded from ${fileName}` },
        experiences: [],
        projects: [],
        skills: { technical: [], languages: [], frameworks: [], tools: [] },
        education: [],
      };
      resumeData = parsed;
    }

    // Create resume with all parsed data
    const existingResumeData = toRecord(resumeData);
    const uploadSnapshot = buildUploadSnapshot(parsed, fileName);
    const immutableResumeData = {
      ...existingResumeData,
      uploadSnapshot,
    };

    const resume = await prisma.masterResume.create({
      data: {
        userId: request.user.id,
        fullName: parsed.personalInfo?.fullName || "Unknown",
        email: parsed.personalInfo?.email || "",
        phone: parsed.personalInfo?.phone || "",
        location: parsed.personalInfo?.location || "",
        linkedInUrl: parsed.personalInfo?.linkedInUrl,
        githubUrl: parsed.personalInfo?.githubUrl,
        portfolioUrl: parsed.personalInfo?.portfolioUrl,
        summaryShort: parsed.summary?.short || `Uploaded from ${fileName}`,
        summaryLong: parsed.summary?.long || "",
        rawText: rawText,
        resumeData: immutableResumeData,
      },
      include: {
        experiences: true,
        projects: true,
        skills: true,
        education: true,
      },
    });

    // Add experiences
    if (parsed.experiences?.length > 0) {
      for (const exp of parsed.experiences) {
        try {
          const parseDate = (dateStr: string | undefined) => {
            if (!dateStr) return new Date();
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? new Date() : d;
          };
          await prisma.experience.create({
            data: {
              resumeId: resume.id,
              company: exp.company,
              title: exp.title,
              location: exp.location || "",
              startDate: parseDate(exp.startDate),
              endDate: exp.endDate ? parseDate(exp.endDate) : null,
              current: exp.current || false,
              description: exp.description || "",
              embedding: [],
            },
          });
        } catch (e) {
          // Skip duplicates
          console.log("Skipping duplicate experience:", exp.company);
        }
      }
    }

    // Add projects
    if (parsed.projects?.length > 0) {
      for (const proj of parsed.projects) {
        try {
          await prisma.project.create({
            data: {
              resumeId: resume.id,
              name: proj.name,
              description: proj.description,
              role: "",
              startDate: new Date(),
              endDate: new Date(),
              achievements: [],
              embedding: [],
            },
          });
        } catch (e) {
          console.log("Skipping duplicate project:", proj.name);
        }
      }
    }

    // Add skills (deduplicated)
    const allSkills = [
      ...(parsed.skills?.technical || []),
      ...(parsed.skills?.languages || []),
      ...(parsed.skills?.frameworks || []),
      ...(parsed.skills?.tools || []),
    ];
    const uniqueSkills = [
      ...new Set(allSkills.map((s) => s.toLowerCase())),
    ]
      .map((s) => allSkills.find((k) => k.toLowerCase() === s)!)
      .filter((skill) => Boolean(skill) && isLikelySkill(skill));

    for (const skillName of uniqueSkills) {
      try {
        await prisma.skill.create({
          data: {
            resumeId: resume.id,
            name: skillName,
            category: "technical",
            proficiency: "intermediate",
          },
        });
      } catch (e) {
        // Skip duplicates
      }
    }

    // Add education
    if (parsed.education?.length > 0) {
      for (const edu of parsed.education) {
        const parseDate = (dateStr: string | undefined) => {
          if (!dateStr) return new Date();
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? new Date() : d;
        };
        await prisma.education.create({
          data: {
            resumeId: resume.id,
            institution: edu.institution,
            degree: edu.degree,
            field: edu.field,
            startDate: parseDate(edu.startDate),
            endDate: edu.endDate ? parseDate(edu.endDate) : null,
          },
        });
      }
    }

    // Fetch complete resume
    const completeResume = await prisma.masterResume.findUnique({
      where: { id: resume.id },
      include: {
        experiences: { orderBy: { startDate: "desc" } },
        projects: true,
        skills: true,
        education: { orderBy: { startDate: "desc" } },
        certifications: true,
      },
    });

    return { resume: completeResume };
  },
);

// ==================== TAILOR ROUTES ====================

// Tailor resume to a job
fastify.post<{
  Params: { id: string };
  Body: { jobDescription: string; jobTitle?: string; companyName?: string };
}>(
  "/api/resumes/:id/tailor",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params;
    const { jobDescription, jobTitle, companyName } = request.body;

    const masterResume = await prisma.masterResume.findFirst({
      where: { id, userId: request.user.id },
      include: {
        experiences: { orderBy: { startDate: "desc" } },
        projects: true,
        skills: true,
        education: { orderBy: { startDate: "desc" } },
      },
    });

    if (!masterResume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const [careerStory, voiceProfile] = await Promise.all([
      prisma.userStory.findFirst({
        where: { userId: request.user.id, type: "career_transition" },
        select: {
          motivation: true,
          turningPoint: true,
          uniqueValue: true,
          transferableSkills: true,
        },
      }),
      prisma.userVoiceProfile.findFirst({
        where: { userId: request.user.id },
        select: {
          tone: true,
          style: true,
          examples: true,
          avoidPhrases: true,
        },
      }),
    ]);

    const llmService = getLLMService();

    console.log("Starting tailor for resume:", masterResume.fullName);

    const resumeData = toRecord(masterResume.resumeData);
    const uploadSnapshot = toRecord(resumeData.uploadSnapshot);
    const legacySnapshot = buildUploadSnapshot(
      resumeData,
      toStringValue(uploadSnapshot.sourceFileName) ||
        toStringValue(resumeData.sourceFileName) ||
        "legacy-upload",
    );

    const hasUploadSnapshot =
      (Array.isArray(uploadSnapshot.experiences) && uploadSnapshot.experiences.length > 0) ||
      (Array.isArray(uploadSnapshot.projects) && uploadSnapshot.projects.length > 0) ||
      (Array.isArray(uploadSnapshot.education) && uploadSnapshot.education.length > 0) ||
      (Array.isArray(uploadSnapshot.skills) && uploadSnapshot.skills.length > 0) ||
      Boolean(toStringValue(toRecord(uploadSnapshot.summary).short) || toStringValue(toRecord(uploadSnapshot.summary).long));

    const activeSnapshot = hasUploadSnapshot ? uploadSnapshot : legacySnapshot;
    const evidenceSnapshot = enrichSnapshotForEvidence(activeSnapshot, resumeData);
    const snapshotExperiences = Array.isArray(activeSnapshot.experiences)
      ? activeSnapshot.experiences.map((exp) => toImmutableExperience(exp))
      : [];
    const snapshotProjects = Array.isArray(activeSnapshot.projects)
      ? activeSnapshot.projects.map((proj) => toImmutableProject(proj))
      : [];
    const snapshotEducation = Array.isArray(activeSnapshot.education)
      ? activeSnapshot.education.map((edu) => toImmutableEducation(edu))
      : [];
    const snapshotSkills = Array.isArray(activeSnapshot.skills)
      ? activeSnapshot.skills
          .map((skill) => `${skill || ""}`.trim())
          .filter((skill) => Boolean(skill) && isLikelySkill(skill))
      : [];
    const sourceSummary = toRecord(activeSnapshot.summary);

    const hasImmutableSnapshot =
      snapshotExperiences.length > 0 ||
      snapshotProjects.length > 0 ||
      snapshotEducation.length > 0 ||
      snapshotSkills.length > 0 ||
      Boolean(toStringValue(sourceSummary.short) || toStringValue(sourceSummary.long));

    const baselineExperiences: ImmutableExperience[] = hasImmutableSnapshot && snapshotExperiences.length > 0
      ? snapshotExperiences
      : masterResume.experiences.map((exp: any) => toImmutableExperience(exp));

    const baselineProjects: ImmutableProject[] = hasImmutableSnapshot && snapshotProjects.length > 0
      ? snapshotProjects
      : masterResume.projects.map((proj: any) => toImmutableProject(proj));

    const baselineEducation: ImmutableEducation[] = hasImmutableSnapshot && snapshotEducation.length > 0
      ? snapshotEducation
      : masterResume.education.map((edu: any) => toImmutableEducation(edu));

    const baselineSkills = hasImmutableSnapshot && snapshotSkills.length > 0
      ? snapshotSkills
      : masterResume.skills
          .map((s: any) => `${s.name || ""}`.trim())
          .filter((skill: string) => Boolean(skill) && isLikelySkill(skill));

    const sourceSummaryShort =
      (hasImmutableSnapshot ? toStringValue(sourceSummary.short) : "") ||
      masterResume.summaryShort ||
      "";
    const sourceSummaryLong =
      (hasImmutableSnapshot ? toStringValue(sourceSummary.long) : "") ||
      masterResume.summaryLong ||
      "";

    const skillsText = baselineSkills.join(", ");
    const rawResumeText = toStringValue(masterResume.rawText).slice(0, 12000);
    const storySnippet = buildCareerStorySnippet(careerStory);
    const avoidPhrases = parseAvoidPhrases(voiceProfile?.avoidPhrases);
    const transferableSkills = formatTransferableSkills(careerStory?.transferableSkills);
    const evidenceBullets = buildEvidenceBullets({
      experiences: baselineExperiences,
      projects: baselineProjects,
      snapshot: evidenceSnapshot,
    });

    try {
      console.log("Starting 3-step tailoring pipeline...");
      let tailoredData: any = null;

      // Step A: Extract structured job requirements
      const extractionFallback = fallbackExtractJobProfile(jobDescription, jobTitle);
      let jobProfile = extractionFallback;
      const extractionSystemPrompt = `You extract software job requirements into strict JSON.
Rules:
1. Keep only information grounded in the provided job description.
2. Return concise items only.
3. roleFocus must be one of: backend, frontend, fullstack, platform, data, software-engineering.
Return JSON:
{
  "mustHaveSkills": ["..."],
  "niceToHave": ["..."],
  "responsibilities": ["..."],
  "keywords": ["..."],
  "senioritySignals": ["..."],
  "roleFocus": "..."
}`;
      const extractionPrompt = `Job Title: ${jobTitle || "Not provided"}
Company: ${companyName || "Not provided"}
Job Description:
${jobDescription}`;
      const extractionResult = await llmService.completeJSON<any>(extractionPrompt, {
        systemPrompt: extractionSystemPrompt,
        maxTokens: 1400,
        temperature: 0.15,
      });
      if (extractionResult.success && extractionResult.data) {
        jobProfile = normalizeJobExtraction(extractionResult.data, extractionFallback);
      }

      // Deterministic selection step over evidence bullets
      const rankedEvidence = rankEvidenceBullets(evidenceBullets, jobProfile, 28);
      const selectedEvidence = rankedEvidence.length > 0 ? rankedEvidence : [];
      const selectedEvidenceIds = new Set(selectedEvidence.map((item) => item.id));

      // Step B: map responsibilities to evidence IDs (no rewriting)
      let mappingResult = buildRuleBasedMapping(jobProfile, selectedEvidence);
      const mappingSystemPrompt = `You are matching responsibilities to resume evidence IDs.
Rules:
1. Do not rewrite text.
2. Use only provided evidence IDs.
3. If no evidence supports a responsibility, leave its evidenceIds empty.
Return JSON:
{
  "responsibilityMappings":[{"responsibility":"...","evidenceIds":["exp_0_b_0"],"notes":"optional"}],
  "missingGaps":["..."],
  "recommendedOrder":["exp_0","exp_1","proj_0"],
  "selectedEvidenceIds":["exp_0_b_0","exp_1_b_2"]
}`;
      const mappingPrompt = `Responsibilities:
${jobProfile.responsibilities.map((item, index) => `${index + 1}. ${item}`).join("\n")}

Must-have skills: ${jobProfile.mustHaveSkills.join(", ") || "Not provided"}
Keywords: ${jobProfile.keywords.join(", ") || "Not provided"}

Evidence bullets:
${selectedEvidence
  .map((item) => `${item.id} | ${item.title}${item.company ? ` @ ${item.company}` : ""} | ${item.text}`)
  .join("\n")}`;
      const mappingResponse = await llmService.completeJSON<any>(mappingPrompt, {
        systemPrompt: mappingSystemPrompt,
        maxTokens: 1800,
        temperature: 0.15,
      });
      if (mappingResponse.success && mappingResponse.data) {
        const parsed = mappingResponse.data;
        const parsedMappings = Array.isArray(parsed?.responsibilityMappings) ?
            parsed.responsibilityMappings
              .map((item: any) => ({
                responsibility: `${item?.responsibility || ""}`.trim(),
                evidenceIds: sanitizeStringArray(item?.evidenceIds, 6).filter((id) => selectedEvidenceIds.has(id)),
                notes: `${item?.notes || ""}`.trim() || undefined,
              }))
              .filter((item: ResponsibilityMapping) => item.responsibility)
          : [];
        const parsedSelectedEvidenceIds = sanitizeStringArray(parsed?.selectedEvidenceIds, 40).filter((id) =>
          selectedEvidenceIds.has(id),
        );
        const mergedSelectedEvidenceIds = [
          ...new Set([
            ...mappingResult.selectedEvidenceIds,
            ...parsedSelectedEvidenceIds,
            ...parsedMappings.flatMap((item: ResponsibilityMapping) => item.evidenceIds),
          ]),
        ];
        mappingResult = {
          responsibilityMappings: parsedMappings.length > 0 ? parsedMappings : mappingResult.responsibilityMappings,
          missingGaps: sanitizeStringArray(parsed?.missingGaps, 10),
          recommendedOrder: mergeUniqueStrings(
            mappingResult.recommendedOrder,
            sanitizeStringArray(parsed?.recommendedOrder, 10),
          ).slice(0, 10),
          selectedEvidenceIds: mergedSelectedEvidenceIds.slice(0, 40),
        };
      }

      const rewriteEvidenceIds = new Set<string>([
        ...mappingResult.selectedEvidenceIds,
        ...mappingResult.responsibilityMappings.flatMap((item) => item.evidenceIds),
      ]);
      const minimumExperienceEvidence = selectedEvidence
        .filter((item) => item.sourceType === "experience")
        .slice(0, 6);
      minimumExperienceEvidence.forEach((item) => rewriteEvidenceIds.add(item.id));
      mappingResult.selectedEvidenceIds = [
        ...new Set([
          ...mappingResult.selectedEvidenceIds,
          ...minimumExperienceEvidence.map((item) => item.id),
        ]),
      ];

      const rewriteEvidence = selectedEvidence.filter((item) => rewriteEvidenceIds.has(item.id));
      const effectiveRewriteEvidence =
        rewriteEvidence.length > 0 ? rewriteEvidence : selectedEvidence.slice(0, 16);

      // Step C: rewrite only selected IDs
      const rewriteSystemPrompt = `You are an expert resume editor.
Rules:
1. Rewrite only selected evidence IDs. Do not invent facts, metrics, or tools.
2. Keep tense/status consistent for ongoing work.
3. Keep summaryShort to 3-5 sentences.
4. Keep summaryLong to 2-3 paragraphs.
5. Avoid buzzword phrases. Do NOT copy the Narrative Anchor text verbatim — use the story as background context only and synthesize its themes into completely fresh, original sentences.
6. Apply user voice preferences when provided. Match the candidate's actual writing style — direct, specific, no corporate filler.
7. Do not change professional identity to an unrelated title (e.g., do not switch to "Data Engineer" unless source evidence explicitly supports that primary title).
8. Prioritize experience evidence over project-only claims when writing role-fit statements.
Return strict JSON:
{
  "summaryShortSentences":[{"text":"...","evidenceIds":["exp_0_b_0"]}],
  "summaryLongParagraphs":[{"sentences":[{"text":"...","evidenceIds":["exp_0_b_0"]}]}],
  "experienceBulletRewrites":{"exp_0_b_0":"..."},
  "skills":["..."],
  "summaryShort":"optional fallback short summary",
  "summaryLong":"optional fallback long summary",
  "summary":"optional fallback summary"
}`;
      const rewritePrompt = `Candidate:
Name: ${masterResume.fullName}
Email: ${masterResume.email}
Current Skills: ${skillsText}

Job Profile:
Role Focus: ${jobProfile.roleFocus}
Must-have skills: ${jobProfile.mustHaveSkills.join(", ") || "Not provided"}
Responsibilities:
${jobProfile.responsibilities.map((item, index) => `${index + 1}. ${item}`).join("\n")}
Keywords: ${jobProfile.keywords.join(", ") || "Not provided"}
Seniority Signals: ${jobProfile.senioritySignals.join(", ") || "Not provided"}

Story/Voice:
Narrative Anchor: ${storySnippet || "Not provided"}
Transferable Skills Mapping: ${transferableSkills || "Not provided"}
Professional Identity Anchor:
Source Summary Short: ${sourceSummaryShort || "Not provided"}
Source Summary Long: ${sourceSummaryLong || "Not provided"}
Tone: ${voiceProfile?.tone || "Not provided"}
Style: ${voiceProfile?.style || "Not provided"}
Preferred Examples: ${(voiceProfile?.examples || "").slice(0, 700) || "Not provided"}
Avoid Phrases: ${avoidPhrases.length > 0 ? avoidPhrases.join(", ") : "Not provided"}

Original Resume Text (raw excerpt):
${rawResumeText || "Not provided"}

Selected Evidence IDs:
${effectiveRewriteEvidence
  .map((item) => `${item.id} | ${item.title}${item.company ? ` @ ${item.company}` : ""} | ${item.text}`)
  .join("\n")}`;

      const rewriteResult = await llmService.completeJSON<any>(rewritePrompt, {
        systemPrompt: rewriteSystemPrompt,
        maxTokens: 3200,
        temperature: 0.6,
      });

      if (rewriteResult.success && rewriteResult.data && typeof rewriteResult.data === "object") {
        tailoredData = Array.isArray(rewriteResult.data)
          ? (rewriteResult.data[0] || {})
          : rewriteResult.data;
      } else {
        const plainFallbackPrompt = `${rewritePrompt}\n\nWrite only JSON with summaryShort, summaryLong, and experienceBulletRewrites.`;
        const plainResult = await llmService.complete(plainFallbackPrompt, {
          systemPrompt: rewriteSystemPrompt,
          maxTokens: 2200,
          temperature: 0.25,
        });
        const fallbackText = plainResult.success && plainResult.data ? plainResult.data : "";
        tailoredData = {
          summary: fallbackText.slice(0, 550),
          summaryShort: fallbackText.slice(0, 850),
          summaryLong: fallbackText.slice(0, 2200),
          experienceBulletRewrites: {},
          skills: [],
        };
      }

      const rewrites = toRecord(
        tailoredData.experienceBulletRewrites || tailoredData.rewrites || {},
      );
      const selectedEvidenceMap = new Map(effectiveRewriteEvidence.map((item) => [item.id, item]));

      const rewrittenExperienceDescriptions = baselineExperiences.map((experience, expIndex) => {
        const sourceBullets = evidenceBullets
          .filter((item) => item.sourceType === "experience" && item.sourceIndex === expIndex)
          .sort((a, b) => a.id.localeCompare(b.id));
        if (sourceBullets.length === 0) return experience.description;

        const prioritizedBullets = sourceBullets
          .map((bullet) => ({
            bullet,
            priority:
              (rewriteEvidenceIds.has(bullet.id) ? 4 : 0) +
              (selectedEvidenceMap.has(bullet.id) ? 2 : 0),
          }))
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 4)
          .map((item) => item.bullet);

        const rewrittenLines = prioritizedBullets.map((bullet) => {
          const candidate = `${rewrites[bullet.id] || ""}`.trim();
          const normalized = candidate ? cleanSummaryNarrative(candidate) : "";
          const rewritten = normalized || bullet.text;
          return /[.!?]$/.test(rewritten) ? rewritten : `${rewritten}.`;
        });
        const description = sanitizeTailoredDescription(
          rewrittenLines.join(" "),
          experience.description,
        );
        return description || experience.description;
      });

      const summaryShortSentences = Array.isArray(tailoredData.summaryShortSentences) ?
          tailoredData.summaryShortSentences
            .map((entry: any) => `${entry?.text || ""}`.trim())
            .filter(Boolean)
        : [];
      const summaryLongParagraphs = Array.isArray(tailoredData.summaryLongParagraphs) ?
          tailoredData.summaryLongParagraphs
            .map((paragraph: any) => {
              const sentenceEntries = Array.isArray(paragraph?.sentences) ? paragraph.sentences : [];
              return sentenceEntries
                .map((sentence: any) => `${sentence?.text || ""}`.trim())
                .filter(Boolean)
                .join(" ")
                .trim();
            })
            .filter(Boolean)
        : [];

      const generatedSummaryFromEvidence = `${summaryShortSentences.join(" ")} ${summaryLongParagraphs.join(" ")}`.trim();
      tailoredData.summary = `${tailoredData.summary || generatedSummaryFromEvidence || ""}`.trim();
      tailoredData.summaryShort =
        `${tailoredData.summaryShort || summaryShortSentences.join(" ") || ""}`.trim();
      tailoredData.summaryLong =
        `${tailoredData.summaryLong || summaryLongParagraphs.join("\n\n") || ""}`.trim();
      tailoredData.experiences = baselineExperiences.map((exp, index) => ({
        title: exp.title,
        company: exp.company,
        description: rewrittenExperienceDescriptions[index] || exp.description || "",
      }));
      tailoredData.skills = selectTailoredSkills(
        jobProfile,
        baselineSkills,
        sanitizeStringArray(tailoredData.skills, 20),
      );

      const alignmentReport = assessTailoringAlignment({
        job: jobProfile,
        summaryShort: tailoredData.summaryShort,
        summaryLong: tailoredData.summaryLong,
        experienceDescriptions: rewrittenExperienceDescriptions,
        selectedSkills: tailoredData.skills,
        baselineSkills,
        mapping: mappingResult,
      });

      if (alignmentReport.score < 70) {
        try {
          const repairSystemPrompt = `You repair resume summaries for stronger job alignment.
Rules:
1. Use only provided evidence bullet IDs and facts.
2. Increase keyword and responsibility alignment without adding new facts.
3. Keep summaryShort as 3-5 sentences, one paragraph.
4. Keep summaryLong as 2-3 paragraphs.
5. Keep writing human and non-repetitive.`;
          const repairPrompt = `Job keywords: ${jobProfile.keywords.join(", ") || "Not provided"}
Responsibilities:
${jobProfile.responsibilities.map((item, index) => `${index + 1}. ${item}`).join("\n")}

Evidence bullets:
${effectiveRewriteEvidence.map((item) => `${item.id}: ${item.text}`).join("\n")}

Current Summary Short:
${tailoredData.summaryShort}

Current Summary Long:
${tailoredData.summaryLong}

Return JSON:
{
  "summaryShort":"...",
  "summaryLong":"..."
}`;
          const alignmentRepair = await llmService.completeJSON<any>(repairPrompt, {
            systemPrompt: repairSystemPrompt,
            maxTokens: 1500,
            temperature: 0.2,
          });
          if (alignmentRepair.success && alignmentRepair.data) {
            const payload = Array.isArray(alignmentRepair.data) ?
                (alignmentRepair.data[0] || {})
              : alignmentRepair.data;
            if (typeof payload.summaryShort === "string" && payload.summaryShort.trim()) {
              tailoredData.summaryShort = payload.summaryShort.trim();
            }
            if (typeof payload.summaryLong === "string" && payload.summaryLong.trim()) {
              tailoredData.summaryLong = payload.summaryLong.trim();
            }
            tailoredData.summary = `${tailoredData.summaryShort} ${tailoredData.summaryLong}`.trim();
          }
        } catch (alignmentRepairError: any) {
          console.warn("Alignment repair pass failed:", alignmentRepairError?.message || alignmentRepairError);
        }
      }

      console.log("Tailor pipeline metrics", {
        resumeId: id,
        roleFocus: jobProfile.roleFocus,
        mustHaveSkills: jobProfile.mustHaveSkills.slice(0, 10),
        topEvidence: selectedEvidence.slice(0, 8).map((item) => ({
          id: item.id,
          score: Number(item.score.toFixed(3)),
          matchedKeywords: item.matchedKeywords.slice(0, 4),
        })),
        keywordCoverage: alignmentReport.keywordCoverage,
        responsibilityCoverage: alignmentReport.responsibilityCoverage,
        alignmentScore: alignmentReport.score,
        alignmentIssues: alignmentReport.issues,
      });

      const generatedSummary =
        typeof tailoredData.summary === "string" ? tailoredData.summary : "";
      const generatedSummaryShort =
        typeof tailoredData.summaryShort === "string" ? tailoredData.summaryShort : "";
      const generatedSummaryLong =
        typeof tailoredData.summaryLong === "string" ? tailoredData.summaryLong : "";
      const tailoredSummary = buildTailoredSummaries(
        {
          generatedSummary,
          generatedSummaryShort,
          generatedSummaryLong,
          sourceShort: sourceSummaryShort,
          sourceLong: sourceSummaryLong,
          storySnippet,
          avoidPhrases,
          candidateName: masterResume.fullName,
        },
      );
      let finalizedSummary = tailoredSummary;
      let summaryQuality = assessSummaryQuality(
        finalizedSummary.short,
        finalizedSummary.long,
      );

      if (!summaryQuality.passed) {
        try {
          const roleFacts = baselineExperiences
            .slice(0, 5)
            .map((exp) => `${exp.title} at ${exp.company}`)
            .join("; ");
          const topSkills = baselineSkills
            .slice(0, 20)
            .join(", ");

          const summaryRepairSystemPrompt = `You are a senior resume editor.
Rewrite summary text for clarity and quality while preserving factual accuracy.

Rules:
1. Do not invent facts, metrics, tools, projects, employers, or outcomes.
2. Keep summaryShort as one paragraph with 3-5 sentences.
3. Keep summaryLong as 2-3 paragraphs, each paragraph 2-4 sentences.
4. Remove repetition, awkward phrasing, grammar mistakes, and typo artifacts.
5. Avoid buzzword-heavy cliches. Do NOT reproduce the story verbatim — synthesize its themes into fluent, original prose.
6. Keep language direct, readable, and professional. Match the candidate's authentic writing style — specific, grounded, no filler.

Return strict JSON:
{
  "summaryShort": "string",
  "summaryLong": "string"
}`;

          const summaryRepairPrompt = `Candidate: ${masterResume.fullName}
Current Summary Short:
${finalizedSummary.short}

Current Summary Long:
${finalizedSummary.long}

Known Experience Facts:
${roleFacts || "Not provided"}

Known Skills:
${topSkills || "Not provided"}

Story Anchor:
${storySnippet || "Not provided"}

Voice Tone: ${voiceProfile?.tone || "Not provided"}
Voice Style: ${voiceProfile?.style || "Not provided"}
Avoid Phrases: ${avoidPhrases.length > 0 ? avoidPhrases.join(", ") : "Not provided"}

Quality Issues To Fix:
${summaryQuality.issues.join(", ") || "none"}`;

          const repairResult = await llmService.completeJSON<any>(
            summaryRepairPrompt,
            {
              systemPrompt: summaryRepairSystemPrompt,
              maxTokens: 2200,
              temperature: 0.2,
            },
          );

          if (
            repairResult.success &&
            repairResult.data &&
            typeof repairResult.data === "object"
          ) {
            const repairedData = Array.isArray(repairResult.data) ?
                (repairResult.data[0] || {})
              : repairResult.data;
            const repairedSummary = buildTailoredSummaries({
              generatedSummaryShort:
                typeof repairedData.summaryShort === "string" ? repairedData.summaryShort : "",
              generatedSummaryLong:
                typeof repairedData.summaryLong === "string" ? repairedData.summaryLong : "",
              sourceShort: sourceSummaryShort,
              sourceLong: sourceSummaryLong,
              storySnippet,
              avoidPhrases,
              candidateName: masterResume.fullName,
            });
            const repairedQuality = assessSummaryQuality(
              repairedSummary.short,
              repairedSummary.long,
            );

            if (repairedQuality.score > summaryQuality.score) {
              finalizedSummary = repairedSummary;
              summaryQuality = repairedQuality;
            }
          }
        } catch (repairError: any) {
          console.warn("Summary repair pass failed:", repairError?.message || repairError);
        }
      }

      const tailoredResume = await prisma.masterResume.create({
        data: {
          userId: request.user.id,
          fullName: masterResume.fullName,
          email: masterResume.email,
          phone: masterResume.phone,
          location: masterResume.location,
          linkedInUrl: masterResume.linkedInUrl,
          githubUrl: masterResume.githubUrl,
          portfolioUrl: masterResume.portfolioUrl,
          summaryShort:
            finalizedSummary.short || enforceShortSummaryLength(finalizedSummary.long),
          summaryLong: finalizedSummary.long,
          resumeData: {
            ...(resumeData || {}),
            tailoredFor: {
              jobTitle,
              companyName,
              originalJobDescription: jobDescription,
              tailoredAt: new Date().toISOString(),
              usedCareerStory: Boolean(storySnippet),
              usedVoiceProfile: Boolean(voiceProfile),
              sourceResumeMode: hasImmutableSnapshot ? "upload_snapshot" : "editable_resume",
              sourceFileName: hasImmutableSnapshot ? toStringValue(activeSnapshot.sourceFileName) || null : null,
              summaryQualityScore: summaryQuality.score,
              summaryQualityIssues: summaryQuality.issues,
              jobExtraction: {
                roleFocus: jobProfile.roleFocus,
                mustHaveSkills: jobProfile.mustHaveSkills.slice(0, 12),
                responsibilities: jobProfile.responsibilities.slice(0, 10),
                keywords: jobProfile.keywords.slice(0, 24),
                senioritySignals: jobProfile.senioritySignals.slice(0, 12),
              },
              evidenceSelection: {
                selectedEvidenceIds: mappingResult.selectedEvidenceIds.slice(0, 40),
                recommendedOrder: mappingResult.recommendedOrder.slice(0, 12),
                missingGaps: mappingResult.missingGaps.slice(0, 12),
              },
              alignmentScore: alignmentReport.score,
              alignmentKeywordCoverage: alignmentReport.keywordCoverage,
              alignmentResponsibilityCoverage: alignmentReport.responsibilityCoverage,
              alignmentIssues: alignmentReport.issues,
            },
            tailoredExperiences: tailoredData.experiences,
            tailoredSkills: tailoredData.skills,
          },
          jobDescription: jobDescription.slice(0, 1000),
          tailoredFromId: id,
        },
      });
      
      // Create tailored experiences with deterministic ID-keyed rewrites (no fuzzy matching)
      if (baselineExperiences.length > 0) {
        const tailoredExperiences = Array.isArray(tailoredData.experiences) ? tailoredData.experiences : [];
        for (const [masterIndex, masterExp] of baselineExperiences.entries()) {
          const candidate = tailoredExperiences[masterIndex];
          const candidateDescription =
            typeof candidate === "string" ?
              candidate
            : typeof candidate?.description === "string" ?
              candidate.description
            : "";
          const description = sanitizeTailoredDescription(
            candidateDescription,
            masterExp.description,
          );

          await prisma.experience.create({
            data: {
              resumeId: tailoredResume.id,
              title: masterExp.title,
              company: masterExp.company,
              description: description || masterExp.description || "",
              startDate: masterExp.startDate,
              endDate: masterExp.endDate,
              current: masterExp.current || false,
              location: masterExp.location || "",
              embedding: [],
            },
          });
        }
      } else if (Array.isArray(tailoredData.experiences) && tailoredData.experiences.length > 0) {
        for (const exp of tailoredData.experiences) {
          const fields =
            typeof exp === "string"
              ? { title: "Tailored Experience", company: "", description: exp }
              : {
                  title: exp.title || "Tailored Experience",
                  company: exp.company || "",
                  description: exp.description || "",
                };
          await prisma.experience.create({
            data: {
              resumeId: tailoredResume.id,
              title: fields.title,
              company: fields.company,
              description: fields.description,
              startDate: new Date(),
              endDate: null,
              current: true,
              location: "",
              embedding: [],
            },
          });
        }
      }

      // FIX: Create and associate the tailored skills
      if (tailoredData.skills && tailoredData.skills.length > 0) {
        const uniqueSkillNames = [
          ...new Set(
            tailoredData.skills
              .map((skill: any) => `${skill || ""}`.trim())
              .filter(Boolean)
              .map((skill: string) => skill.toLowerCase()),
          ),
        ].map((key) =>
          tailoredData.skills.find(
            (skill: any) => `${skill || ""}`.trim().toLowerCase() === key,
          ),
        );

        for (const rawSkillName of uniqueSkillNames) {
          const skillName = `${rawSkillName || ""}`.trim();
          if (!skillName) continue;
          try {
            await prisma.skill.create({
              data: {
                resumeId: tailoredResume.id,
                name: skillName,
                category: "technical",
              },
            });
          } catch (skillError: any) {
            console.warn("Skipping duplicate/invalid skill:", skillName, skillError?.message || skillError);
          }
        }
      }

      // FIX: Copy projects from master resume
      if (baselineProjects.length > 0) {
        for (const project of baselineProjects) {
          try {
            await prisma.project.create({
                data: {
                    resumeId: tailoredResume.id,
                    name: project.name,
                    description: project.description || "",
                    role: project.role || "",
                    githubUrl: project.githubUrl || null,
                    liveUrl: project.liveUrl || null,
                    startDate: project.startDate || new Date(),
                    endDate: project.endDate || project.startDate || new Date(),
                },
            });
          } catch (projectError: any) {
            console.warn("Skipping duplicate/invalid project:", project.name, projectError?.message || projectError);
          }
        }
      }

      // FIX: Copy education from master resume
      if (baselineEducation.length > 0) {
        for (const edu of baselineEducation) {
            await prisma.education.create({
                data: {
                    resumeId: tailoredResume.id,
                    institution: edu.institution,
                    degree: edu.degree || "",
                    field: edu.field || "",
                    startDate: edu.startDate || new Date(),
                    endDate: edu.endDate ?? null,
                },
            });
        }
      }


      // FIX: Return the complete tailored resume with all relations
      const completeTailoredResume = await prisma.masterResume.findUnique({
        where: { id: tailoredResume.id },
        include: {
          experiences: true,
          projects: true,
          skills: true,
          education: true,
        },
      });

      return { tailoredResume: completeTailoredResume };
    } catch (error: any) {
      console.error("Tailor failed:", error);
      const errorMessage = error?.response?.data?.error?.message || error.message || "Unknown error";
      return reply.status(500).send({ message: "Failed to tailor resume", error: errorMessage });
    }
  },
);

// Get tailored resumes (for a master resume)
fastify.get<{
  Params: { id: string };
}>(
  "/api/resumes/:id/tailored",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params;

    const tailoredResumes = await prisma.masterResume.findMany({
      where: { tailoredFromId: id, userId: request.user.id },
      orderBy: { createdAt: "desc" },
    });

    return { resumes: tailoredResumes };
  },
);

// ==================== COVER LETTER ROUTES ====================

// Generate cover letter
fastify.post<{
  Body: { 
    resumeId: string; 
    jobDescription: string; 
    jobTitle?: string; 
    companyName?: string;
    tone?: string;
    jobUrl?: string;
    hiringManagerName?: string;
    hiringManagerTitle?: string;
    companyAddress?: string;
    applicantAddress?: string;
  };
}>(
  "/api/cover-letter",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const {
      resumeId,
      jobDescription,
      jobTitle,
      companyName,
      tone = "professional",
      jobUrl,
      hiringManagerName,
      hiringManagerTitle,
      companyAddress,
      applicantAddress,
    } = request.body;
    const requestedTone = normalizeCoverLetterTone(tone);
    const toneGuide = getCoverLetterToneGuide(requestedTone);
    const normalizedJobDescription = `${jobDescription || ""}`.trim().slice(0, 12000);

    const masterResume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
      include: {
        experiences: { orderBy: { startDate: "desc" }, take: 3 },
        projects: { take: 2 },
        skills: true,
        education: { orderBy: { startDate: "desc" }, take: 3 },
      },
    });

    if (!masterResume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const [careerStory, voiceProfile] = await Promise.all([
      prisma.userStory.findFirst({
        where: { userId: request.user.id, type: "career_transition" },
        select: {
          motivation: true,
          turningPoint: true,
          uniqueValue: true,
          transferableSkills: true,
        },
      }),
      prisma.userVoiceProfile.findFirst({
        where: { userId: request.user.id },
        select: {
          tone: true,
          style: true,
          examples: true,
          avoidPhrases: true,
        },
      }),
    ]);

    const llmService = getLLMService();

    const experiencesText = masterResume.experiences
      .map((exp: any) => `${exp.title} at ${exp.company}: ${exp.description}`)
      .join("\n");

    const skillsText = masterResume.skills.map((s: any) => s.name).join(", ");
    const educationFacts = buildEducationFactText(masterResume.education || []);
    const storySnippet = buildCareerStorySnippet(careerStory);
    const transferableSkills = formatTransferableSkills(careerStory?.transferableSkills);
    const avoidPhrases = parseAvoidPhrases(voiceProfile?.avoidPhrases);
    const submissionDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const systemPrompt = `You are an expert cover letter writer.
Write a clear, human, professional cover letter that follows this exact layout order:
1. Header block: applicant full name, phone, email, and optional applicant address.
2. Date line.
3. Employer info block: hiring manager name/title (if provided), company name, company address (if provided).
4. Salutation: if manager name exists use "Dear Mr./Ms./Mx. [Last Name],"; otherwise use "Dear Hiring Manager,".
5. Paragraph 1 (Introduction): role + interest + why this company/mission.
6. Paragraph 2-3 (Body): relevant qualifications using CAR (Context, Action, Result) examples grounded in resume facts.
7. Paragraph 4 (Closing): reiterate fit, invite interview, thank reader.
8. Sign-off: "Sincerely," or "Best regards," then applicant full name.

Rules:
- No markdown, no bullets, no placeholders like [Company].
- Use only facts from the provided resume/job context; do not invent outcomes or metrics.
- Requested tone from UI is authoritative and must be followed exactly.
- Tone contract for this letter: ${toneGuide}
- Education truth guard: never claim a computer science degree, software engineering degree, or bachelor's degree unless explicitly present in Education Facts.
- Use the provided Submission Date exactly as written.
- If My Story context is provided, use it naturally to explain motivation and unique value.
- Do not copy My Story text verbatim.

Output JSON format:
{
  "subject": "Application for [Job Title] at [Company]",
  "body": "Full cover letter text..."
}`;

    const userPrompt = `Write a ${requestedTone} cover letter for this job application.

Job Title: ${jobTitle || "the position"}
Company: ${companyName || "the company"}
Job Description: ${normalizedJobDescription}
Job Posting URL: ${jobUrl || "Not provided"}

Applicant Background:
Name: ${masterResume.fullName}
Phone: ${masterResume.phone || "Not provided"}
Email: ${masterResume.email}
Address: ${applicantAddress || masterResume.location || "Not provided"}
Submission Date: ${submissionDate}

Employer Info:
Hiring Manager Name: ${hiringManagerName || "Not provided"}
Hiring Manager Title: ${hiringManagerTitle || "Not provided"}
Company Name: ${companyName || "Not provided"}
Company Address: ${companyAddress || "Not provided"}

Key Experiences:
${experiencesText}

Skills: ${skillsText}
Education Facts: ${educationFacts}

My Story (user input):
Narrative Anchor: ${storySnippet || "Not provided"}
Transferable Skills Mapping: ${transferableSkills || "Not provided"}
Motivation: ${careerStory?.motivation || "Not provided"}
Turning Point: ${careerStory?.turningPoint || "Not provided"}
Unique Value: ${careerStory?.uniqueValue || "Not provided"}

Voice Profile (user input):
Preferred Tone: ${voiceProfile?.tone || "Not provided"}
Preferred Style: ${voiceProfile?.style || "Not provided"}
Preferred Examples: ${(voiceProfile?.examples || "").slice(0, 700) || "Not provided"}
Phrases To Avoid: ${avoidPhrases.length > 0 ? avoidPhrases.join(", ") : "Not provided"}

Important:
- Follow UI selected tone: ${requestedTone}
- Apply tone contract: ${toneGuide}
- Voice profile can refine wording but cannot override selected tone.

Write the cover letter.`;

    try {
      let coverLetter: { subject: string; body: string };
      const structuredResult = await llmService.completeJSON<any>(userPrompt, {
        systemPrompt,
        maxTokens: 2200,
        temperature: 0.35,
      });

      if (
        structuredResult.success &&
        structuredResult.data &&
        typeof structuredResult.data === "object"
      ) {
        const parsed = Array.isArray(structuredResult.data)
          ? (structuredResult.data[0] || {})
          : structuredResult.data;
        coverLetter = {
          subject:
            (typeof parsed.subject === "string" && parsed.subject.trim()) ?
              parsed.subject.trim()
            : `Application for ${jobTitle || "the position"}${companyName ? ` at ${companyName}` : ""}`,
          body: typeof parsed.body === "string" ? parsed.body : "",
        };
      } else {
        const plainResult = await llmService.complete(userPrompt, {
          systemPrompt,
          maxTokens: 2200,
          temperature: 0.35,
        });
        coverLetter = {
          subject: `Application for ${jobTitle || "the position"}${companyName ? ` at ${companyName}` : ""}`,
          body: plainResult.success && plainResult.data ? plainResult.data : "",
        };
      }

      coverLetter.body = (coverLetter.body || "")
        .replace(/^```json\n?/gi, "")
        .replace(/^```\n?/gi, "")
        .replace(/```$/g, "")
        .trim();
      coverLetter.body = finalizeCoverLetterBody(
        coverLetter.body,
        requestedTone,
        masterResume.education || [],
      );

      if (!coverLetter.body) {
        const rescuePrompt = `Write only the final cover letter text (no JSON, no markdown).
Keep this exact structure:
- Header: name, phone, email, optional address
- Date
- Employer info
- Salutation
- Intro paragraph
- Two body paragraphs using relevant experience
- Closing paragraph with interview call-to-action
- Sign-off and name

UI Selected Tone: ${requestedTone}
Tone Contract: ${toneGuide}

Role: ${jobTitle || "the position"}
Company: ${companyName || "the company"}
Job Description:
${normalizedJobDescription}

Candidate:
Name: ${masterResume.fullName}
Phone: ${masterResume.phone || "Not provided"}
Email: ${masterResume.email}
Address: ${applicantAddress || masterResume.location || "Not provided"}
Experiences:
${experiencesText}
Skills: ${skillsText}
Education Facts: ${educationFacts}
Story Anchor: ${storySnippet || "Not provided"}`;

        const rescueResult = await llmService.complete(rescuePrompt, {
          maxTokens: 1800,
          temperature: 0.35,
        });
        if (rescueResult.success && rescueResult.data) {
          coverLetter.body = rescueResult.data.trim();
        }
      }

      coverLetter.body = finalizeCoverLetterBody(
        coverLetter.body,
        requestedTone,
        masterResume.education || [],
      );

      if (!coverLetter.body) {
        return reply.status(500).send({
          message: "Failed to generate cover letter",
          error: structuredResult.error || "Empty cover letter body from model",
        });
      }

      if (!coverLetter.subject) {
        coverLetter.subject = `Application for ${jobTitle || "the position"}${companyName ? ` at ${companyName}` : ""}`;
      }

      let toneAssessment = assessCoverLetterTone(coverLetter.body, requestedTone);
      if (!toneAssessment.passed) {
        const toneRepairPrompt = `Rewrite the cover letter below for a ${requestedTone} tone while preserving all factual content and structure.

Rules:
- Keep the same header/date/employer/salutation/paragraph/sign-off structure.
- Do not add or remove factual claims.
- Keep it readable and natural.
- Fix these tone issues: ${toneAssessment.issues.join(", ")}

Cover letter:
${coverLetter.body}`;

        const toneRepairResult = await llmService.complete(toneRepairPrompt, {
          maxTokens: 2200,
          temperature: 0.2,
        });

        if (toneRepairResult.success && toneRepairResult.data) {
          coverLetter.body = finalizeCoverLetterBody(
            toneRepairResult.data.trim(),
            requestedTone,
            masterResume.education || [],
          );
          toneAssessment = assessCoverLetterTone(coverLetter.body, requestedTone);
        }
      }

      if (!toneAssessment.passed) {
        fastify.log.warn(
          { tone: requestedTone, issues: toneAssessment.issues, metrics: toneAssessment.metrics },
          "Cover letter tone assessment still has issues after repair pass",
        );
      }

      return { coverLetter };
    } catch (error: any) {
      console.error("Cover letter generation failed:", error.message);
      return reply.status(500).send({ message: "Failed to generate cover letter", error: error.message });
    }
  },
);

// Save cover letter
fastify.post<{
  Body: {
    resumeId: string;
    jobTitle?: string;
    companyName?: string;
    jobDescription?: string;
    subject: string;
    body: string;
    tone?: string;
  };
}>(
  "/api/cover-letter/save",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId, jobTitle, companyName, jobDescription, subject, body, tone } = request.body;

    const saved = await prisma.coverLetter.create({
      data: {
        userId: request.user.id,
        resumeId,
        jobTitle,
        companyName,
        jobDescription,
        subject,
        body,
        tone,
      },
    });

    return { coverLetter: saved };
  },
);

// Get all cover letters
fastify.get(
  "/api/cover-letter",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const coverLetters = await prisma.coverLetter.findMany({
      where: { userId: request.user.id },
      include: {
        resume: {
          select: { fullName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { coverLetters };
  },
);

// Get single cover letter
fastify.get<{ Params: { id: string } }>(
  "/api/cover-letter/:id",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params;

    const coverLetter = await prisma.coverLetter.findFirst({
      where: { id, userId: request.user.id },
      include: {
        resume: true,
      },
    });

    if (!coverLetter) {
      return reply.status(404).send({ message: "Cover letter not found" });
    }

    return { coverLetter };
  },
);

// Delete cover letter
fastify.delete<{ Params: { id: string } }>(
  "/api/cover-letter/:id",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params;

    await prisma.coverLetter.deleteMany({
      where: { id, userId: request.user.id },
    });

    return { success: true };
  },
);

// ==================== STORY ROUTES ====================

// Get user's stories
fastify.get(
  "/api/stories",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const stories = await prisma.userStory.findMany({
      where: { userId: request.user.id },
      orderBy: { updatedAt: "desc" },
    });

    const achievementStories = await prisma.userAchievementStory.findMany({
      where: { userId: request.user.id },
      orderBy: { updatedAt: "desc" },
    });

    const voiceProfiles = await prisma.userVoiceProfile.findMany({
      where: { userId: request.user.id },
    });

    return { stories, achievementStories, voiceProfiles };
  },
);

// Save/update career story
fastify.post(
  "/api/stories/career",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { motivation, turningPoint, uniqueValue, transferableSkills } =
      request.body;

    // Try to find existing career transition story
    const existing = await prisma.userStory.findFirst({
      where: { userId: request.user.id, type: "career_transition" },
    });

    const story = await prisma.userStory.upsert({
      where: { id: existing?.id || "career-transition-new" },
      create: {
        userId: request.user.id,
        type: "career_transition",
        title: "Career Transition Story",
        motivation,
        turningPoint,
        uniqueValue,
        transferableSkills: transferableSkills || {},
        content: `${motivation} ${turningPoint} ${uniqueValue}`.trim(),
      },
      update: {
        motivation,
        turningPoint,
        uniqueValue,
        transferableSkills: transferableSkills || {},
        content: `${motivation} ${turningPoint} ${uniqueValue}`.trim(),
      },
    });

    return { story };
  },
);

// Add/update achievement story
fastify.post(
  "/api/stories/achievement",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { projectName, role, timeline, status, quantifiableAchievements, technicalAchievements, keyImpact } =
      request.body as any;

    if (!projectName) {
      return reply.status(400).send({ message: "projectName is required" });
    }

    const quantArr = Array.isArray(quantifiableAchievements)
      ? quantifiableAchievements
      : typeof quantifiableAchievements === "string"
        ? quantifiableAchievements.split("\n").map((s: string) => s.trim()).filter(Boolean)
        : [];

    const techArr = Array.isArray(technicalAchievements)
      ? technicalAchievements
      : typeof technicalAchievements === "string"
        ? technicalAchievements.split("\n").map((s: string) => s.trim()).filter(Boolean)
        : [];

    const story = await prisma.userAchievementStory.upsert({
      where: { userId_projectName: { userId: request.user.id, projectName } },
      create: {
        userId: request.user.id,
        projectName,
        role: role || null,
        timeline: timeline || null,
        status: status || null,
        quantifiableAchievements: quantArr,
        technicalAchievements: techArr,
        keyImpact: keyImpact || null,
      },
      update: {
        role: role || null,
        timeline: timeline || null,
        status: status || null,
        quantifiableAchievements: quantArr,
        technicalAchievements: techArr,
        keyImpact: keyImpact || null,
      },
    });

    return { story };
  },
);

// Delete achievement story
fastify.delete(
  "/api/stories/achievement/:id",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.userAchievementStory.findFirst({
      where: { id, userId: request.user.id },
    });

    if (!existing) {
      return reply.status(404).send({ message: "Achievement not found" });
    }

    await prisma.userAchievementStory.delete({ where: { id } });
    return { success: true };
  },
);

// Save/update voice profile
fastify.post(
  "/api/stories/voice",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { tone, style, examples, avoidPhrases } = request.body;

    const existing = await prisma.userVoiceProfile.findFirst({
      where: { userId: request.user.id },
    });

    const voiceProfile = existing
      ? await prisma.userVoiceProfile.update({
          where: { id: existing.id },
          data: {
            tone,
            style,
            examples,
            avoidPhrases,
          },
        })
      : await prisma.userVoiceProfile.create({
          data: {
            userId: request.user.id,
            tone,
            style,
            examples,
            avoidPhrases,
          },
        });

    return { voiceProfile };
  },
);

// ==================== SETTINGS ROUTES ====================

// Get user settings
fastify.get(
  "/api/settings",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: request.user.id },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: request.user.id },
      });
    }

    return { settings };
  },
);

// Update user settings
fastify.put(
  "/api/settings",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const {
      preferredLlm,
      enableWebScraping,
      enableGithubSync,
      enableLinkedIn,
      anthropicKey,
      openaiKey,
      cohereKey,
      geminiKey,
    } = request.body;

    const settings = await prisma.userSettings.upsert({
      where: { userId: request.user.id },
      create: {
        userId: request.user.id,
        preferredLlm,
        enableWebScraping: enableWebScraping ?? true,
        enableGithubSync: enableGithubSync ?? true,
        enableLinkedIn: enableLinkedIn ?? false,
        anthropicKey,
        openaiKey,
        cohereKey,
        geminiKey,
      },
      update: {
        preferredLlm,
        enableWebScraping,
        enableGithubSync,
        enableLinkedIn,
        anthropicKey,
        openaiKey,
        cohereKey,
        geminiKey,
      },
    });

    return { settings };
  },
);

// ==================== APPLICATION ROUTES ====================

// Parse job posting from URL
fastify.post<{
  Body: { url: string };
}>(
  "/api/jobs/parse-url",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const url = (request.body?.url || "").trim();
    if (!url) {
      return reply.status(400).send({ message: "Job URL is required" });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return reply.status(400).send({ message: "Invalid URL format" });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return reply.status(400).send({ message: "Only http(s) URLs are supported" });
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: request.user.id },
      select: { enableWebScraping: true },
    });

    if (settings && settings.enableWebScraping === false) {
      return reply.status(403).send({
        message: "Web scraping is disabled in Settings. Enable it to import job descriptions from URLs.",
      });
    }

    try {
      const analysisResult = await getJobAnalyzerAgent().analyzeJobFromUrl(
        parsedUrl.toString(),
      );
      if (!analysisResult.success || !analysisResult.data) {
        return reply.status(500).send({
          message: analysisResult.error || "Failed to parse job posting",
        });
      }

      const analysis = analysisResult.data;
      const parsed = {
        sourceUrl: analysis.originalUrl,
        jobTitle: analysis.title,
        companyName: analysis.company,
        jobDescription: analysis.rawDescription,
        location: analysis.location,
      };

      if (!parsed.jobDescription || parsed.jobDescription.length < 120) {
        return reply.status(422).send({
          message: "Could not extract a complete job description from that page",
          job: parsed,
        });
      }

      return { job: parsed };
    } catch (error: any) {
      return reply
        .status(500)
        .send({ message: error?.message || "Failed to fetch and parse job URL" });
    }
  },
);

// Get all applications
fastify.get(
  "/api/applications",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const simpleApplications = await prisma.masterResume.findMany({
      where: {
        userId: request.user.id,
        OR: [
          { tailoredFromId: { not: null } },
          { jobDescription: { not: null } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        jobDescription: true,
        createdAt: true,
        tailoredFromId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { applications: simpleApplications };
  },
);

// Track an application (store job with resume)
fastify.post<{
  Body: {
    resumeId: string;
    jobTitle: string;
    companyName: string;
    jobDescription: string;
    status?: string;
  };
}>(
  "/api/applications",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId, jobTitle, companyName, jobDescription, status = "interested" } = request.body;

    let company = await prisma.company.findFirst({
      where: { name: { equals: companyName, mode: "insensitive" } },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: companyName,
        },
      });
    }

    let job = await prisma.job.findFirst({
      where: { companyId: company.id, title: { equals: jobTitle, mode: "insensitive" } },
    });

    if (!job) {
      job = await prisma.job.create({
        data: {
          companyId: company.id,
          title: jobTitle,
          rawDescription: jobDescription,
          location: "",
        },
      });
    }

    const application = await prisma.application.create({
      data: {
        jobId: job.id,
        status,
      },
      include: {
        job: { include: { company: true } },
      },
    });

    return { application };
  },
);

// Update application status
fastify.put<{
  Params: { id: string };
  Body: { status: string; notes?: string };
}>(
  "/api/applications/:id",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { id } = request.params;
    const { status, notes } = request.body;

    const application = await prisma.application.update({
      where: { id },
      data: { status, notes },
    });

    return { application };
  },
);

// Download generated output files (resume, cover letter, JSON snapshots)
fastify.get<{ Querystring: { path: string } }>(
  "/api/files/download",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const rawPath = `${request.query?.path || ""}`.trim();
    if (!rawPath) {
      return reply.status(400).send({ message: "File path is required" });
    }

    const safePath = resolveSafeOutputPath(rawPath);
    if (!safePath) {
      return reply.status(403).send({ message: "File path is not allowed" });
    }

    if (!existsSync(safePath)) {
      return reply.status(404).send({ message: "File not found" });
    }

    try {
      const buffer = readFileSync(safePath);
      const filename = basename(safePath);
      const contentType = getFileContentType(safePath);

      reply.header("Content-Type", contentType);
      reply.header(
        "Content-Disposition",
        `attachment; filename="${filename.replace(/"/g, "")}"`,
      );
      return reply.send(buffer);
    } catch (error: any) {
      return reply.status(500).send({
        message: "Failed to load file",
        error: error?.message || "Unknown error",
      });
    }
  },
);

// List generated output files for current user
fastify.get(
  "/api/files/outputs",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const resumes = await prisma.masterResume.findMany({
      where: { userId: request.user.id },
      select: {
        id: true,
        createdAt: true,
        resumeData: true,
        jobDescription: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const outputs = resumes
      .map((resume) => {
        const resumeData = toRecord(resume.resumeData);
        const tailoredFor = toRecord(resumeData.tailoredFor);
        const workflowOutputs = toRecord(resumeData.workflowOutputs);

        const resumePathRaw = toStringValue(workflowOutputs.resumePath);
        const coverLetterPathRaw = toStringValue(workflowOutputs.coverLetterPath);
        const skillsSnapshotPathRaw = toStringValue(
          workflowOutputs.skillsSnapshotPath,
        );

        const resumePath = resolveSafeOutputPath(resumePathRaw);
        const coverLetterPath = resolveSafeOutputPath(coverLetterPathRaw);
        const skillsSnapshotPath = resolveSafeOutputPath(skillsSnapshotPathRaw);

        const hasAnyPath = Boolean(
          (resumePath && existsSync(resumePath)) ||
            (coverLetterPath && existsSync(coverLetterPath)) ||
            (skillsSnapshotPath && existsSync(skillsSnapshotPath)),
        );

        if (!hasAnyPath) return null;

        const fileMeta = (filePath: string | null) => {
          if (!filePath || !existsSync(filePath)) return null;
          const stats = statSync(filePath);
          return {
            path: filePath,
            name: basename(filePath),
            sizeBytes: stats.size,
            updatedAt: stats.mtime.toISOString(),
          };
        };

        return {
          resumeId: resume.id,
          createdAt: resume.createdAt.toISOString(),
          jobTitle: toStringValue(tailoredFor.jobTitle) || null,
          companyName: toStringValue(tailoredFor.companyName) || null,
          jobDescription: resume.jobDescription || "",
          files: {
            resume: fileMeta(resumePath),
            coverLetter: fileMeta(coverLetterPath),
            skillsSnapshot: fileMeta(skillsSnapshotPath),
          },
        };
      })
      .filter(Boolean);

    return { outputs };
  },
);

// ==================== AGENT ROUTES ====================

// End-to-end application workflow orchestrator
fastify.post<{ Body: { jobUrl: string; enhanced?: boolean; resumeId?: string } }>(
  "/api/agents/application-orchestrator",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { jobUrl, enhanced = false, resumeId } = request.body;
    const normalizedUrl = `${jobUrl || ""}`.trim();

    if (!normalizedUrl) {
      return reply.status(400).send({ message: "Job URL is required" });
    }

    if (resumeId) {
      const resume = await prisma.masterResume.findFirst({
        where: { id: resumeId, userId: request.user.id },
      });
      if (!resume) {
        return reply.status(404).send({ message: "Resume not found" });
      }
    }

    try {
      const { getApplicationOrchestrator } = await import(
        "./agents/application-orchestrator.agent.js"
      );
      const orchestrator = getApplicationOrchestrator();
      const workflow = await orchestrator.applyToJob(normalizedUrl, {
        enhanced: Boolean(enhanced),
        resumeId,
        userId: request.user.id,
      });

      if (!workflow.success || !workflow.data) {
        return reply.status(500).send({
          message: "Failed to run application workflow",
          error: workflow.error || "Workflow failed",
        });
      }

      return { result: workflow.data };
    } catch (error: any) {
      console.error("Application orchestrator failed:", error.message);
      return reply.status(500).send({ message: "Failed to run application workflow", error: error.message });
    }
  },
);

// Tailor resume by job (agent orchestration path)
fastify.post<{ Body: { resumeId: string; jobId: string; enhanced?: boolean } }>(
  "/api/agents/resume-tailor",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId, jobId, enhanced = false } = request.body;

    const [resume, job] = await Promise.all([
      prisma.masterResume.findFirst({
        where: { id: resumeId, userId: request.user.id },
      }),
      prisma.job.findUnique({
        where: { id: jobId },
      }),
    ]);

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    if (!job) {
      return reply.status(404).send({ message: "Job not found" });
    }

    try {
      const { getResumeTailorAgent } = await import(
        "./agents/resume-tailor.agent.js"
      );
      const agent = getResumeTailorAgent();
      const tailored = await agent.tailorResume(jobId, {
        enhanced: Boolean(enhanced),
        resumeId,
        userId: request.user.id,
      });

      if (!tailored.success || !tailored.data) {
        return reply.status(500).send({
          message: "Failed to tailor resume",
          error: tailored.error || "Tailoring failed",
        });
      }

      return { result: tailored.data };
    } catch (error: any) {
      console.error("Resume tailor agent failed:", error.message);
      return reply.status(500).send({ message: "Failed to tailor resume", error: error.message });
    }
  },
);

// Quantify achievements (McKinsey-style)
fastify.post<{ Body: { resumeId: string } }>(
  "/api/agents/quantify-achievements",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId } = request.body;

    const resume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    try {
      const { getAchievementQuantifierAgent } = await import(
        "./agents/resume/achievement-quantifier.agent.js"
      );
      const agent = getAchievementQuantifierAgent();
      const quantification = await agent.quantifyResumeAchievements(resumeId);

      if (!quantification.success || !quantification.data) {
        return reply.status(500).send({
          message: "Failed to quantify achievements",
          error: quantification.error || "Quantification failed",
        });
      }

      return { result: quantification.data };
    } catch (error: any) {
      console.error("Quantify failed:", error.message);
      return reply.status(500).send({ message: "Failed to quantify achievements", error: error.message });
    }
  },
);

// Generate Harvard-style summaries
fastify.post<{ Body: { resumeId: string } }>(
  "/api/agents/harvard-summary",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId } = request.body;

    const resume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    try {
      const { getHarvardSummaryAgent } = await import(
        "./agents/resume/harvard-summary.agent.js"
      );
      const agent = getHarvardSummaryAgent();
      const summaryResult = await agent.generateSummaries(undefined, resumeId);

      if (!summaryResult.success || !summaryResult.data) {
        return reply.status(500).send({
          message: "Failed to generate summaries",
          error: summaryResult.error || "Summary generation failed",
        });
      }

      const summaries = summaryResult.data.versions.map((version, index) => ({
        version: index + 1,
        style: version.angle,
        text: version.summary,
      }));

      const result = {
        summaries,
        recommendation: summaryResult.data.recommendation,
        candidateBackground: summaryResult.data.candidateBackground,
      };

      return { result };
    } catch (error: any) {
      console.error("Harvard summary failed:", error.message);
      return reply.status(500).send({ message: "Failed to generate summaries", error: error.message });
    }
  },
);

// ATS Optimization
fastify.post<{ Body: { resumeId: string; jobDescription?: string } }>(
  "/api/agents/ats-optimize",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId, jobDescription } = request.body;

    const resume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
      include: {
        experiences: { orderBy: { startDate: "desc" } },
        skills: true,
        projects: { take: 3 },
      },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const experiencesText = resume.experiences
      .map((exp: any) => `${exp.title} at ${exp.company}: ${exp.description}`)
      .join("\n\n");
    const projectsText = resume.projects
      .map((proj: any) => `${proj.name}: ${proj.description}`)
      .join("\n\n");
    const skillsText = resume.skills.map((s: any) => s.name).join(", ");
    const resumeText = [
      `Name: ${resume.fullName || ""}`,
      `Skills: ${skillsText}`,
      experiencesText ? `Experiences:\n${experiencesText}` : "",
      projectsText ? `Projects:\n${projectsText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const normalizedJobDescription =
      `${jobDescription || ""}`.trim() ||
      "General ATS optimization with focus on keyword alignment and standard section headings.";

    try {
      const { getATSOptimizerAgent } = await import(
        "./agents/resume/ats-optimizer.agent.js"
      );
      const agent = getATSOptimizerAgent();
      const optimization = await agent.analyzeResumeATS(
        resumeText,
        normalizedJobDescription,
      );

      if (!optimization.success || !optimization.data) {
        return reply.status(500).send({
          message: "Failed to optimize for ATS",
          error: optimization.error || "ATS optimization failed",
        });
      }

      const analysis = optimization.data;
      const keywordAnalysis = analysis.keywordAnalysis || [];
      const keywordsFound = keywordAnalysis
        .filter((entry) => entry.category !== "missing")
        .map((entry) => entry.keyword);
      const keywordsMissing = keywordAnalysis
        .filter((entry) => entry.category === "missing")
        .map((entry) => entry.keyword);
      const suggestions = (analysis.recommendations || []).map((text) => ({
        type: "add",
        text,
        priority: "medium",
      }));

      const result = {
        score: analysis.overallScore,
        keywordsFound,
        keywordsMissing,
        suggestions,
        optimizedBullets: [],
        overallScore: analysis.overallScore,
        keywordAnalysis,
        sectionScores: analysis.sectionScores,
        formatGuidance: analysis.formatGuidance,
        atsEstimatedMatch: analysis.atsEstimatedMatch,
      };

      return { result };
    } catch (error: any) {
      console.error("ATS optimization failed:", error.message);
      return reply.status(500).send({ message: "Failed to optimize for ATS", error: error.message });
    }
  },
);

// STAR Behavioral Interview Coach
fastify.post<{ Body: { resumeId: string } }>(
  "/api/agents/behavioral-coach",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId } = request.body;

    const resume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    try {
      const { getBehavioralCoachAgent } = await import(
        "./agents/interview/behavioral-coach.agent.js"
      );
      const agent = getBehavioralCoachAgent();
      const storyBank = await agent.generateStoryBank(undefined, resumeId);

      if (!storyBank.success || !storyBank.data) {
        return reply.status(500).send({
          message: "Failed to generate STAR stories",
          error: storyBank.error || "Story bank generation failed",
        });
      }

      const questionByStoryId = new Map<string, string>();
      for (const mapping of storyBank.data.questionMapping || []) {
        for (const storyId of mapping.suggestedStoryIds || []) {
          if (!questionByStoryId.has(storyId)) {
            questionByStoryId.set(storyId, mapping.question);
          }
        }
      }

      const stories = (storyBank.data.stories || []).map((story) => ({
        category: story.category,
        situation: story.situation,
        task: story.task,
        action: story.action,
        result: story.result,
        metrics: story.metrics,
        question: questionByStoryId.get(story.id) || story.title || "",
      }));

      const result = {
        stories,
        questionMapping: storyBank.data.questionMapping,
        commonQuestions: storyBank.data.commonQuestions,
        deliveryTips: storyBank.data.deliveryTips,
      };

      return { result };
    } catch (error: any) {
      console.error("Behavioral coach failed:", error.message);
      return reply.status(500).send({ message: "Failed to generate STAR stories", error: error.message });
    }
  },
);

// Hiring manager finder without manual CLI jobId (accepts jobId or jobUrl)
fastify.post<{ Body: { jobId?: string; jobUrl?: string } }>(
  "/api/agents/hiring-manager-finder",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const rawJobId = `${request.body?.jobId || ""}`.trim();
    const rawJobUrl = `${request.body?.jobUrl || ""}`.trim();

    if (!rawJobId && !rawJobUrl) {
      return reply
        .status(400)
        .send({ message: "Either jobId or jobUrl is required" });
    }

    let job: any = null;

    if (rawJobId) {
      job = await prisma.job.findUnique({
        where: { id: rawJobId },
        include: { company: true },
      });
      if (!job) {
        return reply.status(404).send({ message: "Job not found" });
      }
    } else {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawJobUrl);
      } catch {
        return reply.status(400).send({ message: "Invalid job URL format" });
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return reply
          .status(400)
          .send({ message: "Only http(s) URLs are supported" });
      }

      job = await prisma.job.findFirst({
        where: { url: parsedUrl.toString() },
        include: { company: true },
      });

      if (!job) {
        const analysisResult = await getJobAnalyzerAgent().analyzeJobFromUrl(
          parsedUrl.toString(),
        );
        if (!analysisResult.success || !analysisResult.data) {
          return reply.status(500).send({
            message: "Failed to analyze job URL",
            error: analysisResult.error || "Job analysis failed",
          });
        }

        const analysis = analysisResult.data;
        let company = await prisma.company.findFirst({
          where: { name: { equals: analysis.company, mode: "insensitive" } },
        });

        if (!company) {
          company = await prisma.company.create({
            data: {
              name: analysis.company,
              domain: parsedUrl.hostname,
              lastResearched: new Date(),
            },
          });
        }

        job = await prisma.job.create({
          data: {
            companyId: company.id,
            title: analysis.title || "Unknown Position",
            url: parsedUrl.toString(),
            location: analysis.location || "Remote",
            salary: analysis.salary || undefined,
            rawDescription: analysis.rawDescription || parsedUrl.toString(),
            requiredSkills: analysis.requiredSkills || [],
            preferredSkills: analysis.preferredSkills || [],
            responsibilities: analysis.responsibilities || [],
            qualifications: analysis.qualifications || [],
            keywords: analysis.keywords || [],
            experienceLevel: analysis.experienceLevel || "entry",
          },
          include: { company: true },
        });
      }
    }

    try {
      const { getHiringManagerFinderAgent } = await import(
        "./agents/hiring-manager-finder.js"
      );
      const finder = getHiringManagerFinderAgent();
      const hmResult = await finder.findHiringManager(job.id);

      if (!hmResult.success || !hmResult.data) {
        return reply.status(500).send({
          message: "Failed to find hiring manager",
          error: hmResult.error || "Hiring manager search failed",
        });
      }

      let savedHiringManager: any = null;
      const topMatch = hmResult.data.topMatch;
      const normalizedName = `${topMatch?.name || ""}`.trim();

      if (topMatch && normalizedName) {
        const sourceList = topMatch.source ? [topMatch.source] : [];
        const managerData = {
          name: normalizedName,
          title: `${topMatch.title || ""}`.trim() || "Hiring Manager",
          linkedInUrl: `${topMatch.linkedInUrl || ""}`.trim() || null,
          email: `${topMatch.email || ""}`.trim() || null,
          phone: `${topMatch.phone || ""}`.trim() || null,
          confidence:
            typeof topMatch.confidence === "number" ? topMatch.confidence : 0,
          verified: Boolean(topMatch.verified),
        };

        const existingHM = await prisma.hiringManager.findFirst({
          where: { jobId: job.id, name: normalizedName },
        });

        if (existingHM) {
          const mergedSources = Array.from(
            new Set([...(existingHM.sources || []), ...sourceList]),
          );
          savedHiringManager = await prisma.hiringManager.update({
            where: { id: existingHM.id },
            data: {
              ...managerData,
              sources: mergedSources,
            },
          });
        } else {
          try {
            savedHiringManager = await prisma.hiringManager.create({
              data: {
                jobId: job.id,
                ...managerData,
                sources: sourceList,
              },
            });
          } catch (error: any) {
            if (error?.code === "P2002") {
              const deduped = await prisma.hiringManager.findFirst({
                where: { jobId: job.id, name: normalizedName },
              });
              if (deduped) {
                const mergedSources = Array.from(
                  new Set([...(deduped.sources || []), ...sourceList]),
                );
                savedHiringManager = await prisma.hiringManager.update({
                  where: { id: deduped.id },
                  data: {
                    ...managerData,
                    sources: mergedSources,
                  },
                });
              }
            } else {
              throw error;
            }
          }
        }
      }

      return {
        result: {
          jobId: job.id,
          jobTitle: job.title,
          companyName: job.company?.name || "",
          searchMethod: hmResult.data.searchMethod,
          managers: hmResult.data.managers,
          topMatch: hmResult.data.topMatch || null,
          savedHiringManager,
        },
      };
    } catch (error: any) {
      console.error("Hiring manager finder failed:", error.message);
      return reply.status(500).send({
        message: "Failed to find hiring manager",
        error: error.message,
      });
    }
  },
);

// Email draft generation from application context
fastify.post<{
  Body: {
    applicationId: string;
    type?: "initial_followup" | "post_interview" | "check_in";
    tone?: "professional" | "enthusiastic" | "friendly";
    includeCareerStory?: boolean;
  };
}>(
  "/api/agents/email-agent",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const applicationId = `${request.body?.applicationId || ""}`.trim();
    const type = request.body?.type || "initial_followup";
    const tone = request.body?.tone || "professional";
    const includeCareerStory = request.body?.includeCareerStory !== false;

    if (!applicationId) {
      return reply.status(400).send({ message: "applicationId is required" });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        hiringManagerId: true,
      },
    });

    if (!application) {
      return reply.status(404).send({ message: "Application not found" });
    }

    try {
      const { getEmailAgent } = await import("./agents/email-agent.js");
      const emailAgent = getEmailAgent();
      const emailResult = await emailAgent.generateEmail(applicationId, {
        type,
        tone,
        includeCareerStory,
      });

      if (!emailResult.success || !emailResult.data) {
        return reply.status(500).send({
          message: "Failed to generate email draft",
          error: emailResult.error || "Email generation failed",
        });
      }

      await emailAgent.saveEmail(
        applicationId,
        emailResult.data.type || type,
        emailResult.data.to || "",
        emailResult.data.subject || "",
        emailResult.data.body || "",
        emailResult.data.tone || tone,
        application.hiringManagerId || undefined,
      );

      return { result: emailResult.data };
    } catch (error: any) {
      console.error("Email agent failed:", error.message);
      return reply.status(500).send({
        message: "Failed to generate email draft",
        error: error.message,
      });
    }
  },
);

// ==================== HEALTH CHECK ====================

fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const host = process.env.HOST || "0.0.0.0";

async function start() {
  try {
    await fastify.listen({ port, host });
    console.log(`🚀 Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();


