// src/services/github.service.ts
import { PrismaClient } from "@prisma/client";
import { logger } from "@/utils/logger";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  languages: Record<string, number>;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  default_branch: string;
}

interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
  bio: string | null;
  location: string | null;
  blog: string | null;
  company: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export class GitHubService {
  constructor(private prisma: PrismaClient) {}

  private getHeaders(): Record<string, string> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }

    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    };
  }

  private async fetchFromGitHub(url: string): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Invalid GitHub token. Please check your GITHUB_TOKEN.",
          );
        }
        if (response.status === 403) {
          throw new Error(
            "GitHub rate limit exceeded. Please try again later.",
          );
        }
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error(`GitHub API request timed out: ${url}`);
      }

      if (error instanceof Error) {
        // Log the cause for better debugging (network issues like DNS, connection reset)
        if ((error as any).cause) {
          logger.error(`Fetch error cause for ${url}`, (error as any).cause);
        }
        throw error;
      }
      throw new Error(`Failed to fetch from GitHub: ${url}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getUserProfile(): Promise<GitHubUser> {
    logger.info("Fetching GitHub user profile");
    return await this.fetchFromGitHub("https://api.github.com/user");
  }

  async getUserRepos(
    perPage: number = 100,
    page: number = 1,
  ): Promise<GitHubRepo[]> {
    logger.info(
      `Fetching GitHub repositories (page ${page}, per page ${perPage})`,
    );
    const url = `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&type=owner`;
    return await this.fetchFromGitHub(url);
  }

  async getAllUserRepos(): Promise<GitHubRepo[]> {
    logger.info("Fetching all GitHub repositories");
    const allRepos: GitHubRepo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const repos = await this.getUserRepos(perPage, page);
      if (repos.length === 0) break;

      allRepos.push(...repos);
      page++;
    }

    return allRepos;
  }

  async getRepoLanguages(
    owner: string,
    repo: string,
  ): Promise<Record<string, number>> {
    logger.info(`Fetching languages for ${owner}/${repo}`);
    const url = `https://api.github.com/repos/${owner}/${repo}/languages`;
    return await this.fetchFromGitHub(url);
  }

  async getRepoReadme(owner: string, repo: string): Promise<string | null> {
    logger.info(`Fetching README for ${owner}/${repo}`);
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
      const readmeData = await this.fetchFromGitHub(url);

      const response = await fetch(readmeData.download_url);
      if (!response.ok) return null;

      return await response.text();
    } catch (error) {
      logger.warn(`Failed to fetch README for ${owner}/${repo}: ${error}`);
      return null;
    }
  }

  async syncRepositories(): Promise<{
    added: number;
    total: number;
  }> {
    logger.info("Starting GitHub repository sync");
    const startTime = Date.now();

    try {
      const user = await this.getUserProfile();
      const repos = await this.getAllUserRepos();

      let added = 0;

      for (const repo of repos) {
        // Fetch additional details
        const languages = await this.getRepoLanguages(user.login, repo.name);
        const readmeContent = await this.getRepoReadme(user.login, repo.name);

        const repoData = {
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          languages: Object.keys(languages),
          topics: repo.topics,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          lastCommit: repo.pushed_at ? new Date(repo.pushed_at) : null,
          createdAt: new Date(repo.created_at),
          updatedAt: new Date(repo.updated_at),
          isPrivate: repo.private,
          isFork: repo.fork,
          readmeContent,
        };

        // Upsert to database
        await this.prisma.gitHubRepo.upsert({
          where: { fullName: repo.full_name },
          update: repoData,
          create: repoData,
        });

        added++;
      }

      const duration = Date.now() - startTime;
      logger.info(`GitHub sync completed in ${duration}ms`);

      return {
        added,
        total: repos.length,
      };
    } catch (error) {
      logger.error("GitHub sync failed", error);
      throw error;
    }
  }

  async getRepositories(): Promise<any[]> {
    return await this.prisma.gitHubRepo.findMany({
      orderBy: { updatedAt: "desc" },
    });
  }

  async getRepositoryByName(name: string): Promise<any | null> {
    return await this.prisma.gitHubRepo.findFirst({
      where: {
        OR: [{ name: name }, { fullName: name }],
      },
    });
  }

  async getFeaturedRepositories(limit: number = 6): Promise<any[]> {
    return await this.prisma.gitHubRepo.findMany({
      where: {
        AND: [{ isFork: false }, { isPrivate: false }, { stars: { gte: 1 } }],
      },
      orderBy: [{ stars: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });
  }

  getLanguageStats(
    repos: any[],
  ): Record<string, { count: number; repos: string[] }> {
    const stats: Record<string, { count: number; repos: string[] }> = {};

    repos.forEach((repo) => {
      repo.languages.forEach((lang: string) => {
        if (!stats[lang]) {
          stats[lang] = { count: 0, repos: [] };
        }
        stats[lang].count++;
        stats[lang].repos.push(repo.name);
      });
    });

    return stats;
  }
}

// Export singleton instance
export const githubService = new GitHubService(new PrismaClient());
