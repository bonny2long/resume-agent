// src/cli/commands/reset.ts
import { Command } from "commander";
import chalk from "chalk";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";
import ora from "ora";
import inquirer from "inquirer";

export const resetCommand = new Command("reset")
  .description("Reset database (clear all data)")
  .option("--confirm", "Skip confirmation prompt")
  .option("--type <type>", "What to reset: all, resume, or data", "all")
  .action(async (options: { confirm?: boolean; type?: string }) => {
    logger.header("Database Reset");

    const resetType = options.type || "all";
    const resetTypes = ["all", "resume", "data"];

    if (!resetTypes.includes(resetType)) {
      console.log(chalk.red(`❌ Invalid reset type: ${resetType}`));
      console.log(chalk.yellow("Valid types: all, resume, data"));
      return;
    }

    // Show what will be reset
    console.log(chalk.bold.cyan(`\n🔄 Reset Type: ${resetType.toUpperCase()}`));

    switch (resetType) {
      case "all":
        console.log(chalk.yellow("⚠️  This will delete ALL data:"));
        console.log(chalk.white("   • Master resumes"));
        console.log(chalk.white("   • Experiences"));
        console.log(chalk.white("   • Projects"));
        console.log(chalk.white("   • Skills"));
        console.log(chalk.white("   • Education"));
        console.log(chalk.white("   • Certifications"));
        console.log(chalk.white("   • Job applications"));
        console.log(chalk.white("   • Jobs"));
        console.log(chalk.white("   • Companies"));
        console.log(chalk.white("   • Hiring managers"));
        break;
      case "resume":
        console.log(chalk.yellow("⚠️  This will delete resume data only:"));
        console.log(chalk.white("   • Master resumes"));
        console.log(chalk.white("   • Experiences"));
        console.log(chalk.white("   • Projects"));
        console.log(chalk.white("   • Skills"));
        console.log(chalk.white("   • Education"));
        console.log(chalk.white("   • Certifications"));
        break;
      case "data":
        console.log(chalk.yellow("⚠️  This will delete imported data:"));
        console.log(chalk.white("   • Job applications"));
        console.log(chalk.white("   • Jobs"));
        console.log(chalk.white("   • Companies"));
        console.log(chalk.white("   • Hiring managers"));
        console.log(chalk.white("   • LinkedIn messages"));
        break;
    }

    // Confirm reset
    if (!options.confirm) {
      const { confirmReset } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmReset",
          message: `Are you sure you want to reset ${resetType.toUpperCase()} data? This cannot be undone.`,
          default: false,
        },
      ]);

      if (!confirmReset) {
        console.log(chalk.cyan("💡 Reset cancelled."));
        return;
      }
    }

    const prisma = getPrismaClient();
    const spinner = ora("Resetting database...").start();

    try {
      switch (resetType) {
        case "all":
          // Delete everything
          spinner.text = "Clearing application and job data...";
          await prisma.application.deleteMany({});
          await prisma.job.deleteMany({});
          await prisma.company.deleteMany({});
          await prisma.hiringManager.deleteMany({});
          await prisma.linkedInMessage.deleteMany({});
          await prisma.gitHubRepo.deleteMany({});

          spinner.text = "Clearing resume data...";
          await prisma.masterResume.deleteMany({});
          break;

        case "resume":
          // Delete only resume-related data
          await prisma.masterResume.deleteMany({});
          spinner.text = "Clearing resume data...";
          break;

        case "data":
          // Delete job application data
          await prisma.application.deleteMany({});
          await prisma.job.deleteMany({});
          await prisma.company.deleteMany({});
          await prisma.hiringManager.deleteMany({});
          await prisma.linkedInMessage.deleteMany({});
          await prisma.gitHubRepo.deleteMany({});
          spinner.text = "Clearing application data...";
          break;
      }

      spinner.succeed("Database reset successfully!");

      console.log(
        chalk.green(`\n✅ ${resetType.toUpperCase()} data has been cleared`),
      );

      if (resetType === "all" || resetType === "resume") {
        console.log(chalk.cyan("\n💡 Next steps:"));
        console.log(
          chalk.white("   1. Upload your resumes: npm run dev -- upload-all"),
        );
        console.log(
          chalk.white(
            "   2. Or upload single: npm run dev -- upload <resume-file>",
          ),
        );
        console.log(
          chalk.white(
            "   3. Add skills manually: npm run dev -- resume add-skill",
          ),
        );
      }
    } catch (error) {
      spinner.fail("Reset failed");
      console.log(chalk.red("❌ Error resetting database:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Database reset failed", error);
    }
  });
