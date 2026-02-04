import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import { ExportService } from "../../services/export.service";
import { displayBanner } from "../../utils/banner";

const exportCommand = new Command("export")
  .description("Export master resume data from database")
  .option("-f, --format <format>", "Export format (json|markdown)", "json")
  .option("-t, --type <type>", "Export type (master|github)", "master")
  .action(async (options) => {
    await displayBanner();

    console.log(chalk.bold.blue("Resume Data Export"));
    console.log(chalk.gray("─".repeat(50)));

    try {
      const exportService = new ExportService();

      // Let user choose options if not provided
      if (!options.format || !options.type) {
        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "type",
            message: "What would you like to export?",
            choices: [
              { name: "📋 Master Resume (Complete data)", value: "master" },
              { name: "🐙 GitHub Repositories", value: "github" },
            ],
          },
          {
            type: "list",
            name: "format",
            message: "Choose export format:",
            choices: [
              { name: "📄 JSON (Structured data)", value: "json" },
              { name: "📝 Markdown (Readable document)", value: "markdown" },
            ],
          },
        ]);

        options.format = answers.format;
        options.type = answers.type;
      }

      console.log(
        chalk.yellow(`\n📤 Exporting ${options.type} as ${options.format}...`),
      );

      let filePath: string;
      let fileType: string;

      if (options.type === "master") {
        if (!["json", "markdown"].includes(options.format)) {
          console.log(
            chalk.red(
              "❌ Invalid format. Use json or markdown for master resume.",
            ),
          );
          return;
        }
        filePath = await exportService.exportMasterResume(
          options.format as "json" | "markdown",
        );
        fileType = "Master Resume";
      } else if (options.type === "github") {
        filePath = await exportService.exportGitHubRepos();
        fileType = "GitHub Repositories";
      } else {
        console.log(chalk.red("❌ Invalid export type. Use master or github."));
        return;
      }

      // Success message
      console.log(chalk.green("\n✅ Export successful!"));
      console.log(chalk.cyan(`\n📁 File saved to:`));
      console.log(chalk.white(`   ${filePath}`));

      // File info
      const stats = await import("fs").then((fs) => fs.promises.stat(filePath));
      const fileSizeKB = Math.round(stats.size / 1024);
      const modifiedDate = stats.mtime.toLocaleString();

      console.log(chalk.cyan(`\n📊 File Information:`));
      console.log(chalk.white(`   Type: ${fileType}`));
      console.log(chalk.white(`   Format: ${options.format}`));
      console.log(chalk.white(`   Size: ${fileSizeKB} KB`));
      console.log(chalk.white(`   Modified: ${modifiedDate}`));

      // Show what was exported
      if (options.type === "master") {
        console.log(chalk.cyan(`\n📋 Exported Contents:`));
        console.log(chalk.white(`   • Personal Information`));
        console.log(chalk.white(`   • Work Experience & Achievements`));
        console.log(chalk.white(`   • Projects & Technologies`));
        console.log(chalk.white(`   • Skills & Categories`));
        console.log(chalk.white(`   • Education & Certifications`));
        console.log(chalk.white(`   • Metadata & Statistics`));
      }

      // Next steps
      console.log(chalk.cyan(`\n🎯 Next Steps:`));
      console.log(chalk.white(`   1. Review the exported file`));
      console.log(
        chalk.white(`   2. Share the ${options.format} file as needed`),
      );

      if (options.format === "json") {
        console.log(chalk.white(`   3. Import into other systems if needed`));
      } else {
        console.log(chalk.white(`   3. Convert to PDF if required`));
      }

      console.log(
        chalk.gray(`\n💡 Tip: Files are saved in data/outputs/ folder`),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("No master resume found")
      ) {
        console.log(chalk.yellow("⚠️  No master resume found in database."));
        console.log(chalk.cyan("\n💡 To create a master resume:"));
        console.log(
          chalk.white(
            "   1. Upload your resume: npm run dev upload <resume-file>",
          ),
        );
        console.log(chalk.white("   2. Then try exporting again"));
      } else {
        console.log(chalk.red("❌ Export failed:"));
        console.log(
          chalk.white(error instanceof Error ? error.message : "Unknown error"),
        );
      }
    }
  });

export { exportCommand };
