// src/cli/commands/apply.ts
import { Command } from "commander";
import chalk from "chalk";
import { logger } from "@/utils/logger";

export const applyCommand = new Command("apply")
  .description("Apply for a job (full workflow)")
  .argument("[job-url]", "URL of the job posting")
  .action(async (jobUrl?: string) => {
    logger.header("Job Application Workflow");

    if (!jobUrl) {
      const inquirer = (await import("inquirer")).default;
      const { url } = await inquirer.prompt([
        {
          type: "input",
          name: "url",
          message: "Enter job posting URL:",
          validate: (input) => {
            if (!input) return "URL is required";
            if (!input.startsWith("http"))
              return "URL must start with http:// or https://";
            return true;
          },
        },
      ]);
      jobUrl = url;
    }

    logger.info("Apply command - Coming in Week 8");
    console.log(
      chalk.yellow(
        "This feature will be implemented in Phase 8 (Orchestration)",
      ),
    );
    console.log(chalk.gray(`\nJob URL provided: ${jobUrl}`));
  });
