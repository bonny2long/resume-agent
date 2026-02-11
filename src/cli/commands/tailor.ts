// src/cli/commands/tailor.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import { getResumeTailorAgent } from "@/agents/resume-tailor.agent";
import { getEmbeddingsService } from "@/services/embeddings.service";
import getPrismaClient from "@/database/client";
import fs from "fs";
import path from "path";

export const tailorCommand = new Command("tailor")
  .description("Generate a tailored resume for a specific job")
  .argument("[job-id]", "ID of the analyzed job")
  .option("--generate-embeddings", "Generate embeddings first", false)
  .option("--format <format>", "Output format (json|text)", "text")
  .action(async (jobId?: string, options?: any) => {
    try {
      // If no job ID provided, show recent jobs
      if (!jobId) {
        const prisma = getPrismaClient();
        const recentJobs = await prisma.job.findMany({
          include: { company: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        if (recentJobs.length === 0) {
          console.log(chalk.yellow("⚠️  No analyzed jobs found"));
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

      logger.header("Resume Tailor");
      console.log(
        chalk.cyan("🎯 Tailoring resume for job:"),
        chalk.white(jobId),
      );
      console.log();

      // Step 1: Generate embeddings if requested
      if (options?.generateEmbeddings) {
        const embeddingsSpinner = ora("Generating embeddings...").start();

        try {
          const embeddings = getEmbeddingsService();
          await embeddings.generateAllExperienceEmbeddings();
          await embeddings.generateAllProjectEmbeddings();

          embeddingsSpinner.succeed(
            `Generated embeddings for all experiences and projects`,
          );
        } catch (error) {
          embeddingsSpinner.fail("Failed to generate embeddings");
          logger.error("Embeddings error", error);
        }
      }

      // Step 2: Tailor the resume
      const tailorSpinner = ora("Tailoring resume...").start();
      const tailorAgent = getResumeTailorAgent();

      // Ensure jobId is treated as string since we validated it above
      const result = await tailorAgent.tailorResume(jobId!);

      if (!result.success || !result.data) {
        tailorSpinner.fail("Failed to tailor resume");
        console.log(chalk.red("\n✗ Error: " + result.error));
        return;
      }

      tailorSpinner.succeed("Resume tailored successfully!");

      const tailored = result.data;

      // Display results
      console.log();
      logger.section("Tailored Resume");
      console.log(chalk.bold(`  ${tailored.personalInfo.fullName}`));
      console.log(
        chalk.gray(
          `  ${tailored.personalInfo.email} • ${tailored.personalInfo.phone}`,
        ),
      );
      console.log(chalk.gray(`  ${tailored.personalInfo.location}`));
      console.log();

      logger.section("Professional Summary");
      console.log(chalk.white(`  ${tailored.summary}`));
      console.log();

      logger.section("Selected Experiences");
      tailored.experiences.forEach((exp, index) => {
        console.log(
          chalk.white(
            `  ${index + 1}. ${exp.title} at ${exp.company} (Relevance: ${exp.relevanceScore}%)`,
          ),
        );
        console.log(
          chalk.gray(
            `    ${exp.startDate.getFullYear()} - ${exp.current ? "Present" : exp.endDate?.getFullYear()}`,
          ),
        );
        exp.achievements.slice(0, 2).forEach((ach) => {
          console.log(
            chalk.gray(`    • ${ach.description.substring(0, 60)}...`),
          );
        });
        // Only show Tech section if there are actual technologies
        if (exp.technologies && exp.technologies.length > 0) {
          console.log(
            chalk.cyan(`    Tech: ${exp.technologies.slice(0, 5).join(", ")}`),
          );
        }
        console.log();
      });

      logger.section("Selected Projects");
      tailored.projects.forEach((proj, index) => {
        console.log(
          chalk.white(
            `  ${index + 1}. ${proj.name} (Relevance: ${proj.relevanceScore}%)`,
          ),
        );
        console.log(chalk.gray(`    ${proj.description.substring(0, 60)}...`));
        // Only show Tech section if there are actual technologies
        if (proj.technologies && proj.technologies.length > 0) {
          console.log(
            chalk.cyan(`    Tech: ${proj.technologies.slice(0, 5).join(", ")}`),
          );
        }
        console.log();
      });

      logger.section("Skills (Optimized)");
      if (tailored.skills.matched.length > 0) {
        console.log(
          chalk.green(
            `  ✓ Matched: ${tailored.skills.matched.slice(0, 10).join(", ")}`,
          ),
        );
      }
      if (tailored.skills.relevant.length > 0) {
        console.log(
          chalk.blue(
            `  ⭐ Relevant: ${tailored.skills.relevant.slice(0, 10).join(", ")}`,
          ),
        );
      }
      console.log();

      // Calculate ATS score
      logger.section("ATS Analysis");
      const prisma = getPrismaClient();
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (job) {
        const atsAnalysis = tailorAgent.calculateATSScore(tailored, job);
        tailored.atsScore = atsAnalysis.score; // Assign score to object

        const scoreColor =
          atsAnalysis.score >= 80 ? chalk.green
          : atsAnalysis.score >= 60 ? chalk.yellow
          : chalk.red;

        console.log(scoreColor(`  🎯 ATS Score: ${atsAnalysis.score}%`));
        console.log();
        console.log(chalk.gray("  Breakdown:"));
        console.log(
          chalk.gray(
            `    • Keyword Match: ${atsAnalysis.breakdown.keywordMatch}%`,
          ),
        );
        console.log(
          chalk.gray(`    • Skill Match: ${atsAnalysis.breakdown.skillMatch}%`),
        );
        console.log(
          chalk.gray(
            `    • Experience Relevance: ${atsAnalysis.breakdown.experienceMatch}%`,
          ),
        );
        console.log(
          chalk.gray(
            `    • Format Score: ${atsAnalysis.breakdown.formatScore}%`,
          ),
        );
      }

      // Save to file
      console.log();
      const saveSpinner = ora("Saving tailored resume...").start();

      try {
        const outputDir = path.join(process.cwd(), "data", "outputs");
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `resume_${job?.title?.toLowerCase().replace(/\s+/g, "-") || "tailored"}_${timestamp}.json`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(tailored, null, 2));

        saveSpinner.succeed(`Saved to ${filename}`);
      } catch (error) {
        saveSpinner.fail("Failed to save file");
        logger.error("Save error", error);
      }

      // Summary
      console.log();
      logger.box(`
Tailored Resume Complete! ✓

Job: ${job?.title || "Unknown Position"} at ${job?.company?.name || "Unknown Company"}
ATS Score: ${tailored.atsScore || "N/A"}%
Resume tailored successfully with ${tailored.experiences.length} experiences and ${tailored.projects.length} projects

Next steps:
  • Generate PDF: npm run dev generate ${jobId}
  • Create cover letter: npm run dev cover-letter ${jobId}
  • Apply: npm run dev apply ${job?.url || "<job-url>"}
      `);
    } catch (error: any) {
      logger.error("Tailoring failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));

      if (error.message.includes("OPENAI_API_KEY")) {
        console.log(
          chalk.yellow("\n💡 OpenAI API key is required for embeddings"),
        );
        console.log(chalk.gray("   Add OPENAI_API_KEY to your .env file"));
      }
    }
  });
