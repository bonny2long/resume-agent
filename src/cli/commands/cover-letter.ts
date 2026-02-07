// src/cli/commands/cover-letter.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import {
  getCoverLetterAgent,
  CoverLetterOptions,
} from "@/agents/cover-letter-generator";
import { getDocumentGenerator } from "@/services/document-generator.service";
import getPrismaClient from "@/database/client";

export const coverLetterCommand = new Command("cover-letter")
  .description("Generate a tailored cover letter for a specific job")
  .argument("[job-id]", "ID of the analyzed job")
  .option(
    "--tone <tone>",
    "Tone of the cover letter (professional|enthusiastic|friendly)",
    "professional",
  )
  .option("--no-story", "Exclude career transition story")
  .option("--format <format>", "Output format (docx|pdf)", "docx")
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
          console.log(chalk.cyan("\n💡 Analyze a job first:"));
          console.log(chalk.white("   npm run dev analyze <job-url> --save"));
          return;
        }

        console.log(chalk.bold.cyan("\n📋 Recent Analyzed Jobs:\n"));
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

      // Validate tone
      const validTones = ["professional", "enthusiastic", "friendly"];
      const tone = options?.tone?.toLowerCase() || "professional";
      if (!validTones.includes(tone)) {
        console.log(chalk.yellow(`\n⚠️  Invalid tone: ${options.tone}`));
        console.log(chalk.gray(`   Valid options: ${validTones.join(", ")}`));
        return;
      }

      logger.header("Cover Letter Generator");
      console.log(
        chalk.cyan("💼 Generating cover letter for job:"),
        chalk.white(jobId),
      );
      console.log(chalk.gray(`   Tone: ${tone}`));
      console.log(chalk.gray(`   Include story: ${options.story !== false}`));
      console.log();

      // Step 1: Generate cover letter content
      const generateSpinner = ora("Generating cover letter with AI...").start();

      const coverLetterAgent = getCoverLetterAgent();
      const coverLetterOptions: CoverLetterOptions = {
        tone: tone as "professional" | "enthusiastic" | "friendly",
        includeCareerStory: options.story !== false,
        maxParagraphs: 4,
      };

      const result = await coverLetterAgent.generateCoverLetter(
        jobId!,
        coverLetterOptions,
      );

      if (!result.success || !result.data) {
        generateSpinner.fail("Failed to generate cover letter");
        console.log(chalk.red("\n✗ Error: " + result.error));
        return;
      }

      generateSpinner.succeed("Cover letter content generated!");

      const coverLetter = result.data;

      // Display preview
      console.log();
      logger.section("Cover Letter Preview");
      console.log(chalk.white(`  ${coverLetter.yourName}`));
      console.log(
        chalk.gray(`  ${coverLetter.yourEmail} | ${coverLetter.yourPhone}`),
      );
      console.log(chalk.gray(`  ${coverLetter.date}`));
      console.log();
      console.log(chalk.white(`  ${coverLetter.companyName}`));
      console.log();
      console.log(chalk.white(`  ${coverLetter.greeting}`));
      console.log();
      console.log(chalk.gray(`  ${coverLetter.opening.substring(0, 100)}...`));
      console.log(chalk.gray(`  [${coverLetter.body.length} body paragraphs]`));
      console.log();

      // Step 2: Generate DOCX
      const docSpinner = ora(
        `Generating ${options.format.toUpperCase()}...`,
      ).start();

      const docGenerator = getDocumentGenerator();
      const docResult = await docGenerator.generateCoverLetter(coverLetter, {
        format: options.format,
      });

      if (!docResult.success || !docResult.filepath) {
        docSpinner.fail("Document generation failed");
        console.log(chalk.red("\n✗ Error: " + docResult.error));
        return;
      }

      docSpinner.succeed("Document generated!");

      // Display results
      console.log();
      logger.section("Generated Document");

      const filename = require("path").basename(docResult.filepath);
      const filesize = require("fs").statSync(docResult.filepath).size;
      const filesizeKB = (filesize / 1024).toFixed(1);

      console.log(chalk.white(`  📄 ${filename}`));
      console.log(chalk.gray(`  📏 Size: ${filesizeKB} KB`));
      console.log(chalk.gray(`  📍 Path: ${docResult.filepath}`));
      console.log();

      // Summary
      logger.box(`
Cover Letter Generated! ✓

Job: ${coverLetter.jobTitle} at ${coverLetter.companyName}
Tone: ${coverLetter.tone}
File: ${filename}

The cover letter is ready to:
  • Email to recruiters
  • Upload with job application
  • Customize further in Word

Next steps:
  • Generate resume: npm run dev generate ${jobId}
  • Apply to job: npm run dev apply ${jobId}
      `);
    } catch (error: any) {
      logger.error("Cover letter generation failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));

      if (error.message.includes("Job not found")) {
        console.log(chalk.yellow("\n💡 Make sure the job is analyzed first:"));
        console.log(chalk.white(`   npm run dev analyze <job-url> --save`));
      }
    }
  });
