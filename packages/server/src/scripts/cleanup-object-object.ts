import { prisma } from "@resume-agent/shared/src/client.js";

type CleanResult<T> = {
  value: T;
  changed: boolean;
};

function cleanLine(line: string): string {
  return line
    .replace(/\[object\s+object\]\.?/gi, " ")
    .replace(/\bobject\s+object\b/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;!?])/g, "$1")
    .trim();
}

function cleanText(value: string): string {
  const normalized = `${value || ""}`.replace(/\r\n/g, "\n");
  const cleanedLines = normalized.split("\n").map(cleanLine);
  return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function cleanUnknown(value: unknown): CleanResult<unknown> {
  if (typeof value === "string") {
    const cleaned = cleanText(value);
    return { value: cleaned, changed: cleaned !== value };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const cleaned = cleanUnknown(item);
      changed = changed || cleaned.changed;
      return cleaned.value;
    });
    return { value: next, changed };
  }

  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, current] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = cleanUnknown(current);
      changed = changed || cleaned.changed;
      next[key] = cleaned.value;
    }
    return { value: next, changed };
  }

  return { value, changed: false };
}

function hasArtifact(value: unknown): boolean {
  if (typeof value === "string") {
    return /\[object\s+object\]|\bobject\s+object\b/i.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasArtifact(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasArtifact(item),
    );
  }

  return false;
}

async function cleanupMasterResumes(apply: boolean) {
  const resumes = await prisma.masterResume.findMany({
    select: {
      id: true,
      summaryShort: true,
      summaryLong: true,
      resumeData: true,
    },
  });

  let changedCount = 0;
  for (const resume of resumes) {
    const shortHasArtifact = hasArtifact(resume.summaryShort);
    const longHasArtifact = hasArtifact(resume.summaryLong);
    const dataHasArtifact = hasArtifact(resume.resumeData);

    if (!shortHasArtifact && !longHasArtifact && !dataHasArtifact) continue;

    const cleanedShort = cleanText(resume.summaryShort || "");
    const cleanedLong = cleanText(resume.summaryLong || "");
    const cleanedData = cleanUnknown(resume.resumeData).value;

    changedCount += 1;
    if (apply) {
      await prisma.masterResume.update({
        where: { id: resume.id },
        data: {
          summaryShort: cleanedShort,
          summaryLong: cleanedLong,
          resumeData: cleanedData as any,
        },
      });
    }
  }

  return changedCount;
}

async function cleanupExperiences(apply: boolean) {
  const rows = await prisma.experience.findMany({
    select: { id: true, description: true },
    where: {
      description: {
        contains: "[object Object]",
        mode: "insensitive",
      },
    },
  });

  for (const row of rows) {
    const cleaned = cleanText(row.description || "");
    if (apply) {
      await prisma.experience.update({
        where: { id: row.id },
        data: { description: cleaned },
      });
    }
  }

  return rows.length;
}

async function cleanupProjects(apply: boolean) {
  const rows = await prisma.project.findMany({
    select: { id: true, description: true },
    where: {
      description: {
        contains: "[object Object]",
        mode: "insensitive",
      },
    },
  });

  for (const row of rows) {
    const cleaned = cleanText(row.description || "");
    if (apply) {
      await prisma.project.update({
        where: { id: row.id },
        data: { description: cleaned },
      });
    }
  }

  return rows.length;
}

async function cleanupCoverLetters(apply: boolean) {
  const rows = await prisma.coverLetter.findMany({
    select: { id: true, body: true },
    where: {
      body: {
        contains: "[object Object]",
        mode: "insensitive",
      },
    },
  });

  for (const row of rows) {
    const cleaned = cleanText(row.body || "");
    if (apply) {
      await prisma.coverLetter.update({
        where: { id: row.id },
        data: { body: cleaned },
      });
    }
  }

  return rows.length;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  console.log(`Starting cleanup ([object Object]) in ${dryRun ? "DRY RUN" : "APPLY"} mode...`);

  const [resumeCount, experienceCount, projectCount, coverLetterCount] = await Promise.all([
    cleanupMasterResumes(apply),
    cleanupExperiences(apply),
    cleanupProjects(apply),
    cleanupCoverLetters(apply),
  ]);

  console.log("Cleanup summary:");
  console.log(`- MasterResume rows affected: ${resumeCount}`);
  console.log(`- Experience rows affected: ${experienceCount}`);
  console.log(`- Project rows affected: ${projectCount}`);
  console.log(`- CoverLetter rows affected: ${coverLetterCount}`);
  console.log(`Mode: ${dryRun ? "dry-run only (no writes)" : "applied changes"}`);
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

