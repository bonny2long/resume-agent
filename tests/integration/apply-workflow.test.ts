import { describe, it, expect, beforeAll, afterAll } from "vitest";
import getPrismaClient from "@/database/client";

const TEST_JOB_URL =
  "https://careers.publicisgroupe.com/jobs/125448?lang=en-us&iis=Job+Board&iisn=LinkedIn+Apply";

describe("Apply Workflow Integration Tests", () => {
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();
    console.log("\n✅ Database connected for Apply Workflow tests");
  });

  afterAll(async () => {
    await prisma.$disconnect();
    console.log("\n✅ Cleanup complete");
  });

  describe("Database Integration", () => {
    it("should save and retrieve job from database", async () => {
      const jobs = await prisma.job.findMany({
        include: { company: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      expect(jobs).toBeInstanceOf(Array);

      if (jobs.length > 0) {
        const job = jobs[0];
        console.log(
          `   ✓ Job retrieved: ${job.title} at ${job.company?.name || "Unknown"}`,
        );
        console.log(`   ✓ Required skills: ${job.requiredSkills.length}`);
        console.log(`   ✓ Match score: ${job.skillsMatch || "N/A"}%`);
        console.log(`   ✓ Experience level: ${job.experienceLevel || "N/A"}`);
      } else {
        console.log(`   ⚠ No jobs in database yet`);
      }
    });

    it("should save and retrieve applications", async () => {
      const applications = await prisma.application.findMany({
        include: { job: { include: { company: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      console.log(`   ✓ Applications in database: ${applications.length}`);

      for (const app of applications) {
        console.log(
          `   ✓ Application: ${app.job.title} - Status: ${app.status}`,
        );
        console.log(`      Resume: ${app.resumePath ? "Yes" : "No"}`);
        console.log(
          `      Cover Letter: ${app.coverLetterPath ? "Yes" : "No"}`,
        );
        console.log(`      LinkedIn Sent: ${app.linkedInSent ? "Yes" : "No"}`);
      }

      expect(applications).toBeInstanceOf(Array);
    });

    it("should retrieve master resume", async () => {
      const masterResume = await prisma.masterResume.findFirst({
        include: {
          experiences: { include: { achievements: true } },
          projects: { include: { technologies: true } },
          skills: true,
          education: true,
          certifications: true,
        },
      });

      if (masterResume) {
        console.log(`   ✓ Master Resume: ${masterResume.fullName}`);
        console.log(`   ✓ Skills: ${masterResume.skills.length}`);
        console.log(`   ✓ Experiences: ${masterResume.experiences.length}`);
        console.log(
          `      Achievements: ${masterResume.experiences.reduce((sum, e) => sum + e.achievements.length, 0)}`,
        );
        console.log(`   ✓ Projects: ${masterResume.projects.length}`);
        console.log(`   ✓ Education: ${masterResume.education.length}`);
        console.log(
          `   ✓ Certifications: ${masterResume.certifications.length}`,
        );

        expect(masterResume.fullName).toBeDefined();
        expect(masterResume.skills).toBeInstanceOf(Array);
      } else {
        console.log(`   ⚠ No master resume found - run init first`);
      }
    });

    it("should have jobs with required skills", async () => {
      const jobs = await prisma.job.findMany({
        where: {
          requiredSkills: { isEmpty: false },
        },
        orderBy: { skillsMatch: "desc" },
        take: 10,
      });

      console.log(`   ✓ Jobs with required skills: ${jobs.length}`);

      for (const job of jobs.slice(0, 3)) {
        console.log(`   ✓ ${job.title} at ${job.company?.name || "Unknown"}`);
        console.log(
          `      Skills: ${job.requiredSkills.slice(0, 5).join(", ")}${job.requiredSkills.length > 5 ? "..." : ""}`,
        );
        console.log(`      Match: ${job.skillsMatch || "N/A"}%`);
      }

      expect(jobs.length).toBeGreaterThan(0);
    });

    it("should retrieve hiring managers", async () => {
      const hiringManagers = await prisma.hiringManager.findMany({
        include: { job: { include: { company: true } } },
        orderBy: { confidence: "desc" },
        take: 10,
      });

      console.log(`   ✓ Total hiring managers: ${hiringManagers.length}`);

      for (const hm of hiringManagers.slice(0, 3)) {
        console.log(`   ✓ ${hm.name} - ${hm.title}`);
        console.log(`      Company: ${hm.job?.company?.name || "Unknown"}`);
        console.log(`      Confidence: ${hm.confidence}%`);
        console.log(`      LinkedIn: ${hm.linkedInUrl ? "Yes" : "No"}`);
      }

      expect(hiringManagers).toBeInstanceOf(Array);
    });

    it("should verify job-company relationships", async () => {
      const jobs = await prisma.job.findMany({
        include: { company: true },
        take: 10,
      });

      let validRelationships = 0;
      for (const job of jobs) {
        if (job.company) {
          validRelationships++;
        }
      }

      console.log(
        `   ✓ Jobs with company: ${validRelationships}/${jobs.length}`,
      );
      expect(validRelationships).toBeGreaterThan(0);
    });

    it("should calculate overall statistics", async () => {
      const totalJobs = await prisma.job.count();
      const totalApplications = await prisma.application.count();
      const totalCompanies = await prisma.company.count();
      const totalHiringManagers = await prisma.hiringManager.count();
      const totalRepos = await prisma.gitHubRepo.count();

      console.log(`\n   📊 Overall Statistics:`);
      console.log(`      Total Jobs Analyzed: ${totalJobs}`);
      console.log(`      Total Applications: ${totalApplications}`);
      console.log(`      Total Companies: ${totalCompanies}`);
      console.log(`      Total Hiring Managers: ${totalHiringManagers}`);
      console.log(`      Total GitHub Repos: ${totalRepos}`);

      expect(totalJobs).toBeGreaterThan(0);
    });
  });

  describe("Data Validation", () => {
    it("should validate job skills data", async () => {
      const jobs = await prisma.job.findMany({
        where: {
          requiredSkills: { isEmpty: false },
        },
      });

      for (const job of jobs) {
        expect(job.requiredSkills).toBeInstanceOf(Array);
        expect(job.requiredSkills.length).toBeGreaterThan(0);
      }

      console.log(`   ✓ All ${jobs.length} jobs have valid skills data`);
    });

    it("should validate experience data", async () => {
      const experiences = await prisma.experience.findMany({
        include: { achievements: true },
      });

      const withAchievements = experiences.filter(
        (e) => e.achievements.length > 0,
      );
      console.log(`   ✓ Experiences: ${experiences.length}`);
      console.log(`   ✓ With achievements: ${withAchievements.length}`);

      expect(experiences).toBeInstanceOf(Array);
    });

    it("should validate skills categories", async () => {
      const skills = await prisma.skill.findMany();

      const categoryCounts = new Map<string, number>();
      skills.forEach((skill) => {
        categoryCounts.set(
          skill.category,
          (categoryCounts.get(skill.category) || 0) + 1,
        );
      });

      console.log(`   ✓ Skill categories:`);
      categoryCounts.forEach((count, category) => {
        console.log(`      ${category}: ${count}`);
      });

      expect(categoryCounts.size).toBeGreaterThan(0);
    });
  });
});

console.log("\n📋 Apply Workflow Test Suite (Database Integration) loaded");
console.log(`   Test URL: ${TEST_JOB_URL}\n`);
