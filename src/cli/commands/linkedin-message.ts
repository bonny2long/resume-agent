// src/cli/commands/linkedin-message.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import {
  getLinkedInMessageAgent,
  LinkedInMessageOptions,
} from "@/agents/linkedin-message-generator";
import getPrismaClient from "@/database/client";

export const linkedInMessageCommand = new Command("linkedin-message")
  .description("Generate LinkedIn message for hiring manager")
  .argument("[job-id]", "ID of the analyzed job")
  .option(
    "--type <type>",
    "Message type (connection_request|initial_message|follow_up)",
    "connection_request",
  )
  .option(
    "--tone <tone>",
    "Message tone (professional|enthusiastic|friendly)",
    "professional",
  )
  .option("--no-story", "Exclude career transition story")
  .option("--save", "Save message to database", false)
  .action(async (jobId?: string, options?: any, command?: any) => {
    try {
      // Debug: Log all arguments and options
      console.log(chalk.gray(`Debug: jobId=${jobId}, options=${JSON.stringify(options)}, command=${JSON.stringify(command?.opts())}`));
      
      // Ensure options is properly populated
      if (!options && command) {
        options = command.opts();
      }
      
      const prisma = getPrismaClient();

      // If no job ID provided, show recent jobs
      if (!jobId) {
        const recentJobs = await prisma.job.findMany({
          include: { company: true, hiringManagers: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        if (recentJobs.length === 0) {
          console.log(chalk.yellow("\n⚠️  No analyzed jobs found"));
          console.log(chalk.cyan("\n💡 Analyze a job first:"));
          console.log(chalk.white("   npm run dev analyze <job-url> --save"));
          return;
        }

        console.log(chalk.bold.cyan("\n📋 Recent Jobs:\n"));
        recentJobs.forEach((job, index) => {
          console.log(
            chalk.white(
              `${index + 1}. ${job.title} at ${job.company?.name || "Unknown"}`,
            ),
          );
          console.log(chalk.gray(`   ID: ${job.id}`));
          console.log(
            chalk.gray(
              `   Hiring Managers: ${job.hiringManagers?.length || 0}`,
            ),
          );
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

      // Get hiring managers for this job
      const hiringManagers = await prisma.hiringManager.findMany({
        where: { jobId: jobId! },
        orderBy: { confidence: "desc" },
      });

      if (hiringManagers.length === 0) {
        console.log(
          chalk.yellow("\n⚠️  No hiring managers found for this job"),
        );
        console.log(chalk.cyan("\n💡 Find hiring manager first:"));
        console.log(chalk.white(`   npm run dev find-manager ${jobId} --save`));
        return;
      }

      // Select hiring manager
      let hiringManagerId: string;

      if (hiringManagers.length === 1) {
        hiringManagerId = hiringManagers[0].id;
        console.log(
          chalk.cyan(`\n📧 Generating message for: ${hiringManagers[0].name}`),
        );
      } else {
        console.log(chalk.bold.cyan("\n👥 Select Hiring Manager:\n"));
        hiringManagers.forEach((hm, index) => {
          console.log(chalk.white(`${index + 1}. ${hm.name}`));
          console.log(
            chalk.gray(
              `   ${hm.title || "No title"} | Confidence: ${hm.confidence}%`,
            ),
          );
          console.log();
        });

        const { selectedIndex } = await inquirer.prompt([
          {
            type: "number",
            name: "selectedIndex",
            message: "Select hiring manager (number):",
            validate: (input) => {
              if (input < 1 || input > hiringManagers.length) {
                return `Please enter a number between 1 and ${hiringManagers.length}`;
              }
              return true;
            },
          },
        ]);

        hiringManagerId = hiringManagers[selectedIndex - 1].id;
      }

      // Validate type and tone
      const validTypes = ["connection_request", "initial_message", "follow_up"];
      const type = options?.type?.toLowerCase() || "connection_request";
      if (!validTypes.includes(type)) {
        console.log(chalk.yellow(`\n⚠️  Invalid type: ${options.type}`));
        console.log(chalk.gray(`   Valid options: ${validTypes.join(", ")}`));
        return;
      }

      const validTones = ["professional", "enthusiastic", "friendly"];
      const tone = options?.tone?.toLowerCase() || "professional";
      if (!validTones.includes(tone)) {
        console.log(chalk.yellow(`\n⚠️  Invalid tone: ${options.tone}`));
        console.log(chalk.gray(`   Valid options: ${validTones.join(", ")}`));
        return;
      }

      logger.header("LinkedIn Message Generator");
      console.log(chalk.cyan(`📝 Type: ${type}`));
      console.log(chalk.gray(`   Tone: ${tone}`));
      console.log(chalk.gray(`   Include story: ${options.story !== false}`));
      console.log();

      // Generate message
      const generateSpinner = ora("Generating message with AI...").start();

      const messageAgent = getLinkedInMessageAgent();
      const messageOptions: LinkedInMessageOptions = {
        type: type as "connection_request" | "initial_message" | "follow_up",
        tone: tone as "professional" | "enthusiastic" | "friendly",
        includeCareerStory: options.story !== false,
      };

      const result = await messageAgent.generateMessage(
        jobId!,
        hiringManagerId,
        messageOptions,
      );

      if (!result.success || !result.data) {
        generateSpinner.fail("Failed to generate message");
        console.log(chalk.red("\n✗ Error: " + result.error));
        return;
      }

      generateSpinner.succeed("Message generated!");

      const messageData = result.data;

      // Display message
      console.log();
      logger.section("LinkedIn Message");

      if (messageData.subject) {
        console.log(chalk.bold.white(`  Subject: ${messageData.subject}`));
        console.log();
      }

      console.log(chalk.white("  ─────────────────────────────────────"));
      console.log();
      console.log(chalk.white(messageData.message));
      console.log();
      console.log(chalk.white("  ─────────────────────────────────────"));
      console.log();

      // Debug save option
      console.log(chalk.gray(`  Save option: ${options?.save}`));

      // Stats
      console.log(chalk.gray(`  Characters: ${messageData.characterCount}`));

      if (messageData.type === "connection_request") {
        const remaining = 300 - messageData.characterCount;
        const color = remaining >= 0 ? chalk.green : chalk.red;
        console.log(
          color(
            `  LinkedIn Limit: 300 chars (${remaining >= 0 ? remaining + " remaining" : "OVER LIMIT"})`,
          ),
        );
      }

      console.log();

      // Tips
      if (messageData.tips.length > 0) {
        console.log(chalk.bold.cyan("  💡 Tips:"));
        messageData.tips.forEach((tip) => {
          console.log(chalk.gray(`     • ${tip}`));
        });
        console.log();
      }

      // Save option
      if (options?.save) {
        const saveSpinner = ora("Saving to database...").start();

        try {
          await messageAgent.saveMessage(
            hiringManagerId,
            messageData.type,
            messageData.subject,
            messageData.message,
            messageData.tone,
          );
          saveSpinner.succeed("Saved to database!");
        } catch (error: any) {
          saveSpinner.fail("Failed to save");
          logger.error("Save error", error);
        }
      }

      // Next steps
      const hiringManager = hiringManagers.find(
        (hm) => hm.id === hiringManagerId,
      );

      console.log();
      logger.box(`
LinkedIn Message Ready! ✓

Type: ${messageData.type.replace(/_/g, " ")}
Tone: ${messageData.tone}
Characters: ${messageData.characterCount}${messageData.type === "connection_request" ? "/300" : ""}

Next steps:
  1. Copy the message above
  2. ${hiringManager?.linkedInUrl ? `Open LinkedIn: ${hiringManager.linkedInUrl}` : "Find them on LinkedIn"}
  3. ${messageData.type === "connection_request" ? "Click 'Connect' and paste message" : "Send the message"}
  4. Track response and follow up if needed

Pro tips:
  • Personalize further if you know more about them
  • Send during business hours (9am-5pm their timezone)
  • Follow up after 3-5 business days if no response
      `);
    } catch (error: any) {
      logger.error("LinkedIn message generation failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });
