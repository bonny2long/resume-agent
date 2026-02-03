// src/cli/commands/init.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";

export const initCommand = new Command("init")
  .description("Initialize your master resume")
  .action(async () => {
    logger.header("Initialize Master Resume");
    console.log(
      chalk.gray(
        "Let's create your master resume. This will be used to generate tailored resumes.\n",
      ),
    );

    try {
      const prisma = getPrismaClient();

      // Check if resume already exists
      const existing = await prisma.masterResume.findFirst();

      if (existing) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message:
              "A master resume already exists. Do you want to create a new one?",
            default: false,
          },
        ]);

        if (!confirm) {
          logger.info("Initialization cancelled");
          return;
        }
      }

      // Personal Information
      logger.section("Personal Information");
      const personalInfo = await inquirer.prompt([
        {
          type: "input",
          name: "fullName",
          message: "Full Name:",
          validate: (input) => input.trim().length > 0 || "Name is required",
        },
        {
          type: "input",
          name: "email",
          message: "Email:",
          validate: (input) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input) || "Please enter a valid email";
          },
        },
        {
          type: "input",
          name: "phone",
          message: "Phone Number:",
          validate: (input) => input.trim().length > 0 || "Phone is required",
        },
        {
          type: "input",
          name: "location",
          message: "Location (e.g., San Francisco, CA):",
          validate: (input) =>
            input.trim().length > 0 || "Location is required",
        },
        {
          type: "input",
          name: "linkedInUrl",
          message: "LinkedIn URL (optional):",
        },
        {
          type: "input",
          name: "githubUrl",
          message: "GitHub URL (optional):",
        },
        {
          type: "input",
          name: "portfolioUrl",
          message: "Portfolio URL (optional):",
        },
      ]);

      // Professional Summary
      logger.section("Professional Summary");
      const summary = await inquirer.prompt([
        {
          type: "input",
          name: "summaryShort",
          message: "Short summary (2-3 sentences):",
          validate: (input) => input.trim().length > 0 || "Summary is required",
        },
        {
          type: "editor",
          name: "summaryLong",
          message: "Long summary (press Enter to open editor):",
          default: "",
        },
      ]);

      // Create master resume
      const spinner = ora("Creating master resume...").start();

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

      spinner.succeed("Master resume created!");

      // Display summary
      logger.box(`
Resume ID: ${resume.id}
Name: ${resume.fullName}
Email: ${resume.email}
Location: ${resume.location}

Next steps:
  1. Add your work experience: resume-agent resume add experience
  2. Add your projects: resume-agent resume add project
  3. Add your skills: resume-agent resume add skill
  4. View your resume: resume-agent resume list
      `);
    } catch (error) {
      logger.error("Failed to initialize resume", error);
      throw error;
    }
  });
