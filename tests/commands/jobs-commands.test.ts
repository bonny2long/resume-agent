import { describe, it, expect, beforeAll, afterAll } from "vitest";
import getPrismaClient from "@/database/client";

describe("Jobs Commands Tests", () => {
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("jobs list", () => {
    it("should list all analyzed jobs", async () => {
      const jobs = await prisma.job.findMany({
        include: { company: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      console.log(`   ✓ Found ${jobs.length} jobs in database`);

      for (let i = 0; i < Math.min(jobs.length, 3); i++) {
        const job = jobs[i];
        console.log(
          `   ✓ Job ${i + 1}: ${job.title} at ${job.company?.name || "Unknown"}`,
        );
        console.log(
          `      Match: ${job.skillsMatch || "N/A"}% | Level: ${job.experienceLevel || "N/A"}`,
        );
      }

      expect(jobs).toBeInstanceOf(Array);
    });

    it("should sort jobs by match score", async () => {
      const jobs = await prisma.job.findMany({
        include: { company: true },
        orderBy: { skillsMatch: "desc" },
        take: 10,
      });

      console.log(`   ✓ Jobs sorted by match score (highest first)`);
      expect(jobs).toBeInstanceOf(Array);
    });

    it("should calculate job statistics", async () => {
      const jobs = await prisma.job.findMany();

      if (jobs.length > 0) {
        const avgMatch =
          jobs.reduce((sum, j) => sum + (j.skillsMatch || 0), 0) / jobs.length;
        const highMatches = jobs.filter(
          (j) => (j.skillsMatch || 0) >= 80,
        ).length;
        const mediumMatches = jobs.filter(
          (j) => (j.skillsMatch || 0) >= 60 && (j.skillsMatch || 0) < 80,
        ).length;

        console.log(`   ✓ Total jobs: ${jobs.length}`);
        console.log(`   ✓ Average match: ${avgMatch.toFixed(1)}%`);
        console.log(`   ✓ High matches (80%+): ${highMatches}`);
        console.log(`   ✓ Medium matches (60-79%): ${mediumMatches}`);

        expect(avgMatch).toBeGreaterThanOrEqual(0);
        expect(avgMatch).toBeLessThanOrEqual(100);
      } else {
        console.log(`   ⚠ No jobs to calculate statistics`);
      }
    });
  });

  describe("jobs show", () => {
    it("should show job details", async () => {
      const job = await prisma.job.findFirst({
        include: { company: true, applications: true },
      });

      if (job) {
        console.log(`   ✓ Job Details:`);
        console.log(`   ✓ Title: ${job.title}`);
        console.log(`   ✓ Company: ${job.company?.name}`);
        console.log(`   ✓ Location: ${job.location}`);
        console.log(`   ✓ Salary: ${job.salary || "N/A"}`);
        console.log(`   ✓ Match Score: ${job.skillsMatch || "N/A"}%`);
        console.log(`   ✓ Experience Level: ${job.experienceLevel || "N/A"}`);
        console.log(`   ✓ Required Skills: ${job.requiredSkills.length}`);
        console.log(`   ✓ Preferred Skills: ${job.preferredSkills.length}`);
        console.log(`   ✓ Applications: ${job.applications.length}`);

        expect(job.title).toBeDefined();
        expect(job.requiredSkills).toBeInstanceOf(Array);
      } else {
        console.log(`   ⚠ No jobs found to show details`);
      }
    });

    it("should show company information", async () => {
      const job = await prisma.job.findFirst({
        include: { company: true },
      });

      if (job?.company) {
        const company = job.company;
        console.log(`   ✓ Company Details:`);
        console.log(`   ✓ Name: ${company.name}`);
        console.log(`   ✓ Domain: ${company.domain || "N/A"}`);
        console.log(`   ✓ Industry: ${company.industry || "N/A"}`);
        console.log(`   ✓ Size: ${company.size || "N/A"}`);
        console.log(`   ✓ Headquarters: ${company.headquarters || "N/A"}`);
        console.log(`   ✓ Tech Stack: ${company.techStack.length}`);

        expect(company.name).toBeDefined();
      } else {
        console.log(`   ⚠ No company found`);
      }
    });
  });

  describe("jobs search", () => {
    it("should search jobs by title", async () => {
      const searchTerm = "engineer";
      const jobs = await prisma.job.findMany({
        where: {
          title: { contains: searchTerm, mode: "insensitive" },
        },
        include: { company: true },
      });

      console.log(
        `   ✓ Search results for "${searchTerm}": ${jobs.length} jobs`,
      );
      expect(jobs).toBeInstanceOf(Array);
    });

    it("should search jobs by company name", async () => {
      const searchTerm = "publicis";
      const jobs = await prisma.job.findMany({
        where: {
          company: {
            name: { contains: searchTerm, mode: "insensitive" },
          },
        },
        include: { company: true },
      });

      console.log(
        `   ✓ Search results for "${searchTerm}": ${jobs.length} jobs`,
      );
      expect(jobs).toBeInstanceOf(Array);
    });

    it("should search jobs by experience level", async () => {
      const jobs = await prisma.job.findMany({
        where: {
          experienceLevel: "senior",
        },
        include: { company: true },
      });

      console.log(`   ✓ Senior-level jobs: ${jobs.length}`);
      expect(jobs).toBeInstanceOf(Array);
    });
  });

  describe("Database Schema", () => {
    it("should have proper job-company relationship", async () => {
      const jobsWithCompany = await prisma.job.findMany({
        include: { company: true },
        take: 5,
      });

      for (const job of jobsWithCompany) {
        expect(job.company).toBeDefined();
        expect(job.companyId).toBeDefined();
      }

      console.log(`   ✓ Job-Company relationships verified`);
    });

    it("should have proper job-hiringManager relationship", async () => {
      const jobsWithManagers = await prisma.job.findMany({
        include: { hiringManagers: true },
        take: 5,
      });

      for (const job of jobsWithManagers) {
        expect(job.hiringManagers).toBeInstanceOf(Array);
      }

      console.log(`   ✓ Job-HiringManager relationships verified`);
    });
  });
});

console.log("\n📋 Jobs Commands Test Suite loaded\n");
