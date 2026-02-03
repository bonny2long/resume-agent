// src/cli/commands/research.ts
import { Command } from "commander";
import chalk from "chalk";
import { logger } from "@/utils/logger";

export const researchCommand = new Command("research")
  .description("Research a company")
  .argument("[company-name]", "Name of the company to research")
  .action(async (companyName?: string) => {
    logger.header("Company Research");

    if (!companyName) {
      console.log(chalk.yellow("Please provide a company name"));
      console.log(chalk.gray("Usage: resume-agent research <company-name>"));
      return;
    }

    logger.info("Research command - Coming in Week 3");
    console.log(chalk.yellow("This feature will be implemented in Phase 3"));
    console.log(chalk.gray(`\nCompany: ${companyName}`));

    console.log(chalk.gray("\nThis will research:"));
    console.log(chalk.gray("  • Company info & culture"));
    console.log(chalk.gray("  • Tech stack"));
    console.log(chalk.gray("  • Recent news"));
    console.log(chalk.gray("  • Key people"));
  });
