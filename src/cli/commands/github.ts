// src/cli/commands/github.ts
import { Command } from "commander";
import chalk from "chalk";
import { logger } from "@/utils/logger";
import { githubService } from "@/services/github.service";
import {
  gitHubSkillsService,
  GitHubSkill,
} from "@/services/github-skills.service";

export const githubCommand = new Command("github").description(
  "GitHub integration",
);

// Sync repositories
githubCommand
  .command("sync")
  .description("Sync your GitHub repositories")
  .action(async () => {
    try {
      console.log(chalk.bold.cyan("🔄 Syncing GitHub repositories..."));
      console.log(chalk.gray("─".repeat(50)));

      const result = await githubService.syncRepositories();

      console.log(chalk.green("✅ Sync completed successfully!"));
      console.log(chalk.white(`Total repositories: ${result.total}`));
      console.log(chalk.white(`New repositories added: ${result.added}`));
    } catch (error) {
      console.log(chalk.red("❌ Failed to sync repositories:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );

      if (error instanceof Error && error.message.includes("GITHUB_TOKEN")) {
        console.log(chalk.cyan("\n💡 To fix this:"));
        console.log(
          chalk.white("1. Go to: https://github.com/settings/tokens"),
        );
        console.log(chalk.white("2. Generate new token (classic)"));
        console.log(chalk.white("3. Select scopes: repo, read:user"));
        console.log(chalk.white("4. Add to .env as GITHUB_TOKEN=your_token"));
      }

      logger.error("GitHub sync failed", error);
    }
  });

// List repositories
githubCommand
  .command("list")
  .description("List synced GitHub repositories")
  .option("-f, --featured", "Show only featured repositories", false)
  .option("-l, --limit <number>", "Limit number of results", "10")
  .action(async (options) => {
    try {
      console.log(chalk.bold.cyan("📋 GitHub Repositories"));
      console.log(chalk.gray("─".repeat(50)));

      let repos;
      if (options.featured) {
        repos = await githubService.getFeaturedRepositories(
          parseInt(options.limit),
        );
      } else {
        repos = await githubService.getRepositories();
        repos = repos.slice(0, parseInt(options.limit));
      }

      if (repos.length === 0) {
        console.log(chalk.yellow("⚠️  No repositories found."));
        console.log(
          chalk.cyan(
            "\n💡 Run 'npm run dev github sync' to sync your repositories",
          ),
        );
        return;
      }

      repos.forEach((repo, index) => {
        console.log(chalk.bold.white(`\n${index + 1}. ${repo.name}`));
        console.log(chalk.gray(`   ${repo.description || "No description"}`));
        console.log(
          chalk.cyan(`   🌟 ${repo.stars} stars | 🍴 ${repo.forks} forks`),
        );

        if (repo.languages.length > 0) {
          console.log(
            chalk.white(`   🛠️  ${repo.languages.slice(0, 5).join(", ")}`),
          );
        }

        if (repo.topics.length > 0) {
          console.log(
            chalk.gray(`   🏷️  ${repo.topics.slice(0, 3).join(", ")}`),
          );
        }

        console.log(chalk.dim(`   🔗 ${repo.url}`));
        console.log(
          chalk.dim(`   📅 Updated: ${repo.updatedAt.toLocaleDateString()}`),
        );
      });

      // Language statistics
      const allRepos =
        options.featured ? repos : await githubService.getRepositories();
      const stats = githubService.getLanguageStats(allRepos);

      if (Object.keys(stats).length > 0) {
        console.log(chalk.bold.cyan("\n📊 Language Statistics:"));
        Object.entries(stats)
          .sort(([, a], [, b]) => b.count - a.count)
          .slice(0, 5)
          .forEach(([lang, data]) => {
            console.log(chalk.white(`   ${lang}: ${data.count} repos`));
          });
      }
    } catch (error) {
      console.log(chalk.red("❌ Failed to list repositories:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Failed to list repositories", error);
    }
  });

// Get repository details
githubCommand
  .command("show <name>")
  .description("Show details for a specific repository")
  .action(async (name: string) => {
    try {
      // Extract repository name from URL if URL is provided
      let repoName = name;
      if (name.startsWith("https://github.com/")) {
        const parts = name.split("/");
        repoName = parts[parts.length - 1];
      }

      console.log(chalk.bold.cyan(`📄 Repository: ${repoName}`));
      console.log(chalk.gray("─".repeat(50)));

      const repo = await githubService.getRepositoryByName(repoName);

      if (!repo) {
        console.log(chalk.red(`❌ Repository '${name}' not found`));
        console.log(
          chalk.cyan(
            "\n💡 Run 'npm run dev github list' to see available repositories",
          ),
        );
        return;
      }

      console.log(chalk.bold.white(`\n${repo.name}`));
      console.log(chalk.white(repo.description || "No description"));
      console.log(chalk.cyan(`\n🔗 ${repo.url}`));

      console.log(chalk.bold.cyan("\n📊 Statistics:"));
      console.log(chalk.white(`   ⭐ Stars: ${repo.stars}`));
      console.log(chalk.white(`   🍴 Forks: ${repo.forks}`));
      console.log(
        chalk.white(`   📅 Created: ${repo.createdAt.toLocaleDateString()}`),
      );
      console.log(
        chalk.white(`   🔄 Updated: ${repo.updatedAt.toLocaleDateString()}`),
      );
      console.log(
        chalk.white(
          `   📝 Last commit: ${repo.lastCommit?.toLocaleDateString() || "Unknown"}`,
        ),
      );

      if (repo.languages.length > 0) {
        console.log(chalk.bold.cyan("\n🛠️  Languages:"));
        repo.languages.forEach((lang: string) => {
          console.log(chalk.white(`   • ${lang}`));
        });
      }

      if (repo.topics.length > 0) {
        console.log(chalk.bold.cyan("\n🏷️  Topics:"));
        repo.topics.forEach((topic: string) => {
          console.log(chalk.white(`   • ${topic}`));
        });
      }

      if (repo.readmeContent) {
        console.log(chalk.bold.cyan("\n📖 README Preview:"));
        const preview = repo.readmeContent.split("\n").slice(0, 10).join("\n");
        console.log(chalk.gray(preview));
        if (repo.readmeContent.split("\n").length > 10) {
          console.log(chalk.gray("\n   ... (truncated)"));
        }
      }
    } catch (error) {
      console.log(chalk.red("❌ Failed to show repository:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Failed to show repository", error);
    }
  });

// --- Extract Skills Subcommand ---

interface ExtractOptions {
  minCommits: string;
  minSize: string;
  minDays: string;
  repo?: string;
  showSkipped: boolean;
  syncFirst: boolean;
  dryRun: boolean;
  includeForks: boolean;
}

const extractSkillsCommand = new Command("extract-skills")
  .description("Extract skills from high-quality GitHub repositories only")
  .option("-m, --min-commits <number>", "Minimum commits to consider repo", "1")
  .option("-s, --min-size <number>", "Minimum repo size in KB", "1")
  .option("-d, --min-days <number>", "Minimum days since last update", "365")
  .option("-r, --repo <name>", "Extract from specific repository only")
  .option("--show-skipped", "Show repos that were skipped and why", false)
  .option("--sync-first", "Sync repositories before extracting", false)
  .option("--dry-run", "Show what would be extracted without updating", false)
  .option(
    "--include-forks",
    "Include forked repositories where you made substantial contributions",
    false,
  )
  .action(async (options: ExtractOptions) => {
    try {
      console.log(
        chalk.bold.cyan("🔍 Extracting Skills from High-Quality Repositories"),
      );
      console.log(chalk.gray("─".repeat(60)));

      // Sync repositories if requested
      if (options.syncFirst) {
        console.log(chalk.yellow("🔄 Syncing repositories first..."));
        await githubService.syncRepositories();
        console.log(chalk.green("✅ Sync completed\n"));
      }

      const minCommits = parseInt(options.minCommits);
      const minSize = parseInt(options.minSize);
      const minDays = parseInt(options.minDays);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - minDays);

      console.log(chalk.bold.cyan("📋 Quality Thresholds:"));
      console.log(chalk.white(`   • Minimum commits: ${minCommits}`));
      console.log(chalk.white(`   • Minimum size: ${minSize}KB`));
      console.log(chalk.white(`   • Updated within: ${minDays} days`));
      console.log(chalk.gray("─".repeat(60)));

      // Get all repositories
      const allRepos = await githubService.getRepositories();

      // Filter for high-quality repositories
      const qualityRepos = allRepos.filter((repo) => {
        const qualityChecks = {
          hasEnoughActivity: repo.languages.length > 0, // Has technologies detected
          isRecentlyUpdated: new Date(repo.updatedAt) > cutoffDate,
          isNotFork: options.includeForks || !repo.isFork,
          hasReadme: !!repo.readmeContent,
          hasLanguages: repo.languages.length > 0,
        };

        const isQualityRepo = Object.values(qualityChecks).every(
          (check) => check,
        );

        if (options.showSkipped && !isQualityRepo) {
          console.log(chalk.yellow(`⚠️  Skipped ${repo.name}:`));
          const failedChecks = Object.entries(qualityChecks)
            .filter(([_, passed]) => !passed)
            .map(([check, _]) => {
              const checkNames = {
                hasEnoughActivity: "No activity (stars/forks)",
                isRecentlyUpdated: "Too old",
                isNotFork: "Is a fork",
                hasReadme: "No README",
                hasLanguages: "No languages detected",
              };
              return checkNames[check as keyof typeof checkNames];
            });
          console.log(chalk.gray(`   Reasons: ${failedChecks.join(", ")}`));
        }

        return isQualityRepo;
      });

      // If specific repo requested, filter further
      const targetRepos =
        options.repo ?
          qualityRepos.filter((repo) =>
            repo.name.toLowerCase().includes(options.repo!.toLowerCase()),
          )
        : qualityRepos;

      if (targetRepos.length === 0) {
        console.log(
          chalk.yellow(
            "⚠️  No high-quality repositories found matching criteria",
          ),
        );

        if (options.repo) {
          console.log(
            chalk.cyan(
              `\n💡 Try searching for "${options.repo}" with different criteria`,
            ),
          );
        } else {
          console.log(chalk.cyan("\n💡 Consider lowering thresholds:"));
          console.log(
            chalk.white("   --min-commits 5  # Reduce commit requirement"),
          );
          console.log(
            chalk.white("   --min-size 20    # Reduce size requirement"),
          );
          console.log(chalk.white("   --min-days 90    # Include older repos"));
        }
        return;
      }

      console.log(
        chalk.green(
          `\n✅ Found ${targetRepos.length} high-quality repositories`,
        ),
      );
      console.log(chalk.gray("─".repeat(60)));

      // Show repositories being analyzed
      console.log(chalk.bold.cyan("📊 Analyzing Repositories:"));
      targetRepos.forEach((repo, index) => {
        console.log(chalk.white(`\n${index + 1}. ${chalk.bold(repo.name)}`));
        console.log(
          chalk.gray(`   📝 ${repo.description || "No description"}`),
        );
        console.log(
          chalk.cyan(
            `   📊 ⭐${repo.stars} stars | 🍴${repo.forks} forks | ${repo.languages.length} languages`,
          ),
        );
        console.log(
          chalk.white(
            `   🛠️  ${repo.languages.slice(0, 4).join(", ") || "No languages"}`,
          ),
        );
        console.log(
          chalk.dim(`   📅 Updated: ${repo.updatedAt.toLocaleDateString()}`),
        );
      });

      console.log(chalk.gray("\n" + "─".repeat(60)));

      if (options.dryRun) {
        console.log(chalk.yellow("🔍 DRY RUN - Not updating master resume"));
      }

      // Extract skills from quality repositories using existing service
      console.log(chalk.bold.cyan("\n🧠 Extracting Skills..."));

      // Get all skills but filter to only include our quality repos
      const allReposSkills = await gitHubSkillsService.extractSkills();
      const qualityRepoNames = new Set(targetRepos.map((repo) => repo.name));

      const filteredSkills = allReposSkills.filter((skill) =>
        skill.repositories.some((repo) => qualityRepoNames.has(repo)),
      );

      const repoSkills = new Map<string, GitHubSkill[]>();

      // Group skills by repository for display
      filteredSkills.forEach((skill) => {
        skill.repositories.forEach((repoName) => {
          if (qualityRepoNames.has(repoName)) {
            if (!repoSkills.has(repoName)) {
              repoSkills.set(repoName, []);
            }
            repoSkills.get(repoName)!.push(skill);
          }
        });
      });

      // Display skills per repository
      for (const [repoName, skills] of repoSkills) {
        console.log(chalk.white(`\n📋 Analyzing ${repoName}...`));

        if (skills.length > 0) {
          console.log(chalk.green(`   ✅ Found ${skills.length} skills`));

          // Show top skills for this repo
          const topSkills = skills
            .sort(
              (a: GitHubSkill, b: GitHubSkill) => b.confidence - a.confidence,
            )
            .slice(0, 5);

          console.log(chalk.white("   Top skills:"));
          topSkills.forEach((skill: GitHubSkill) => {
            const confidenceColor =
              skill.confidence >= 0.8 ? chalk.green
              : skill.confidence >= 0.6 ? chalk.yellow
              : chalk.red;
            console.log(
              chalk.gray(
                `     • ${skill.name} (${confidenceColor(`${(skill.confidence * 100).toFixed(0)}%`)})`,
              ),
            );
          });
        } else {
          console.log(chalk.yellow(`   ⚠️  No skills extracted`));
        }
      }

      // Aggregate and deduplicate skills
      const aggregatedSkills = aggregateSkills(filteredSkills);

      console.log(chalk.bold.cyan(`\n📈 Skill Extraction Summary:`));
      console.log(
        chalk.white(`   • Repositories analyzed: ${targetRepos.length}`),
      );
      console.log(
        chalk.white(`   • Total skills found: ${filteredSkills.length}`),
      );
      console.log(
        chalk.white(`   • Unique skills: ${aggregatedSkills.length}`),
      );

      // Show skills by confidence level
      const highConfidence = aggregatedSkills.filter(
        (s: any) => s.confidence >= 0.8,
      );
      const mediumConfidence = aggregatedSkills.filter(
        (s: any) => s.confidence >= 0.6 && s.confidence < 0.8,
      );
      const lowConfidenceResult = aggregatedSkills.filter(
        (s: any) => s.confidence < 0.6,
      );

      console.log(chalk.bold.cyan("\n📊 Skills by Confidence:"));
      console.log(
        chalk.green(`   • High confidence (80%+): ${highConfidence.length}`),
      );
      console.log(
        chalk.yellow(
          `   • Medium confidence (60-79%): ${mediumConfidence.length}`,
        ),
      );
      console.log(
        chalk.red(`   • Low confidence (<60%): ${lowConfidenceResult.length}`),
      );

      // Show top skills overall
      console.log(chalk.bold.cyan("\n🏆 Top Skills (High Confidence):"));
      const topOverallSkillsResult = aggregatedSkills
        .filter((s: any) => s.confidence >= 0.7)
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .slice(0, 15);

      if (topOverallSkillsResult.length > 0) {
        topOverallSkillsResult.forEach((skill: any, index: number) => {
          const confidenceColor =
            skill.confidence >= 0.8 ? chalk.green : chalk.yellow;
          const repoCount = skill.repositories.length;
          console.log(
            chalk.white(
              `${(index + 1).toString().padStart(2)}. ${skill.name.padEnd(25)} ${confidenceColor(` ${(skill.confidence * 100).toFixed(0)}%`)} ${chalk.gray(`(${repoCount} repos)`)}`,
            ),
          );
        });
      }

      // Categorize skills
      const categorizedSkills = categorizeSkills(aggregatedSkills);
      console.log(chalk.bold.cyan("\n📂 Skills by Category:"));
      Object.entries(categorizedSkills).forEach(([category, skills]) => {
        if (skills.length > 0) {
          console.log(
            chalk.white(`\n${chalk.bold(category)} (${skills.length}):`),
          );
          skills.slice(0, 8).forEach((skill: string) => {
            console.log(chalk.gray(`   • ${skill}`));
          });
          if (skills.length > 8) {
            console.log(chalk.gray(`   ... and ${skills.length - 8} more`));
          }
        }
      });

      // Store recommendations data
      const lowConfidenceFinal = lowConfidenceResult;
      const topOverallSkillsFinal = topOverallSkillsResult;

      // Update master resume if not dry run
      if (!options.dryRun) {
        console.log(chalk.bold.cyan("\n💾 Updating Master Resume..."));

        try {
          const result = await gitHubSkillsService.syncToMasterResume();

          console.log(chalk.green("✅ Master resume updated successfully!"));
          console.log(chalk.white(`   • New skills added: ${result.added}`));
          console.log(
            chalk.white(`   • Existing skills updated: ${result.updated}`),
          );
          console.log(
            chalk.white(`   • Total skills processed: ${result.total}`),
          );
        } catch (error) {
          console.log(chalk.red("❌ Failed to update master resume:"));
          console.log(
            chalk.white(
              error instanceof Error ? error.message : "Unknown error",
            ),
          );
        }
      } else {
        console.log(chalk.yellow("\n🔍 DRY RUN COMPLETE - No changes made"));
        console.log(
          chalk.cyan("💡 Run without --dry-run to update your master resume"),
        );
      }

      // Recommendations
      console.log(chalk.bold.cyan("\n💡 Recommendations:"));
      if (lowConfidenceFinal.length > aggregatedSkills.length * 0.3) {
        console.log(
          chalk.yellow(
            "   • Consider lowering quality thresholds to get more reliable skills",
          ),
        );
      }
      if (highConfidence.length < 5) {
        console.log(
          chalk.yellow(
            "   • You may need more substantial projects for better skill extraction",
          ),
        );
      }
      if (topOverallSkillsFinal.length > 0) {
        console.log(
          chalk.green(
            `   • Focus on your top ${Math.min(5, topOverallSkillsFinal.length)} skills for job applications`,
          ),
        );
      }
    } catch (error) {
      console.log(chalk.red("❌ Skill extraction failed:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Skill extraction failed", error);
    }
  });

// Helper function to aggregate skills
function aggregateSkills(skills: GitHubSkill[]): GitHubSkill[] {
  const skillMap = new Map<string, GitHubSkill>();

  skills.forEach((skill) => {
    const existing = skillMap.get(skill.name.toLowerCase());
    if (existing) {
      // Merge repositories and update confidence
      existing.repositories = [
        ...new Set([...existing.repositories, ...skill.repositories]),
      ];
      existing.confidence = Math.max(existing.confidence, skill.confidence);
      // Count occurrences
      (existing as any).occurrences = ((existing as any).occurrences || 1) + 1;
    } else {
      skillMap.set(skill.name.toLowerCase(), {
        ...skill,
        occurrences: 1,
      } as any);
    }
  });

  return Array.from(skillMap.values()).sort(
    (a, b) => b.confidence - a.confidence,
  );
}

// Helper function to categorize skills
function categorizeSkills(skills: GitHubSkill[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    Frontend: [],
    Backend: [],
    Database: [],
    "Cloud/DevOps": [],
    Languages: [],
    "Tools/Other": [],
  };

  skills.forEach((skill) => {
    const name = skill.name.toLowerCase();

    if (
      [
        "react",
        "vue",
        "angular",
        "next.js",
        "tailwind",
        "css",
        "html",
        "sass",
        "webpack",
        "vite",
      ].some((t) => name.includes(t))
    ) {
      categories["Frontend"].push(skill.name);
    } else if (
      [
        "node",
        "express",
        "django",
        "flask",
        "rails",
        "laravel",
        "api",
        "rest",
        "graphql",
      ].some((t) => name.includes(t))
    ) {
      categories["Backend"].push(skill.name);
    } else if (
      ["sql", "postgresql", "mysql", "mongodb", "redis", "database"].some((t) =>
        name.includes(t),
      )
    ) {
      categories["Database"].push(skill.name);
    } else if (
      [
        "aws",
        "azure",
        "gcp",
        "docker",
        "kubernetes",
        "terraform",
        "cloud",
        "devops",
      ].some((t) => name.includes(t))
    ) {
      categories["Cloud/DevOps"].push(skill.name);
    } else if (
      [
        "javascript",
        "typescript",
        "python",
        "java",
        "go",
        "rust",
        "php",
        "ruby",
      ].some((t) => name.includes(t))
    ) {
      categories["Languages"].push(skill.name);
    } else {
      categories["Tools/Other"].push(skill.name);
    }
  });

  return categories;
}

githubCommand.addCommand(extractSkillsCommand);
