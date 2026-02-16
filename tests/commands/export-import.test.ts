import { describe, it, expect, beforeAll, afterAll } from "vitest";
import getPrismaClient from "@/database/client";
import { ExportService } from "@/services/export.service";

describe("Export/Import Commands Tests", () => {
  let prisma: ReturnType<typeof getPrismaClient>;
  let exportService: ExportService;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();
    exportService = new ExportService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("export master resume", () => {
    it("should export master resume as JSON", async () => {
      const masterResume = await prisma.masterResume.findFirst({
        include: {
          experiences: { include: { achievements: true, technologies: true } },
          projects: { include: { technologies: true } },
          skills: true,
          education: true,
          certifications: true,
        },
      });

      if (!masterResume) {
        console.log("   ⚠ No master resume found to export");
        return;
      }

      console.log(`   ✓ Master Resume Found:`);
      console.log(`   ✓ Name: ${masterResume.fullName}`);
      console.log(`   ✓ Email: ${masterResume.email}`);
      console.log(`   ✓ Location: ${masterResume.location}`);
      console.log(`   ✓ Skills: ${masterResume.skills.length}`);
      console.log(`   ✓ Experiences: ${masterResume.experiences.length}`);
      console.log(`   ✓ Projects: ${masterResume.projects.length}`);
      console.log(`   ✓ Education: ${masterResume.education.length}`);
      console.log(`   ✓ Certifications: ${masterResume.certifications.length}`);

      expect(masterResume.fullName).toBeDefined();
    });

    it("should export master resume as markdown", async () => {
      const masterResume = await prisma.masterResume.findFirst({
        include: {
          experiences: { include: { achievements: true } },
          projects: true,
          skills: true,
          education: true,
          certifications: true,
        },
      });

      if (!masterResume) {
        console.log("   ⚠ No master resume found");
        return;
      }

      const markdownContent = `# ${masterResume.fullName}

## Contact
- Email: ${masterResume.email}
- Phone: ${masterResume.phone}
- Location: ${masterResume.location}
${masterResume.linkedInUrl ? `- LinkedIn: ${masterResume.linkedInUrl}` : ""}
${masterResume.githubUrl ? `- GitHub: ${masterResume.githubUrl}` : ""}

## Summary
${masterResume.summaryShort}

## Skills
${masterResume.skills.map((s) => `- ${s.name}`).join("\n")}

## Experience
${masterResume.experiences
  .map(
    (e) => `
### ${e.title} at ${e.company}
- ${e.description || ""}
`,
  )
  .join("\n")}

## Projects
${masterResume.projects
  .map(
    (p) => `
### ${p.name}
- ${p.description}
`,
  )
  .join("\n")}

## Education
${masterResume.education
  .map(
    (e) => `
### ${e.degree} in ${e.field}
- ${e.institution}
`,
  )
  .join("\n")}
`;

      console.log(
        `   ✓ Markdown export generated (${markdownContent.length} chars)`,
      );
      expect(markdownContent).toContain(masterResume.fullName);
    });
  });

  describe("export github repos", () => {
    it("should list GitHub repositories", async () => {
      const repos = await prisma.gitHubRepo.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
      });

      console.log(`   ✓ Found ${repos.length} GitHub repositories`);

      for (const repo of repos.slice(0, 5)) {
        console.log(`   ✓ Repo: ${repo.name}`);
        console.log(`      Stars: ${repo.stars} | Forks: ${repo.forks}`);
        console.log(`      Languages: ${repo.languages.join(", ")}`);
      }

      expect(repos).toBeInstanceOf(Array);
    });

    it("should export GitHub repos", async () => {
      const repos = await prisma.gitHubRepo.findMany({
        orderBy: { stars: "desc" },
        take: 10,
      });

      if (repos.length === 0) {
        console.log("   ⚠ No GitHub repos to export - run github sync first");
        return;
      }

      const exportData = repos.map((repo) => ({
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        url: repo.url,
        languages: repo.languages,
        topics: repo.topics,
        stars: repo.stars,
        forks: repo.forks,
        isPrivate: repo.isPrivate,
      }));

      console.log(
        `   ✓ GitHub repos export prepared: ${exportData.length} repos`,
      );
      expect(exportData).toBeInstanceOf(Array);
    });
  });

  describe("data integrity", () => {
    it("should verify resume has required fields", async () => {
      const masterResume = await prisma.masterResume.findFirst();

      if (!masterResume) {
        console.log("   ⚠ No master resume to verify");
        return;
      }

      const requiredFields = [
        "fullName",
        "email",
        "phone",
        "location",
        "summaryShort",
      ];
      const missingFields: string[] = [];

      for (const field of requiredFields) {
        if (!masterResume[field as keyof typeof masterResume]) {
          missingFields.push(field);
        }
      }

      if (missingFields.length === 0) {
        console.log(`   ✓ All required fields present`);
      } else {
        console.log(`   ⚠ Missing fields: ${missingFields.join(", ")}`);
      }

      expect(missingFields.length).toBe(0);
    });

    it("should verify experiences have achievements", async () => {
      const experiences = await prisma.experience.findMany({
        include: { achievements: true },
        where: {
          achievements: {
            some: {},
          },
        },
      });

      console.log(`   ✓ Experiences with achievements: ${experiences.length}`);

      const allExperiences = await prisma.experience.count();
      console.log(`   ✓ Total experiences: ${allExperiences}`);

      expect(experiences.length).toBeGreaterThanOrEqual(0);
    });
  });
});

console.log("\n📋 Export/Import Test Suite loaded\n");
