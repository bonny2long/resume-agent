import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { prisma } from "@resume-agent/shared/src/client.js";
import { parseResumeFile } from "./parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

function buildTailoredSummaries(
  generatedSummary: string | undefined,
  sourceShort: string | null | undefined,
  sourceLong: string | null | undefined,
): { short: string; long: string } {
  const generated = deRobotize((generatedSummary || "").replace(/\s+/g, " ").trim());
  const fallback = deRobotize(
    `${(sourceLong || "").trim()} ${(sourceShort || "").trim()}`.replace(/\s+/g, " ").trim(),
  );
  const base = generated || fallback;

  if (!base) return { short: "", long: "" };

  const sentences = splitSentences(base);
  const firstSentence = sentences[0] || base;
  let short = trimToSentenceBoundary(firstSentence, 210, 50);
  if (short.length < 65 && sentences.length > 1) {
    short = trimToSentenceBoundary(`${firstSentence} ${sentences[1]}`, 210, 70);
  }

  let long = base;
  if (sentences.length > 0) {
    long = sentences.slice(0, 4).join(" ");
  }
  if (splitSentences(long).length < 2 && fallback) {
    long = `${long} ${fallback}`.trim();
  }
  long = trimToSentenceBoundary(long, 560, 130);
  if (long.length < short.length) long = short;

  return { short, long };
}

function normalizeValue(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const tailored = (tailoredDescription || "").trim();
  const source = (sourceDescription || "").trim();
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
        resumeData: resumeData,
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
    ].map((s) => allSkills.find((k) => k.toLowerCase() === s)!);

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ message: "ANTHROPIC_API_KEY not configured" });
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    console.log("Starting tailor for resume:", masterResume.fullName);

    const resumeData = masterResume.resumeData as any;
    const experiencesText = masterResume.experiences
      .map((exp) => `${exp.title} at ${exp.company} (${exp.startDate?.toISOString().slice(0, 7)} - ${exp.current ? "Present" : exp.endDate?.toISOString().slice(0, 7)}): ${exp.description}`)
      .join("\n\n");

    const projectsText = masterResume.projects
      .map((proj) => `${proj.name}: ${proj.description}`)
      .join("\n\n");

    const skillsText = masterResume.skills.map((s) => s.name).join(", ");

    const systemPrompt = `You are an expert resume writer. Tailor the resume to the job while preserving factual accuracy.

Hard constraints:
1. Do NOT invent facts, numbers, outcomes, or scope.
2. Preserve tense and status: if work is in progress, keep it in-progress.
3. Keep claims grounded in provided resume content only.
4. Prefer rewriting and prioritizing existing achievements over creating new claims.
5. Use job keywords only when they truthfully match candidate experience.
6. Use plain, human wording and avoid buzzwords.
7. Avoid stock phrasing such as "proven expertise", "demonstrated ability", "results-driven", and "product-first mindset".
8. Never convert ongoing work into completed language (e.g., don't change "building" to "built").

Output a tailored resume in JSON format with the following structure:
{
  "summary": "3-5 sentence tailored summary in natural language",
  "experiences": [
    { "title": "Job Title", "company": "Company Name", "description": "Tailored experience description..." }
  ],
  "skills": ["Skill 1", "Skill 2", ...]
}`;

    const userPrompt = `Master Resume:
Name: ${masterResume.fullName}
Email: ${masterResume.email}

Experiences:
${experiencesText}

Projects:
${projectsText}

Skills: ${skillsText}

Job Description:
${jobDescription}

Tailor the resume above to match this job.`;

    try {
      console.log("Calling Anthropic API...");
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      console.log("Anthropic response received");

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      let tailoredData;
      try {
        let text = content.text.trim();
        text = text.replace(/^```json\n?/, '').replace(/```$/, '').trim();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          text = jsonMatch[0];
        }
        
        tailoredData = JSON.parse(text);
      } catch {
        tailoredData = {
          summary: content.text.slice(0, 500),
          experiences: [content.text],
          skills: masterResume.skills.map((s) => s.name),
        };
      }

      const generatedSummary =
        typeof tailoredData.summary === "string" ? tailoredData.summary : "";
      const tailoredSummary = buildTailoredSummaries(
        generatedSummary,
        masterResume.summaryShort,
        masterResume.summaryLong,
      );

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
          summaryShort: buildSummaryPreview(tailoredSummary.short, 210),
          summaryLong: tailoredSummary.long,
          resumeData: {
            ...(resumeData || {}),
            tailoredFor: {
              jobTitle,
              companyName,
              originalJobDescription: jobDescription,
              tailoredAt: new Date().toISOString(),
            },
            tailoredExperiences: tailoredData.experiences,
            tailoredSkills: tailoredData.skills,
          },
          jobDescription: jobDescription.slice(0, 1000),
          tailoredFromId: id,
        },
      });
      
      // FIX: Create and associate the tailored experiences
      if (masterResume.experiences && masterResume.experiences.length > 0) {
        const tailoredExperiences = Array.isArray(tailoredData.experiences)
          ? tailoredData.experiences
          : [];
        const usedTailoredIndexes = new Set<number>();

        const getTailoredExperienceFields = (value: any): {
          title: string;
          company: string;
          description: string;
        } => {
          if (typeof value === "string") {
            return {
              title: "",
              company: "",
              description: value,
            };
          }
          return {
            title: typeof value?.title === "string" ? value.title : "",
            company: typeof value?.company === "string" ? value.company : "",
            description: typeof value?.description === "string" ? value.description : "",
          };
        };

        const scoreExperienceMatch = (
          master: { title: string; company: string },
          candidate: { title: string; company: string },
          indexBias: number,
        ): number => {
          const masterTitle = normalizeValue(master.title);
          const masterCompany = normalizeValue(master.company);
          const candidateTitle = normalizeValue(candidate.title);
          const candidateCompany = normalizeValue(candidate.company);
          let score = 0;

          if (candidateCompany) {
            if (candidateCompany === masterCompany) score += 6;
            else if (
              masterCompany.includes(candidateCompany) ||
              candidateCompany.includes(masterCompany)
            ) {
              score += 4;
            }
          }

          if (candidateTitle) {
            if (candidateTitle === masterTitle) score += 5;
            else if (masterTitle.includes(candidateTitle) || candidateTitle.includes(masterTitle)) {
              score += 3;
            }
          }

          score += indexBias;
          return score;
        };

        for (const [masterIndex, masterExp] of masterResume.experiences.entries()) {
          let bestTailoredIndex = -1;
          let bestScore = -1;
          let bestFields = { title: "", company: "", description: "" };

          for (const [candidateIndex, candidate] of tailoredExperiences.entries()) {
            if (usedTailoredIndexes.has(candidateIndex)) continue;
            const fields = getTailoredExperienceFields(candidate);
            const indexBias = candidateIndex === masterIndex ? 2 : 0;
            const score = scoreExperienceMatch(
              { title: masterExp.title, company: masterExp.company },
              { title: fields.title, company: fields.company },
              indexBias,
            );

            if (score > bestScore) {
              bestScore = score;
              bestTailoredIndex = candidateIndex;
              bestFields = fields;
            }
          }

          if (bestTailoredIndex >= 0) {
            usedTailoredIndexes.add(bestTailoredIndex);
          }

          const description = sanitizeTailoredDescription(
            bestFields.description,
            masterExp.description,
          );

          await prisma.experience.create({
            data: {
              resumeId: tailoredResume.id,
              title: masterExp.title,
              company: masterExp.company,
              description: description || masterExp.description || "",
              startDate: masterExp.startDate,
              endDate: masterExp.endDate ?? null,
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
        for (const skillName of tailoredData.skills) {
            await prisma.skill.create({
                data: {
                    resumeId: tailoredResume.id,
                    name: skillName,
                    category: "technical",
                },
            });
        }
      }

      // FIX: Copy projects from master resume
      if (masterResume.projects && masterResume.projects.length > 0) {
        for (const project of masterResume.projects) {
            await prisma.project.create({
                data: {
                    resumeId: tailoredResume.id,
                    name: project.name,
                    description: project.description || "",
                    role: project.role || "",
                    githubUrl: project.githubUrl || project.url || null,
                    liveUrl: project.liveUrl || null,
                    startDate: project.startDate || new Date(),
                    endDate: project.endDate || new Date(),
                },
            });
        }
      }

      // FIX: Copy education from master resume
      if (masterResume.education && masterResume.education.length > 0) {
        for (const edu of masterResume.education) {
            await prisma.education.create({
                data: {
                    resumeId: tailoredResume.id,
                    institution: edu.institution,
                    degree: edu.degree || "",
                    field: edu.field || "",
                    startDate: edu.startDate || new Date(),
                    endDate: edu.endDate,
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
  };
}>(
  "/api/cover-letter",
  {
    preHandler: [fastify.authenticate],
  },
  async (request: any, reply) => {
    const { resumeId, jobDescription, jobTitle, companyName, tone = "professional" } = request.body;

    const masterResume = await prisma.masterResume.findFirst({
      where: { id: resumeId, userId: request.user.id },
      include: {
        experiences: { orderBy: { startDate: "desc" }, take: 3 },
        projects: { take: 2 },
        skills: true,
      },
    });

    if (!masterResume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const careerStory = await prisma.userStory.findFirst({
      where: { userId: request.user.id, type: "career_transition" },
    });

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });

    const experiencesText = masterResume.experiences
      .map((exp) => `${exp.title} at ${exp.company}: ${exp.description}`)
      .join("\n");

    const skillsText = masterResume.skills.map((s) => s.name).join(", ");

    const systemPrompt = `You are an expert cover letter writer inspired by Bain & Company consultants. Write compelling, concise cover letters that:
1. Open with a strong hook
2. Connect the applicant's background to the specific role
3. Highlight relevant achievements
4. Show genuine interest in the company
5. End with a call to action

Output JSON format:
{
  "subject": "Application for [Job Title] at [Company]",
  "body": "Full cover letter text..."
}`;

    const userPrompt = `Write a ${tone} cover letter for this job application.

Job Title: ${jobTitle || "the position"}
Company: ${companyName || "the company"}
Job Description: ${jobDescription}

Applicant Background:
Name: ${masterResume.fullName}
Email: ${masterResume.email}

Key Experiences:
${experiencesText}

Skills: ${skillsText}

${careerStory ? `Career Story (for context):
Motivation: ${careerStory.motivation || "N/A"}
Turning Point: ${careerStory.turningPoint || "N/A"}
Unique Value: ${careerStory.uniqueValue || "N/A"}` : ""}

Write the cover letter.`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      let coverLetter;
      try {
        let text = content.text.trim();
        
        text = text.replace(/^```json\n?/, '').replace(/```$/, '').trim();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          text = jsonMatch[0];
        }
        
        coverLetter = JSON.parse(text);
        
        if (!coverLetter.subject) {
          coverLetter.subject = `Application for ${jobTitle || "the position"}`;
        }
      } catch {
        coverLetter = {
          subject: `Application for ${jobTitle || "the position"}`,
          body: content.text,
        };
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

// ==================== AGENT ROUTES ====================

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
      include: {
        experiences: { orderBy: { startDate: "desc" } },
        projects: { take: 3 },
      },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ message: "ANTHROPIC_API_KEY not configured" });
    }

    const anthropic = new Anthropic({ apiKey });

    const experiencesText = resume.experiences
      .map((exp) => `${exp.title} at ${exp.company}: ${exp.description}`)
      .join("\n\n");

    const projectsText = resume.projects
      .map((proj) => `${proj.name}: ${proj.description}`)
      .join("\n\n");

    const systemPrompt = `You are a McKinsey-style achievement quantifier. Your task is to rewrite resume achievements to include metrics, numbers, and quantifiable impact. Output JSON with this structure:
{
  "achievements": [
    {
      "original": "original text",
      "rewritten": "quantified version with metrics",
      "metrics": { "percentage": "X%", "revenue": "$X", "scale": "X people", "time": "X% faster" },
      "category": "leadership|technical|collaboration|innovation|impact"
    }
  ],
  "summary": { "totalQuantified": number }
}`;

    const userPrompt = `Quantify these resume achievements:\n\nExperiences:\n${experiencesText}\n\nProjects:\n${projectsText}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      let result;
      const text = content.text.replace(/^```json\n?/, '').replace(/```$/, '').trim();
      try {
        result = JSON.parse(text);
      } catch {
        result = { achievements: [], error: "Failed to parse", raw: content.text };
      }

      return { result };
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
      include: {
        experiences: { take: 3, orderBy: { startDate: "desc" } },
        skills: true,
      },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ message: "ANTHROPIC_API_KEY not configured" });
    }

    const anthropic = new Anthropic({ apiKey });

    const experiencesText = resume.experiences
      .map((exp) => `${exp.title} at ${exp.company}: ${exp.description}`)
      .join("\n\n");

    const skillsText = resume.skills.map((s) => s.name).join(", ");

    const systemPrompt = `You are a Harvard Career Services advisor. Write 5 different professional summary versions for a resume. Each should be 2-3 sentences. Output JSON:
{
  "summaries": [
    { "version": 1, "style": "professional", "text": "..." },
    { "version": 2, "style": "achievement-focused", "text": "..." },
    { "version": 3, "style": "leadership", "text": "..." },
    { "version": 4, "style": "technical", "text": "..." },
    { "version": 5, "style": "growth-oriented", "text": "..." }
  ]
}`;

    const userPrompt = `Write summaries for this professional:\n\nName: ${resume.fullName}\nSkills: ${skillsText}\nTop Experiences:\n${experiencesText}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      let result;
      const text = content.text.replace(/^```json\n?/, '').replace(/```$/, '').trim();
      try {
        result = JSON.parse(text);
      } catch {
        result = { summaries: [], error: "Failed to parse", raw: content.text };
      }

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ message: "ANTHROPIC_API_KEY not configured" });
    }

    const anthropic = new Anthropic({ apiKey });

    const experiencesText = resume.experiences
      .map((exp) => `${exp.title} at ${exp.company}: ${exp.description}`)
      .join("\n\n");

    const skillsText = resume.skills.map((s) => s.name).join(", ");

    const systemPrompt = `You are a Google ATS optimization expert. Analyze the resume and provide optimization tips. Output JSON:
{
  "score": 0-100,
  "keywordsFound": ["keyword1", "keyword2"],
  "keywordsMissing": ["keyword3"],
  "suggestions": [
    { "type": "add", "text": "...", "priority": "high|medium|low" }
  ],
  "optimizedBullets": [
    { "original": "...", "optimized": "...", "reason": "..." }
  ]
}`;

    const userPrompt = jobDescription 
      ? `Optimize this resume for the job:\n\nJob Description:\n${jobDescription}\n\nResume:\n${experiencesText}\n\nSkills: ${skillsText}`
      : `Optimize this resume for ATS:\n\n${experiencesText}\n\nSkills: ${skillsText}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      let result;
      const text = content.text.replace(/^```json\n?/, '').replace(/```$/, '').trim();
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: "Failed to parse", raw: content.text };
      }

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
      include: {
        experiences: { orderBy: { startDate: "desc" }, take: 5 },
        projects: { take: 3 },
      },
    });

    if (!resume) {
      return reply.status(404).send({ message: "Resume not found" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ message: "ANTHROPIC_API_KEY not configured" });
    }

    const anthropic = new Anthropic({ apiKey });

    const experiencesText = resume.experiences
      .map((exp) => `${exp.title} at ${exp.company}: ${exp.description}`)
      .join("\n\n");

    const projectsText = resume.projects
      .map((proj) => `${proj.name}: ${proj.description}`)
      .join("\n\n");

    const systemPrompt = `You are a FAANG behavioral interview coach. Generate STAR method stories from resume experiences. Output JSON:
{
  "stories": [
    {
      "category": "leadership|conflict|teamwork|problem-solving|achievement",
      "situation": "...",
      "task": "...",
      "action": "...",
      "result": "...",
      "metrics": "...",
      "question": "Tell me about a time you..."
    }
  ]
}`;

    const userPrompt = `Generate STAR stories from:\n\nExperiences:\n${experiencesText}\n\nProjects:\n${projectsText}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      let result;
      const text = content.text.replace(/^```json\n?/, '').replace(/```$/, '').trim();
      try {
        result = JSON.parse(text);
      } catch {
        result = { stories: [], error: "Failed to parse", raw: content.text };
      }

      return { result };
    } catch (error: any) {
      console.error("Behavioral coach failed:", error.message);
      return reply.status(500).send({ message: "Failed to generate STAR stories", error: error.message });
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
