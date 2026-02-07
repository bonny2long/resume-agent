// src/cli/commands/generate.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import { getResumeTailorAgent } from "@/agents/resume-tailor.agent";
import { getDocumentGenerator } from "@/services/document-generator.service";
import getPrismaClient from "@/database/client";
import path from "path";

export const generateCommand = new Command("generate")
  .description("Generate resume document (PDF or DOCX)")
  .argument("[job-id]", "ID of the job to generate resume for")
  .option("--format <format>", "Output format (docx|pdf)", "docx")
  .option(
    "--template <template>",
    "Template style (modern|traditional|minimal)",
    "modern",
  )
  .action(async (jobId?: string, options?: any) => {
    try {
      const prisma = getPrismaClient();

      // If no job ID provided, show recent jobs
      if (!jobId) {
        const recentJobs = await prisma.job.findMany({
          include: { company: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        if (recentJobs.length === 0) {
          console.log(chalk.yellow("\n⚠️  No analyzed jobs found"));
          console.log(chalk.cyan("\n💡 First analyze a job:"));
          console.log(chalk.white("   npm run dev analyze <job-url> --save"));
          return;
        }

        console.log(chalk.bold.cyan("\n📋 Select a job:\n"));
        recentJobs.forEach((job, index) => {
          console.log(
            chalk.white(
              `${index + 1}. ${job.title} at ${job.company?.name || "Unknown"}`,
            ),
          );
          console.log(chalk.gray(`   ID: ${job.id}`));
          console.log(chalk.gray(`   Match: ${job.skillsMatch || "N/A"}%`));
          console.log();
        });

        const { selectedJobId } = await inquirer.prompt([
          {
            type: "input",
            name: "selectedJobId",
            message: "Enter job ID:",
            validate: (input) => {
              if (!input) return "Job ID is required";
              return true;
            },
          },
        ]);

        jobId = selectedJobId;
      }

      logger.header("Resume Generator");
      console.log(
        chalk.cyan("📄 Generating resume for job:"),
        chalk.white(jobId),
      );
      console.log(chalk.gray(`   Format: ${options.format.toUpperCase()}`));
      console.log(chalk.gray(`   Template: ${options.template}`));
      console.log();

      // Step 1: Get or generate tailored resume
      const tailorSpinner = ora("Loading tailored resume...").start();

      const tailorAgent = getResumeTailorAgent();
      const tailorResult = await tailorAgent.tailorResume(jobId!);

      if (!tailorResult.success || !tailorResult.data) {
        tailorSpinner.fail("Failed to load resume");
        console.log(chalk.red("\n✗ Error: " + tailorResult.error));
        console.log(chalk.yellow("\n💡 First tailor the resume:"));
        console.log(chalk.white(`   npm run dev tailor ${jobId}`));
        return;
      }

      tailorSpinner.succeed("Resume data loaded");

      const tailored = tailorResult.data;

      // Step 2: Generate document
      const generateSpinner = ora(
        `Generating ${options.format.toUpperCase()}...`,
      ).start();

      const docGenerator = getDocumentGenerator();
      const result = await docGenerator.generateResume(tailored, {
        format: options.format,
        template: options.template,
      });

      if (!result.success || !result.filepath) {
        generateSpinner.fail("Document generation failed");
        console.log(chalk.red("\n✗ Error: " + result.error));
        return;
      }

      generateSpinner.succeed("Document generated!");

      // Display results
      console.log();
      logger.section("Generated Document");

      const filename = path.basename(result.filepath);
      const filesize = require("fs").statSync(result.filepath).size;
      const filesizeKB = (filesize / 1024).toFixed(1);

      console.log(chalk.white(`  📄 ${filename}`));
      console.log(chalk.gray(`  📏 Size: ${filesizeKB} KB`));
      console.log(chalk.gray(`  📍 Path: ${result.filepath}`));
      console.log();

      // Show document stats
      logger.section("Document Contents");
      console.log(chalk.white(`  Name: ${tailored.personalInfo.fullName}`));
      console.log(
        chalk.white(`  Job: ${tailored.jobTitle} at ${tailored.company}`),
      );
      console.log(chalk.white(`  Match Score: ${tailored.matchScore}%`));
      console.log();
      console.log(chalk.gray(`  • ${tailored.experiences.length} experiences`));
      console.log(chalk.gray(`  • ${tailored.projects.length} projects`));
      console.log(
        chalk.gray(`  • ${tailored.skills.matched.length} matched skills`),
      );
      console.log(
        chalk.gray(`  • ${tailored.education.length} education entries`),
      );
      console.log();

      // Next steps
      logger.section("File Location");
      console.log(chalk.cyan(`  ${result.filepath}`));
      console.log();

      logger.box(`
Resume Generated! ✓

Format: ${options.format.toUpperCase()}
Template: ${options.template}
File: ${filename}

The resume is ready to:
  • Upload to job applications
  • Email to recruiters
  • Customize further in Word

Next steps:
  • Generate cover letter: npm run dev cover-letter ${jobId}
  • Apply to job: npm run dev apply ${jobId}
  • Try different template: npm run dev generate ${jobId} --template traditional
      `);
    } catch (error: any) {
      logger.error("Generation failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));

      if (error.message.includes("Cannot find module 'docx'")) {
        console.log(chalk.yellow("\n💡 Install required packages:"));
        console.log(chalk.white("   npm install docx"));
      }
    }
  });
