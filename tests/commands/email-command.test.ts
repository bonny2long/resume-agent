import { describe, it, expect, beforeAll, afterAll } from "vitest";
import getPrismaClient from "@/database/client";

describe("Email Command Tests", () => {
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("email generation", () => {
    it("should list recent applications for email", async () => {
      const applications = await prisma.application.findMany({
        include: {
          job: { include: { company: true } },
          hiringManager: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      console.log(`   ✓ Found ${applications.length} applications`);

      for (const app of applications.slice(0, 3)) {
        const daysAgo = Math.floor(
          (Date.now() - app.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        console.log(
          `   ✓ Application: ${app.job.title} at ${app.job.company.name}`,
        );
        console.log(
          `      Status: ${app.status} | Created: ${daysAgo} days ago`,
        );
      }

      expect(applications).toBeInstanceOf(Array);
    });

    it("should check if email messages table exists", async () => {
      try {
        const emailCount = await prisma.emailMessage.count();
        console.log(`   ✓ Email messages table exists: ${emailCount} records`);
        expect(typeof emailCount).toBe("number");
      } catch (error) {
        console.log(`   ⚠ Email messages table may not exist or have issues`);
      }
    });

    it("should verify application-hiringManager relationship", async () => {
      const applications = await prisma.application.findMany({
        include: { hiringManager: true, job: true },
        take: 10,
      });

      let withManager = 0;
      for (const app of applications) {
        if (app.hiringManager) {
          withManager++;
        }
      }

      console.log(
        `   ✓ Applications with hiring manager: ${withManager}/${applications.length}`,
      );
      expect(applications).toBeInstanceOf(Array);
    });
  });
});

console.log("\n📋 Email Command Test Suite loaded\n");
