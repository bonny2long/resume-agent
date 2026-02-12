// src/cli/commands/email.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import { getEmailAgent, EmailOptions } from "@/agents/email-agent";
import getPrismaClient from "@/database/client";

export const emailCommand = new Command("email")
  .description("Generate follow-up email for an application")
  .argument("[application-id]", "ID of the application")
  .option(
    "--type <type>",
    "Email type (initial_followup|post_interview|check_in)",
    "initial_followup",
  )
  .option(
    "--tone <tone>",
    "Email tone (professional|enthusiastic|friendly)",
    "professional",
  )
  .option("--no-story", "Exclude career transition story")
  .option("--save", "Save email to database", false)
  .action(async (applicationId?: string, options?: any) => {
    try {
      const prisma = getPrismaClient();

      // If no application ID provided, show recent applications
      if (!applicationId) {
        const recentApplications = await prisma.application.findMany({
          include: {
            job: { include: { company: true } },
            hiringManager: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        if (recentApplications.length === 0) {
          console.log(chalk.yellow("\n⚠️  No applications found"));
          console.log(chalk.cyan("\n💡 Apply to a job first:"));
          console.log(chalk.white("   npm run dev apply <job-url>"));
          return;
        }

        console.log(chalk.bold.cyan("\n📋 Recent Applications:\n"));
        recentApplications.forEach((app, index) => {
          const daysAgo = Math.floor(
            (Date.now() - app.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          );
          const timeAgo = daysAgo === 0 ? "today" : `${daysAgo} days ago`;

          const statusColor =
            app.status === "offered" ? chalk.green
            : app.status === "interviewing" ? chalk.cyan
            : app.status === "applied" ? chalk.blue
            : chalk.gray;

          console.log(
            chalk.white(
              `${index + 1}. ${app.job.title} at ${app.job.company.name}`,
            ),
          );
          console.log(
            chalk.gray(`   Status: ${statusColor(app.status)} | ${timeAgo}`),
          );
          console.log(chalk.gray(`   ID: ${app.id}`));
          if (app.hiringManager) {
            console.log(chalk.gray(`   Manager: ${app.hiringManager.name}`));
          }
          console.log();
        });

        const { selectedAppId } = await inquirer.prompt([
          {
            type: "input",
            name: "selectedAppId",
            message: "Enter application ID:",
            validate: (input) => {
              if (!input) return "Application ID is required";
              return true;
            },
          },
        ]);

        applicationId = selectedAppId;
      }

      // Validate application exists
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: { include: { company: true } },
          hiringManager: true,
        },
      });

      if (!application) {
        console.log(chalk.red("\n✗ Application not found"));
        return;
      }

      console.log(chalk.bold.cyan("\n📧 Email Generator"));
      console.log(
        chalk.gray(
          `   Application: ${application.job.title} at ${application.job.company.name}`,
        ),
      );
      console.log();

      // Validate type
      const validTypes = ["initial_followup", "post_interview", "check_in"];
      let type = options?.type?.toLowerCase() || "initial_followup";

      if (!validTypes.includes(type)) {
        const { selectedType } = await inquirer.prompt([
          {
            type: "list",
            name: "selectedType",
            message: "Select email type:",
            choices: [
              {
                name: "Initial Follow-up (after applying)",
                value: "initial_followup",
              },
              { name: "Post-Interview (thank you)", value: "post_interview" },
              { name: "Check-in (weeks later)", value: "check_in" },
            ],
          },
        ]);
        type = selectedType;
      }

      // Validate tone
      const validTones = ["professional", "enthusiastic", "friendly"];
      let tone = options?.tone?.toLowerCase() || "professional";

      if (!validTones.includes(tone)) {
        const { selectedTone } = await inquirer.prompt([
          {
            type: "list",
            name: "selectedTone",
            message: "Select email tone:",
            choices: [
              { name: "Professional", value: "professional" },
              { name: "Enthusiastic", value: "enthusiastic" },
              { name: "Friendly", value: "friendly" },
            ],
          },
        ]);
        tone = selectedTone;
      }

      console.log(chalk.cyan(`📝 Type: ${type.replace(/_/g, " ")}`));
      console.log(chalk.gray(`   Tone: ${tone}`));
      console.log(chalk.gray(`   Include story: ${options?.story !== false}`));
      console.log();

      // Generate email
      const generateSpinner = ora("Generating email with AI...").start();

      const emailAgent = getEmailAgent();
      const emailOptions: EmailOptions = {
        type: type as "initial_followup" | "post_interview" | "check_in",
        tone: tone as "professional" | "enthusiastic" | "friendly",
        includeCareerStory: options?.story !== false,
      };

      const result = await emailAgent.generateEmail(
        applicationId!,
        emailOptions,
      );

      if (!result.success || !result.data) {
        generateSpinner.fail("Failed to generate email");
        console.log(chalk.red("\n✗ Error: " + result.error));
        return;
      }

      generateSpinner.succeed("Email generated!");

      const emailData = result.data;

      // Display email
      console.log();
      logger.section("Email");

      console.log(chalk.bold.white(`  To: ${emailData.to}`));
      console.log(chalk.bold.white(`  Subject: ${emailData.subject}`));
      console.log();
      console.log(chalk.white("  ─────────────────────────────────────"));
      console.log();
      console.log(chalk.white(emailData.body));
      console.log();
      console.log(chalk.white("  ─────────────────────────────────────"));
      console.log();

      // Save option
      if (options?.save) {
        const saveSpinner = ora("Saving to database...").start();

        try {
          await emailAgent.saveEmail(
            applicationId!,
            emailData.type,
            emailData.to,
            emailData.subject,
            emailData.body,
            emailData.tone,
            application.hiringManager?.id,
          );
          saveSpinner.succeed("Saved to database!");
        } catch (error: any) {
          saveSpinner.fail("Failed to save");
          logger.error("Save error", error);
        }
      }

      // Next steps
      console.log();
      logger.box(`
Email Ready! ✓

Type: ${emailData.type.replace(/_/g, " ")}
Tone: ${emailData.tone}

Next steps:
  1. Copy the email above
  2. Open your email client
  3. Send to: ${emailData.to}
  4. Track response and follow up if needed

Pro tips:
  • Personalize the email if needed
  • Send during business hours
  • Follow up after 5-7 business days if no response
      `);
    } catch (error: any) {
      logger.error("Email generation failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });
