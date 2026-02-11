// src/cli/commands/apply.ts
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import { getApplicationOrchestrator } from "@/agents/application-orchestrator.agent";
import path from "path";

export const applyCommand = new Command("apply")
  .description("Apply for a job (complete automated workflow)")
  .argument("[job-url]", "URL of the job posting")
  .option("--skip-hiring-manager", "Skip hiring manager search", false)
  .action(async (jobUrl?: string) => {
    try {
      // Get job URL if not provided
      if (!jobUrl) {
        const inquirer = (await import("inquirer")).default;
        const { url } = await inquirer.prompt([
          {
            type: "input",
            name: "url",
            message: "Enter job posting URL:",
            validate: (input) => {
              if (!input) return "URL is required";
              if (!input.startsWith("http"))
                return "URL must start with http:// or https://";
              return true;
            },
          },
        ]);
        jobUrl = url;
      }

      logger.header("Complete Job Application");
      console.log(chalk.cyan("🚀 Starting automated application workflow..."));
      console.log(chalk.gray(`   URL: ${jobUrl}`));
      console.log();

      // Start workflow
      const workflowSpinner = ora("Running complete workflow...").start();

      const orchestrator = getApplicationOrchestrator();
      const result = await orchestrator.applyToJob(jobUrl!);

      if (!result.success || !result.data) {
        workflowSpinner.fail("Workflow failed");
        console.log(chalk.red("\n✗ Error: " + result.error));

        // Provide helpful next steps
        console.log();
        console.log(chalk.yellow("💡 You can run individual steps:"));
        console.log(chalk.white("   npm run dev -- analyze <job-url> --save"));
        console.log(
          chalk.white(
            "   npm run dev -- tailor <job-id> --generate-embeddings",
          ),
        );
        console.log(chalk.white("   npm run dev -- generate <job-id>"));
        console.log(chalk.white("   npm run dev -- cover-letter <job-id>"));
        return;
      }

      workflowSpinner.succeed("Workflow complete!");

      const pkg = result.data;

      // Display results
      console.log();
      logger.section("Application Package Created");
      console.log();

      // Job info
      console.log(chalk.bold.white("  📋 Job Information"));
      console.log(chalk.white(`     ${pkg.jobTitle}`));
      console.log(chalk.gray(`     ${pkg.companyName}`));
      console.log(
        pkg.matchScore >= 80 ?
          chalk.green(`     Match Score: ${pkg.matchScore}%`)
        : pkg.matchScore >= 60 ?
          chalk.yellow(`     Match Score: ${pkg.matchScore}%`)
        : chalk.red(`     Match Score: ${pkg.matchScore}%`),
      );
      console.log();

      // Generated files
      console.log(chalk.bold.white("  📄 Generated Documents"));

      const resumeFilename = path.basename(pkg.resumePath);
      const resumeSize = require("fs").statSync(pkg.resumePath).size;
      const resumeSizeKB = (resumeSize / 1024).toFixed(1);
      console.log(chalk.white(`     Resume: ${resumeFilename}`));
      console.log(chalk.gray(`     Size: ${resumeSizeKB} KB`));
      console.log(chalk.gray(`     Path: ${pkg.resumePath}`));
      console.log();

      const coverLetterFilename = path.basename(pkg.coverLetterPath);
      const coverLetterSize = require("fs").statSync(pkg.coverLetterPath).size;
      const coverLetterSizeKB = (coverLetterSize / 1024).toFixed(1);
      console.log(chalk.white(`     Cover Letter: ${coverLetterFilename}`));
      console.log(chalk.gray(`     Size: ${coverLetterSizeKB} KB`));
      console.log(chalk.gray(`     Path: ${pkg.coverLetterPath}`));
      console.log();

      // Hiring manager info (if found)
      if (pkg.hiringManagerName) {
        console.log(chalk.bold.white("  👤 Hiring Manager"));
        console.log(chalk.white(`     ${pkg.hiringManagerName}`));
        if (pkg.hiringManagerLinkedIn) {
          console.log(chalk.blue(`     ${pkg.hiringManagerLinkedIn}`));
        }
        console.log();

        if (pkg.linkedInMessage) {
          console.log(chalk.bold.white("  💬 LinkedIn Connection Request"));
          console.log(chalk.gray("     ─────────────────────────────────────"));
          console.log(chalk.white(`     ${pkg.linkedInMessage}`));
          console.log(chalk.gray("     ─────────────────────────────────────"));
          console.log(
            chalk.gray(`     Characters: ${pkg.linkedInMessage.length}/300`),
          );
          console.log();
        }
      }

      // Database IDs
      console.log(chalk.bold.white("  🗄️  Database"));
      console.log(chalk.gray(`     Job ID: ${pkg.jobId}`));
      console.log(chalk.gray(`     Application ID: ${pkg.applicationId}`));
      console.log();

      // Final summary box
      logger.box(`
Application Package Complete! ✓

Job: ${pkg.jobTitle}
Company: ${pkg.companyName}
Match: ${pkg.matchScore}%

Generated:
  ✅ ${resumeFilename}
  ✅ ${coverLetterFilename}
  ${pkg.hiringManagerName ? `✅ Hiring manager found: ${pkg.hiringManagerName}` : ""}
  ${pkg.linkedInMessage ? "✅ LinkedIn message ready" : ""}

Next Steps:
  1. Review documents (both files in data/outputs/)
  2. Customize if needed (optional)
  3. Submit application on company website
  ${pkg.hiringManagerLinkedIn ? `4. Send LinkedIn request: ${pkg.hiringManagerLinkedIn}` : ""}
  5. Track status: npm run dev -- status

Total time: ~60 seconds ⚡
      `);

      // Open files option
      console.log();
      const inquirer = (await import("inquirer")).default;
      const { openFiles } = await inquirer.prompt([
        {
          type: "confirm",
          name: "openFiles",
          message: "Would you like to open the documents now?",
          default: true,
        },
      ]);

      if (openFiles) {
        const { exec } = require("child_process");
        const platform = process.platform;

        if (platform === "win32") {
          exec(`start "" "${pkg.resumePath}"`);
          exec(`start "" "${pkg.coverLetterPath}"`);
        } else if (platform === "darwin") {
          exec(`open "${pkg.resumePath}"`);
          exec(`open "${pkg.coverLetterPath}"`);
        } else {
          exec(`xdg-open "${pkg.resumePath}"`);
          exec(`xdg-open "${pkg.coverLetterPath}"`);
        }

        console.log(chalk.green("\n✓ Documents opened"));
      }
    } catch (error: any) {
      logger.error("Apply command failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));

      // Helpful debugging info
      if (error.message.includes("Job analysis failed")) {
        console.log(
          chalk.yellow("\n💡 The job URL might be invalid or blocked"),
        );
        console.log(chalk.gray("   Try analyzing it manually first:"));
        console.log(
          chalk.white("   npm run dev -- analyze <job-url> --save --verbose"),
        );
      } else if (error.message.includes("Resume tailoring failed")) {
        console.log(chalk.yellow("\n💡 Make sure embeddings are generated"));
        console.log(chalk.gray("   Run this first:"));
        console.log(
          chalk.white(
            "   npm run dev -- tailor <job-id> --generate-embeddings",
          ),
        );
      } else if (error.message.includes("No master resume found")) {
        console.log(chalk.yellow("\n💡 No resume found in database"));
        console.log(chalk.gray("   Upload your resume first:"));
        console.log(chalk.white("   npm run dev -- upload resume.pdf"));
      }
    }
  });
