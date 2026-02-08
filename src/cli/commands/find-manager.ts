// src/cli/commands/find-manager.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import { getHiringManagerFinderAgent } from "@/agents/hiring-manager-finder";
import getPrismaClient from "@/database/client";

export const findManagerCommand = new Command("find-manager")
  .description("Find hiring manager for a specific job")
  .argument("[job-id]", "ID of the analyzed job")
  .option("--save", "Save top candidate to database", false)
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

      logger.header("Hiring Manager Finder");
      console.log(
        chalk.cyan("🔍 Searching for hiring manager:"),
        chalk.white(jobId),
      );
      console.log();

      // Search for hiring manager
      const searchSpinner = ora("Searching multiple sources...").start();

      const finder = getHiringManagerFinderAgent();
      const result = await finder.findHiringManager(jobId!);

      if (!result.success || !result.data) {
        searchSpinner.fail("Search failed");
        console.log(chalk.red("\n✗ Error: " + result.error));
        return;
      }

      searchSpinner.succeed("Search complete!");

      const { managers, topMatch, searchMethod } = result.data;

      // Display results
      console.log();
      logger.section("Search Results");
      console.log(chalk.gray(`  Searched: ${searchMethod}`));
      console.log(chalk.gray(`  Found: ${managers.length} candidates`));
      console.log();

      if (managers.length === 0) {
        console.log(chalk.yellow("  No hiring managers found"));
        console.log();
        console.log(chalk.cyan("  💡 Try:"));
        console.log(chalk.white("     • Search LinkedIn manually"));
        console.log(
          chalk.white("     • Check company website /about or /team pages"),
        );
        console.log(chalk.white("     • Look at job posting for contact info"));
        return;
      }

      // Display top candidate
      if (topMatch) {
        console.log(chalk.bold.white("  🎯 Top Candidate:"));
        console.log();
        console.log(chalk.white(`     ${topMatch.name}`));
        if (topMatch.title) {
          console.log(chalk.gray(`     ${topMatch.title}`));
        }
        console.log(chalk.cyan(`     Confidence: ${topMatch.confidence}%`));
        console.log(chalk.gray(`     Source: ${topMatch.source}`));
        console.log();

        if (topMatch.linkedInUrl) {
          console.log(chalk.blue(`     LinkedIn: ${topMatch.linkedInUrl}`));
        }
        if (topMatch.email) {
          console.log(chalk.blue(`     Email: ${topMatch.email}`));
        }
        if (topMatch.phone) {
          console.log(chalk.blue(`     Phone: ${topMatch.phone}`));
        }
        if (topMatch.profileSummary) {
          console.log(chalk.gray(`     Notes: ${topMatch.profileSummary}`));
        }
        console.log();
      }

      // Show all candidates
      if (managers.length > 1) {
        console.log(chalk.bold.white("  📋 All Candidates:"));
        console.log();

        managers.forEach((candidate: any, index: number) => {
          console.log(chalk.white(`   ${index + 1}. ${candidate.name}`));
          if (candidate.title) {
            console.log(chalk.gray(`      ${candidate.title}`));
          }
          console.log(
            chalk.cyan(`      ${candidate.confidence}% (${candidate.source})`),
          );
          console.log();
        });
      }

      // Save to database if requested
      if (options.save) {
        const saveSpinner = ora("Saving to database...").start();

        try {
          // Create hiring manager in database
          if (!topMatch) {
            throw new Error("No hiring manager to save");
          }

          await prisma.hiringManager.create({
            data: {
              jobId: jobId!,
              name: topMatch.name,
              title: topMatch.title,
              linkedInUrl: topMatch.linkedInUrl,
              email: topMatch.email,
              phone: topMatch.phone,
              confidence: topMatch.confidence,
              sources: [topMatch.source],
              verified: topMatch.verified,
            },
          });

          saveSpinner.succeed("Saved to database");
          console.log();
          console.log(chalk.green("✓ Hiring manager saved to database"));
        } catch (error: any) {
          saveSpinner.fail("Failed to save");
          console.log(chalk.red("✗ Error: " + error.message));
        }
      }

      // Next steps
      console.log();
      logger.box(`
Hiring Manager Found! ✓

Top Candidate: ${topMatch?.name || "None"}
Confidence: ${topMatch?.confidence || 0}%

Next steps:
  • Send LinkedIn connection request
  • Generate message: npm run dev linkedin-message ${jobId}
  • Research their background on LinkedIn
  • Prepare for potential conversation

${topMatch?.linkedInUrl ? `LinkedIn Profile:\n  ${topMatch.linkedInUrl}` : ""}
      `);
    } catch (error: any) {
      logger.error("Hiring manager search failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });
