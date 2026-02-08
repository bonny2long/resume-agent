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
import { uploadCommand } from "./commands/upload";
import { analyzeCommand } from "./commands/analyze";
import { tailorCommand } from "./commands/tailor";
import { jobsCommand } from "./commands/jobs";
import { githubCommand } from "./commands/github";
import { listCommand } from "./commands/list";
import { generateCommand } from "./commands/generate"; // ← PHASE 3: Document generation
import { coverLetterCommand } from "./commands/cover-letter"; // ← PHASE 4: Cover letters
import { findManagerCommand } from "./commands/find-manager"; // ← PHASE 5: Hiring manager finder
import { linkedInMessageCommand } from "./commands/linkedin-message"; // ← PHASE 5: LinkedIn messages

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
    program.addCommand(uploadCommand);
    program.addCommand(analyzeCommand);
    program.addCommand(jobsCommand);
    program.addCommand(tailorCommand);
    program.addCommand(generateCommand); // ← PHASE 3: Generate DOCX/PDF
    program.addCommand(coverLetterCommand); // ← PHASE 4: Cover letters
    program.addCommand(findManagerCommand); // ← PHASE 5: Hiring manager finder
    program.addCommand(linkedInMessageCommand); // ← PHASE 5: LinkedIn messages
    program.addCommand(applyCommand);
    program.addCommand(statusCommand);
    program.addCommand(researchCommand);
    program.addCommand(creditsCommand);
    program.addCommand(githubCommand);
    program.addCommand(listCommand);

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
