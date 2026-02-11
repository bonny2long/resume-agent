// src/cli/commands/init.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";

export const initCommand = new Command("init")
  .description("Initialize or overwrite your master resume")
  .option("--skip-data", "Skip data entry and just initialize database")
  .action(async (options) => {
    logger.header("Initialize Master Resume");

    try {
      const prisma = getPrismaClient();
      const existing = await prisma.masterResume.findFirst();

      if (existing && !options.skipData) {
        console.log(
          chalk.yellow(
            "⚠️  A master resume already exists. This will overwrite it.",
          ),
        );
        const { confirmOverwrite } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmOverwrite",
            message: "Are you sure you want to continue?",
            default: false,
          },
        ]);

        if (!confirmOverwrite) {
          logger.info("Initialization cancelled.");
          return;
        }
      }

      if (options.skipData) {
        console.log(
          chalk.gray(
            "\nSkipping data entry. Use 'upload' command to add your resume data.",
          ),
        );

        // If a resume exists, delete it for clean slate
        if (existing) {
          await prisma.masterResume.delete({ where: { id: existing.id } });
        }

        logger.box(`
Database initialized successfully! ✓

Next steps:
  1. Upload your resume: npm run dev -- upload <resume-file>
  2. Or add data manually: npm run dev -- init
        `);
        return;
      }

      console.log(
        chalk.gray(
          "\nLet's gather your information. This will be used to generate tailored resumes.",
        ),
      );

      // Personal Information
      logger.section("Personal Information");
      const personalInfo = await inquirer.prompt([
        {
          type: "input",
          name: "fullName",
          message: "Full Name:",
          default: existing?.fullName || "",
          validate: (input) => input.trim().length > 0 || "Name is required",
        },
        {
          type: "input",
          name: "email",
          message: "Email:",
          default: existing?.email || "",
          validate: (input) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input) || "Please enter a valid email";
          },
        },
        {
          type: "input",
          name: "phone",
          message: "Phone Number:",
          default: existing?.phone || "",
          validate: (input) => input.trim().length > 0 || "Phone is required",
        },
        {
          type: "input",
          name: "location",
          message: "Location (e.g., San Francisco, CA):",
          default: existing?.location || "",
          validate: (input) =>
            input.trim().length > 0 || "Location is required",
        },
        {
          type: "input",
          name: "linkedInUrl",
          message: "LinkedIn URL (optional):",
          default: existing?.linkedInUrl || "",
        },
        {
          type: "input",
          name: "githubUrl",
          message: "GitHub URL (optional):",
          default: existing?.githubUrl || "",
        },
        {
          type: "input",
          name: "portfolioUrl",
          message: "Portfolio URL (optional):",
          default: existing?.portfolioUrl || "",
        },
      ]);

      // Professional Summary
      logger.section("Professional Summary");
      const summary = await inquirer.prompt([
        {
          type: "editor",
          name: "summaryShort",
          message: "Short summary (2-3 sentences, press Enter for editor):",
          default: existing?.summaryShort || "",
          validate: (input) => input.trim().length > 0 || "Summary is required",
        },
        {
          type: "editor",
          name: "summaryLong",
          message: "Long summary (optional, press Enter for editor):",
          default: existing?.summaryLong || "",
        },
      ]);

      const spinner = ora("Saving master resume...").start();

      // If a resume exists, delete it to ensure a clean slate.
      // This is safer than updating and handles schema changes better.
      if (existing) {
        await prisma.masterResume.delete({ where: { id: existing.id } });
      }

      // Create new master resume
      const resume = await prisma.masterResume.create({
        data: {
          fullName: personalInfo.fullName.trim(),
          email: personalInfo.email.trim(),
          phone: personalInfo.phone.trim(),
          location: personalInfo.location.trim(),
          linkedInUrl: personalInfo.linkedInUrl?.trim() || null,
          githubUrl: personalInfo.githubUrl?.trim() || null,
          portfolioUrl: personalInfo.portfolioUrl?.trim() || null,
          summaryShort: summary.summaryShort.trim(),
          summaryLong:
            summary.summaryLong?.trim() || summary.summaryShort.trim(),
        },
      });

      spinner.succeed("Master resume saved successfully!");

      // Display summary
      logger.box(`
Resume ID: ${resume.id}
Name: ${resume.fullName}
Email: ${resume.email}
Location: ${resume.location}

Next steps:
  1. Add work experience: npm run dev -- resume add-exp
  2. Add projects: npm run dev -- resume add-project
  3. Add skills: npm run dev -- resume add-skill
  4. View your resume: npm run dev -- resume list
      `);
    } catch (error) {
      logger.error("Failed to initialize resume", error);
      // The original file had `throw error`, which is fine but can be noisy.
      // I'll just log it for a cleaner CLI experience.
      console.log(chalk.red("\n❌ An unexpected error occurred."));
      if (error instanceof Error) {
        console.log(chalk.red(`   ${error.message}`));
      }
    }
  });
