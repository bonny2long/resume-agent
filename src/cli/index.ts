#!/usr/bin/env node
// src/cli/index.ts

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "@/utils/logger";
import { validateConfig } from "@/config";
import { connectDatabase } from "@/database/client";

// Import commands
import { initCommand } from "./commands/init";
import { resumeCommand } from "./commands/resume";
import { applyCommand } from "./commands/apply";
import { statusCommand } from "./commands/status";
import { researchCommand } from "./commands/research";
import { creditsCommand } from "./commands/credits";

const program = new Command();

// ASCII Art Banner
const banner = `
  ╔══════════════════════════════════════════════════════════════════════╗
  ║                                                                      ║
  ║  ███╗   ███╗███████╗████████╗██╗███████╗██████╗  ██████╗  ████████╗  ║
  ║  ████╗ ████║██╔════╝╚══██╔══╝██║██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝   ║
  ║  ██╔████╔██║█████╗     ██║   ██║███████╗██████╔╝██║   ██║   ██║      ║
  ║  ██║╚██╔╝██║██╔══╝     ██║   ██║╚════██║██╔══██╗██║   ██║   ██║      ║
  ║  ██║ ╚═╝ ██║███████╗   ██║   ██║███████║██████╔╝╚██████╔╝   ██║      ║
  ║                                                                      ║
  ║            AI-Powered Resume & Application Agent                     ║
  ║                                                                      ║ 
  ╚══════════════════════════════════════════════════════════════════════╝
`;

async function main() {
  try {
    // Show banner
    console.log(chalk.cyan(banner));

    // Validate configuration
    validateConfig();

    // Connect to database
    await connectDatabase();

    // Setup CLI program
    program
      .name("resume-agent")
      .description("AI-powered resume tailoring and job application assistant")
      .version("1.0.0");

    // Register commands
    program.addCommand(initCommand);
    program.addCommand(resumeCommand);
    program.addCommand(applyCommand);
    program.addCommand(statusCommand);
    program.addCommand(researchCommand);
    program.addCommand(creditsCommand);

    // Global error handler
    program.exitOverride((err) => {
      if (err.code === "commander.help") {
        process.exit(0);
      }
      logger.error("Command failed", err);
      process.exit(1);
    });

    // Parse arguments
    await program.parseAsync(process.argv);
  } catch (error: any) {
    logger.error("Fatal error", error);
    console.error(chalk.red("\n❌ Application failed to start"));
    console.error(chalk.yellow("\nPossible issues:"));
    console.error(
      chalk.gray("  • Check your .env file exists and has required variables"),
    );
    console.error(chalk.gray("  • Ensure PostgreSQL is running"));
    console.error(chalk.gray("  • Verify API keys are valid"));
    console.error(chalk.gray("  • Run: npx prisma migrate dev\n"));
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", error);
  process.exit(1);
});

// Run the CLI
main();
