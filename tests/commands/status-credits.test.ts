import { describe, it, expect, beforeAll, afterAll } from "vitest";
import getPrismaClient from "@/database/client";

describe("Status & Credits Commands Tests", () => {
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("status command", () => {
    it("should show system status", async () => {
      console.log("\n📊 System Status:\n");

      const masterResume = await prisma.masterResume.findFirst();
      const jobs = await prisma.job.findMany();
      const applications = await prisma.application.findMany();
      const companies = await prisma.company.findMany();
      const hiringManagers = await prisma.hiringManager.findMany();
      const gitHubRepos = await prisma.gitHubRepo.findMany();

      console.log(
        `   ✓ Master Resume: ${masterResume ? "✅ Configured" : "❌ Not set up"}`,
      );
      console.log(`   ✓ Jobs Analyzed: ${jobs.length}`);
      console.log(`   ✓ Applications: ${applications.length}`);
      console.log(`   ✓ Companies: ${companies.length}`);
      console.log(`   ✓ Hiring Managers: ${hiringManagers.length}`);
      console.log(`   ✓ GitHub Repos: ${gitHubRepos.length}`);

      expect(jobs).toBeInstanceOf(Array);
      expect(applications).toBeInstanceOf(Array);
    });

    it("should show application statistics", async () => {
      const applications = await prisma.application.findMany();

      const statusCounts = new Map<string, number>();
      applications.forEach((app) => {
        statusCounts.set(app.status, (statusCounts.get(app.status) || 0) + 1);
      });

      console.log(`\n   📈 Application Status:`);
      statusCounts.forEach((count, status) => {
        const emoji =
          status === "offered"
            ? "🟢"
            : status === "interviewing"
              ? "🟡"
              : status === "applied"
                ? "🔵"
                : "⚪";
        console.log(`      ${emoji} ${status}: ${count}`);
      });

      const withResume = applications.filter((a) => a.resumePath).length;
      const withCoverLetter = applications.filter(
        (a) => a.coverLetterPath,
      ).length;
      const withLinkedIn = applications.filter((a) => a.linkedInSent).length;

      console.log(`\n   📎 Documents:`);
      console.log(`      Resumes: ${withResume}/${applications.length}`);
      console.log(
        `      Cover Letters: ${withCoverLetter}/${applications.length}`,
      );
      console.log(
        `      LinkedIn Sent: ${withLinkedIn}/${applications.length}`,
      );
    });

    it("should show recent activity", async () => {
      const recentJobs = await prisma.job.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      const recentApplications = await prisma.application.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      console.log(`\n   🕐 Recent Activity:`);
      console.log(`      Recent Jobs: ${recentJobs.length}`);
      console.log(`      Recent Applications: ${recentApplications.length}`);

      if (recentJobs.length > 0) {
        const latestJob = recentJobs[0];
        console.log(
          `      Latest Job: ${latestJob.title} (${new Date(latestJob.createdAt).toLocaleDateString()})`,
        );
      }
    });
  });

  describe("credits command", () => {
    it("should display API credit information", () => {
      console.log("\n💳 API Credits:\n");

      const credits = {
        openai: process.env.OPENAI_API_KEY
          ? "✅ Configured"
          : "❌ Not configured",
        anthropic: process.env.ANTHROPIC_API_KEY
          ? "✅ Configured"
          : "❌ Not configured",
        github: process.env.GITHUB_TOKEN
          ? "✅ Configured"
          : "❌ Not configured",
        hunter: process.env.HUNTER_API_KEY
          ? "✅ Configured"
          : "❌ Not configured",
        apollo: process.env.APOLLO_API_KEY
          ? "✅ Configured"
          : "❌ Not configured",
      };

      Object.entries(credits).forEach(([service, status]) => {
        console.log(`   ${service}: ${status}`);
      });

      console.log("\n   💡 To check actual usage, visit provider dashboards");
    });

    it("should show database connection info", async () => {
      console.log("\n🗄️  Database Status:\n");

      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log("   ✓ Database: ✅ Connected");

        const jobCount = await prisma.job.count();
        const companyCount = await prisma.company.count();
        const applicationCount = await prisma.application.count();

        console.log(`   ✓ Records:`);
        console.log(`      Jobs: ${jobCount}`);
        console.log(`      Companies: ${companyCount}`);
        console.log(`      Applications: ${applicationCount}`);
      } catch (error) {
        console.log("   ❌ Database: Connection failed");
      }
    });
  });

  describe("resume management", () => {
    it("should list master resume information", async () => {
      const masterResume = await prisma.masterResume.findFirst({
        include: {
          skills: true,
          experiences: true,
          projects: true,
          education: true,
          certifications: true,
        },
      });

      if (!masterResume) {
        console.log("\n   ⚠ No master resume found");
        console.log("   💡 Run: npm run dev init");
        return;
      }

      console.log("\n📋 Master Resume:\n");
      console.log(`   ✓ Name: ${masterResume.fullName}`);
      console.log(`   ✓ Email: ${masterResume.email}`);
      console.log(`   ✓ Location: ${masterResume.location}`);
      console.log(`   ✓ LinkedIn: ${masterResume.linkedInUrl || "N/A"}`);
      console.log(`   ✓ GitHub: ${masterResume.githubUrl || "N/A"}`);
      console.log(`   ✓ Skills: ${masterResume.skills.length}`);
      console.log(`   ✓ Experiences: ${masterResume.experiences.length}`);
      console.log(`   ✓ Projects: ${masterResume.projects.length}`);
      console.log(`   ✓ Education: ${masterResume.education.length}`);
      console.log(`   ✓ Certifications: ${masterResume.certifications.length}`);

      expect(masterResume.fullName).toBeDefined();
    });

    it("should show skills breakdown", async () => {
      const skills = await prisma.skill.findMany();

      const categoryCounts = new Map<string, number>();
      skills.forEach((skill) => {
        categoryCounts.set(
          skill.category,
          (categoryCounts.get(skill.category) || 0) + 1,
        );
      });

      console.log("\n📊 Skills Breakdown:\n");
      categoryCounts.forEach((count, category) => {
        console.log(`   ✓ ${category}: ${count}`);
      });
    });
  });
});

console.log("\n📋 Status & Credits Test Suite loaded\n");
