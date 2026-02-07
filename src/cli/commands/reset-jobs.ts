// src/cli/commands/reset-jobs.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { getJobRepository } from "@/database/repositories/job.repository";
import { logger } from "@/utils/logger";

export const resetJobsCommand = new Command("reset-jobs")
  .description("Delete all saved jobs and companies")
  .option("--force", "Skip confirmation prompt", false)
  .action(async (options?: { force?: boolean }) => {
    try {
      if (!options?.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message:
              "⚠️  This will delete ALL saved jobs and companies. Are you sure?",
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow("Operation cancelled."));
          return;
        }
      }

      logger.header("Resetting Jobs Database");

      const spinner = ora("Deleting all jobs and companies...").start();

      const jobRepo = getJobRepository();
      await jobRepo.deleteAllJobs();

      spinner.succeed("Database reset complete!");

      console.log(chalk.green("✓ All jobs and companies have been deleted"));
      console.log(chalk.gray("Your master resume and skills are preserved"));
    } catch (error: any) {
      logger.error("Reset failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });
