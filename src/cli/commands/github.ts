// src/cli/commands/github.ts
import { Command } from "commander";
import chalk from "chalk";
import { logger } from "@/utils/logger";
import { githubService } from "@/services/github.service";

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
      const allRepos = options.featured
        ? repos
        : await githubService.getRepositories();
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
      console.log(chalk.bold.cyan(`📄 Repository: ${name}`));
      console.log(chalk.gray("─".repeat(50)));

      const repo = await githubService.getRepositoryByName(name);

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
