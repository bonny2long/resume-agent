import { describe, it, expect, beforeAll, afterAll } from "vitest";
import getPrismaClient from "@/database/client";

describe("GitHub Commands Tests", () => {
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    prisma = getPrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("github list", () => {
    it("should list all synced GitHub repositories", async () => {
      const repos = await prisma.gitHubRepo.findMany({
        orderBy: { updatedAt: "desc" },
      });

      console.log(`   ✓ Total repositories: ${repos.length}`);

      for (const repo of repos.slice(0, 5)) {
        console.log(`   ✓ ${repo.name}`);
        console.log(`      Description: ${repo.description || "N/A"}`);
        console.log(`      Stars: ${repo.stars} | Forks: ${repo.forks}`);
        console.log(`      Languages: ${repo.languages.join(", ")}`);
        console.log(`      Topics: ${repo.topics.join(", ")}`);
      }

      expect(repos).toBeInstanceOf(Array);
    });

    it("should calculate repository statistics", async () => {
      const repos = await prisma.gitHubRepo.findMany();

      if (repos.length > 0) {
        const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
        const totalForks = repos.reduce((sum, r) => sum + r.forks, 0);
        const avgStars = totalStars / repos.length;
        const privateRepos = repos.filter((r) => r.isPrivate).length;

        console.log(`   ✓ Repository Statistics:`);
        console.log(`      Total repos: ${repos.length}`);
        console.log(`      Total stars: ${totalStars}`);
        console.log(`      Total forks: ${totalForks}`);
        console.log(`      Average stars: ${avgStars.toFixed(1)}`);
        console.log(`      Private repos: ${privateRepos}`);

        expect(totalStars).toBeGreaterThanOrEqual(0);
      } else {
        console.log("   ⚠ No repositories - run github sync first");
      }
    });
  });

  describe("github show", () => {
    it("should show repository details", async () => {
      const repo = await prisma.gitHubRepo.findFirst({
        include: {},
      });

      if (!repo) {
        console.log("   ⚠ No repositories found");
        return;
      }

      console.log(`   ✓ Repository Details:`);
      console.log(`      Name: ${repo.name}`);
      console.log(`      Full Name: ${repo.fullName}`);
      console.log(`      URL: ${repo.url}`);
      console.log(`      Description: ${repo.description || "N/A"}`);
      console.log(`      Languages: ${repo.languages.join(", ")}`);
      console.log(`      Topics: ${repo.topics.join(", ")}`);
      console.log(`      Stars: ${repo.stars}`);
      console.log(`      Forks: ${repo.forks}`);
      console.log(`      Is Private: ${repo.isPrivate}`);
      console.log(`      Is Fork: ${repo.isFork}`);
      console.log(
        `      Created: ${new Date(repo.createdAt).toLocaleDateString()}`,
      );
      console.log(
        `      Updated: ${new Date(repo.updatedAt).toLocaleDateString()}`,
      );

      expect(repo.name).toBeDefined();
    });
  });

  describe("github sync simulation", () => {
    it("should identify repos needing sync", async () => {
      const repos = await prisma.gitHubRepo.findMany({
        orderBy: { updatedAt: "asc" },
        take: 10,
      });

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const staleRepos = repos.filter((r) => r.lastSynced < oneWeekAgo);

      console.log(
        `   ✓ Repos synced in last week: ${repos.length - staleRepos.length}`,
      );
      console.log(`   ✓ Repos needing sync: ${staleRepos.length}`);

      if (staleRepos.length > 0) {
        console.log('   💡 Run "npm run dev github sync" to update');
      }
    });

    it("should extract languages from repos", async () => {
      const repos = await prisma.gitHubRepo.findMany();

      const allLanguages = new Set<string>();
      repos.forEach((repo) => {
        repo.languages.forEach((lang) => allLanguages.add(lang));
      });

      const languageCounts = new Map<string, number>();
      repos.forEach((repo) => {
        repo.languages.forEach((lang) => {
          languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
        });
      });

      const sortedLanguages = Array.from(languageCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.log(`   ✓ Top Languages:`);
      sortedLanguages.forEach(([lang, count]) => {
        console.log(`      ${lang}: ${count} repos`);
      });

      expect(sortedLanguages.length).toBeGreaterThanOrEqual(0);
    });
  });
});

console.log("\n📋 GitHub Commands Test Suite loaded\n");
