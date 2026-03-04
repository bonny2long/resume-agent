import { prisma } from "@resume-agent/shared/src/client.js";

type RecordValue = Record<string, unknown>;

function toRecord(value: unknown): RecordValue {
  return value && typeof value === "object" ? (value as RecordValue) : {};
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeStringArray(value: unknown, maxItems = 12): string[] {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "number" || typeof item === "boolean") return `${item}`.trim();
      const record = toRecord(item);
      return (
        toStringValue(record.description) ||
        toStringValue(record.text) ||
        toStringValue(record.name) ||
        toStringValue(record.title) ||
        ""
      );
    })
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function mergeUniqueStrings(...inputs: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const input of inputs) {
    for (const raw of input || []) {
      const value = `${raw || ""}`.trim();
      if (!value) continue;
      const key = normalizeValue(value);
      if (!key || key === "object object" || seen.has(key)) continue;
      seen.add(key);
      merged.push(value);
    }
  }

  return merged;
}

function splitSentences(text: string): string[] {
  return (text || "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
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

  if (explicitBullets.length >= 2) return explicitBullets.slice(0, 8);
  return splitSentences(normalized).slice(0, 8);
}

function extractAchievementDescriptions(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((achievement) => {
      const record = toRecord(achievement);
      return toStringValue(record.description) || toStringValue(achievement);
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildBullets(existingBullets: unknown, description: unknown, achievements: unknown, maxItems = 12): string[] {
  const descriptionText = toStringValue(description);
  const merged = mergeUniqueStrings(
    sanitizeStringArray(existingBullets, maxItems),
    splitDescriptionIntoBullets(descriptionText),
    extractAchievementDescriptions(achievements, maxItems),
  ).slice(0, maxItems);

  if (merged.length > 0) return merged;
  return descriptionText ? [descriptionText] : [];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const resumes = await prisma.masterResume.findMany({
    select: { id: true, resumeData: true },
  });

  let scanned = 0;
  let updated = 0;
  let totalExperienceRows = 0;
  let populatedExperienceRows = 0;

  for (const resume of resumes) {
    scanned += 1;
    const resumeData = toRecord(resume.resumeData);
    const snapshot = toRecord(resumeData.uploadSnapshot);
    const experiences = Array.isArray(snapshot.experiences) ? snapshot.experiences : [];
    const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];

    if (experiences.length === 0 && projects.length === 0) continue;

    let changed = false;

    const nextExperiences = experiences.map((entry) => {
      const exp = toRecord(entry);
      const bullets = buildBullets(exp.bullets, exp.description, exp.achievements, 12);
      const prevBullets = sanitizeStringArray(exp.bullets, 12);
      const hasChanged = normalizeValue(JSON.stringify(prevBullets)) !== normalizeValue(JSON.stringify(bullets));
      if (hasChanged) changed = true;

      totalExperienceRows += 1;
      if (bullets.length > 0) populatedExperienceRows += 1;

      return {
        ...exp,
        bullets,
      };
    });

    const nextProjects = projects.map((entry) => {
      const proj = toRecord(entry);
      const bullets = buildBullets(proj.bullets, proj.description, proj.achievements, 10);
      const prevBullets = sanitizeStringArray(proj.bullets, 10);
      const hasChanged = normalizeValue(JSON.stringify(prevBullets)) !== normalizeValue(JSON.stringify(bullets));
      if (hasChanged) changed = true;

      return {
        ...proj,
        bullets,
      };
    });

    if (!changed) continue;

    if (!dryRun) {
      await prisma.masterResume.update({
        where: { id: resume.id },
        data: {
          resumeData: {
            ...resumeData,
            uploadSnapshot: {
              ...snapshot,
              experiences: nextExperiences,
              projects: nextProjects,
            },
          },
        },
      });
    }

    updated += 1;
  }

  const coverage = totalExperienceRows > 0
    ? Number((populatedExperienceRows / totalExperienceRows).toFixed(3))
    : 0;

  console.log(
    JSON.stringify({
      dryRun,
      scanned,
      updated,
      totalExperienceRows,
      populatedExperienceRows,
      bulletCoverage: coverage,
    }),
  );
}

main()
  .catch((error) => {
    console.error("backfill-upload-snapshot-bullets failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
