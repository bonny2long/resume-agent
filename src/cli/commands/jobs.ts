// src/cli/commands/jobs.ts
import { Command } from "commander";
import chalk from "chalk";

import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";

export const jobsCommand = new Command("jobs").description(
  "Manage analyzed jobs",
);

// List all jobs
jobsCommand
  .command("list")
  .description("List all analyzed jobs")
  .option("--limit <number>", "Number of jobs to show", "20")
  .option("--sort <field>", "Sort by field (match|date)", "date")
  .action(async (options) => {
    try {
      const prisma = getPrismaClient();
      const limit = parseInt(options.limit);

      // Determine sort order
      const orderBy =
        options.sort === "match" ?
          { skillsMatch: "desc" as const }
        : { createdAt: "desc" as const };

      const jobs = await prisma.job.findMany({
        include: {
          company: true,
        },
        orderBy,
        take: limit,
      });

      if (jobs.length === 0) {
        console.log(chalk.yellow("\n⚠️  No analyzed jobs found"));
        console.log(chalk.cyan("\n💡 To analyze a job:"));
        console.log(chalk.white("   npm run dev analyze <job-url> --save"));
        return;
      }

      console.log(chalk.bold.cyan(`\n📋 Analyzed Jobs (${jobs.length}):\n`));

      // Show jobs in a cleaner format (no table, easier to copy IDs)
      jobs.forEach((job, index) => {
        const matchColor =
          (job.skillsMatch || 0) >= 80 ? chalk.green
          : (job.skillsMatch || 0) >= 60 ? chalk.yellow
          : chalk.red;

        console.log(
          chalk.white(
            `${index + 1}. ${job.title} at ${job.company?.name || "Unknown"}`,
          ),
        );
        console.log(chalk.cyan(`   ID: ${job.id}`));
        console.log(
          chalk.gray(
            `   Level: ${job.experienceLevel || "N/A"} | Match: ${matchColor(`${job.skillsMatch || "N/A"}%`)} | Skills: ${job.requiredSkills.length} | ${new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          ),
        );
        console.log();
      });

      // Show summary stats
      const avgMatch =
        jobs.reduce((sum, job) => sum + (job.skillsMatch || 0), 0) /
        jobs.length;
      const highMatches = jobs.filter((j) => (j.skillsMatch || 0) >= 80).length;
      const mediumMatches = jobs.filter(
        (j) => (j.skillsMatch || 0) >= 60 && (j.skillsMatch || 0) < 80,
      ).length;

      console.log(chalk.bold.cyan("\n📊 Summary:"));
      console.log(chalk.white(`   Average Match: ${avgMatch.toFixed(1)}%`));
      console.log(chalk.green(`   High Matches (80%+): ${highMatches}`));
      console.log(chalk.yellow(`   Medium Matches (60-79%): ${mediumMatches}`));

      console.log(chalk.gray("\n💡 Commands:"));
      console.log(chalk.gray("   • View details: npm run dev jobs show <id>"));
      console.log(chalk.gray("   • Tailor resume: npm run dev tailor <id>"));
    } catch (error: any) {
      logger.error("Failed to list jobs", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });

// Show job details
jobsCommand
  .command("show <job-id>")
  .description("Show details of a specific job")
  .action(async (jobId: string) => {
    try {
      const prisma = getPrismaClient();

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          company: true,
          applications: true,
        },
      });

      if (!job) {
        console.log(chalk.red(`\n✗ Job not found: ${jobId}`));
        console.log(chalk.yellow("\n💡 List jobs:"));
        console.log(chalk.white("   npm run dev jobs list"));
        return;
      }

      console.log(chalk.bold.cyan("\n📋 Job Details\n"));

      // Basic Info
      logger.section("Basic Information");
      console.log(chalk.bold(`  ${job.title}`));
      console.log(
        chalk.gray(`  ${job.company?.name || "Unknown"} • ${job.location}`),
      );
      if (job.salary) console.log(chalk.green(`  💰 ${job.salary}`));
      console.log(chalk.gray(`  🆔 ${job.id}`));
      if (job.url) console.log(chalk.gray(`  🔗 ${job.url}`));
      console.log();

      // Match Score
      logger.section("Match Analysis");
      const matchColor =
        (job.skillsMatch || 0) >= 80 ? chalk.green
        : (job.skillsMatch || 0) >= 60 ? chalk.yellow
        : chalk.red;
      console.log(matchColor(`  🎯 Match Score: ${job.skillsMatch || "N/A"}%`));
      console.log(
        chalk.gray(`  📊 Experience Level: ${job.experienceLevel || "N/A"}`),
      );
      console.log();

      // Required Skills
      if (job.requiredSkills.length > 0) {
        logger.section(`Required Skills (${job.requiredSkills.length})`);
        job.requiredSkills.slice(0, 15).forEach((skill) => {
          console.log(chalk.white(`  • ${skill}`));
        });
        if (job.requiredSkills.length > 15) {
          console.log(
            chalk.gray(`  ... and ${job.requiredSkills.length - 15} more`),
          );
        }
        console.log();
      }

      // Preferred Skills
      if (job.preferredSkills.length > 0) {
        logger.section(`Preferred Skills (${job.preferredSkills.length})`);
        job.preferredSkills.slice(0, 10).forEach((skill) => {
          console.log(chalk.gray(`  • ${skill}`));
        });
        if (job.preferredSkills.length > 10) {
          console.log(
            chalk.gray(`  ... and ${job.preferredSkills.length - 10} more`),
          );
        }
        console.log();
      }

      // Responsibilities
      if (job.responsibilities.length > 0) {
        logger.section("Responsibilities");
        job.responsibilities.slice(0, 5).forEach((resp) => {
          console.log(chalk.white(`  • ${resp.substring(0, 70)}...`));
        });
        console.log();
      }

      // Company Info
      if (job.company) {
        logger.section("Company Information");
        console.log(chalk.white(`  ${job.company.name}`));
        if (job.company.domain)
          console.log(chalk.gray(`  🌐 ${job.company.domain}`));
        if (job.company.industry)
          console.log(chalk.gray(`  🏢 ${job.company.industry}`));
        if (job.company.size)
          console.log(chalk.gray(`  👥 ${job.company.size}`));

        if (job.company.techStack.length > 0) {
          console.log();
          console.log(chalk.cyan("  Tech Stack:"));
          console.log(
            chalk.white(`    ${job.company.techStack.slice(0, 10).join(", ")}`),
          );
        }
        console.log();
      }

      // Application Status
      if (job.applications.length > 0) {
        logger.section("Applications");
        job.applications.forEach((app) => {
          console.log(
            chalk.white(
              `  • Status: ${app.status} (${new Date(app.createdAt).toLocaleDateString()})`,
            ),
          );

        });
        console.log();
      }

      // Next Steps
      logger.section("Next Steps");
      console.log(
        chalk.gray("  • Tailor resume: npm run dev tailor " + job.id),
      );
      console.log(
        chalk.gray("  • Apply: npm run dev apply " + (job.url || "<url>")),
      );
      console.log();
    } catch (error: any) {
      logger.error("Failed to show job", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });

// Delete a job
jobsCommand
  .command("delete <job-id>")
  .alias("rm")
  .description("Delete an analyzed job")
  .option("--force", "Skip confirmation", false)
  .action(async (jobId: string, options) => {
    try {
      const prisma = getPrismaClient();

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        console.log(chalk.red(`\n✗ Job not found: ${jobId}`));
        return;
      }

      if (!options.force) {
        console.log(chalk.yellow(`\n⚠️  Delete job:`));
        console.log(chalk.white(`   ${job.title} at ${job.company?.name}`));
        console.log(chalk.gray(`   This action cannot be undone.`));
        console.log();
        
        const readline = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.gray("   Are you sure? (y/N): "), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.gray("\n✓ Cancelled"));
          return;
        }
      }

      await prisma.job.delete({
        where: { id: jobId },
      });

      console.log(chalk.green("\n✓ Job deleted successfully"));
    } catch (error: any) {
      logger.error("Failed to delete job", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });

// Search jobs
jobsCommand
  .command("search <query>")
  .description("Search jobs by title or company")
  .action(async (query: string) => {
    try {
      const prisma = getPrismaClient();

      const jobs = await prisma.job.findMany({
        where: {
          OR: [
            {
              title: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              company: {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
            {
              experienceLevel: {
                equals: query.toLowerCase(),
              },
            },
          ],
        },
        include: {
          company: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (jobs.length === 0) {
        console.log(chalk.yellow(`\n⚠️  No jobs found matching: "${query}"`));
        return;
      }

      console.log(
        chalk.bold.cyan(
          `\n🔍 Found ${jobs.length} job(s) matching "${query}":\n`,
        ),
      );

      jobs.forEach((job, index) => {
        console.log(
          chalk.white(
            `${index + 1}. ${job.title} at ${job.company?.name || "Unknown"}`,
          ),
        );
        console.log(chalk.gray(`   ID: ${job.id}`));
        console.log(
          chalk.gray(
            `   Match: ${job.skillsMatch || "N/A"}% | Level: ${job.experienceLevel || "N/A"}`,
          ),
        );
        console.log();
      });

      console.log(chalk.gray("💡 View details: npm run dev jobs show <id>"));
    } catch (error: any) {
      logger.error("Failed to search jobs", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });
