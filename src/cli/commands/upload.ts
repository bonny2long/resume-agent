// src/cli/commands/upload.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { logger } from "@/utils/logger";
import { getResumeParserService } from "@/services/resume-parser.service";
import { getPDFParserService } from "@/services/pdf-parser.service";
import { getDOCXParserService } from "@/services/docx-parser.service";
import getPrismaClient from "@/database/client";

export const uploadCommand = new Command("upload")
  .description("Upload and parse an existing resume (PDF or DOCX)")
  .argument("[file]", "Path to resume file (PDF or DOCX)")
  .action(async (file?: string) => {
    try {
      let filePath: string | null = null;

      // If file provided, try to find it
      if (file) {
        try {
          filePath = await findResumeFile(file);
        } catch (err) {
          logger.warn(`File "${file}" not found.`);
        }
      }

      // If no file provided or provided file not found, prompt for it
      if (!filePath) {
        // Look for files in common locations
        const uploadsDirs = [
          path.join(process.cwd(), "data", "uploads"),
          path.join(process.cwd(), "src", "data", "uploads"),
          path.join(process.cwd(), "data"),
          process.cwd(),
        ];

        let availableFiles: string[] = [];
        for (const dir of uploadsDirs) {
          if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            try {
              const files = fs.readdirSync(dir).filter((f) => {
                const ext = path.extname(f).toLowerCase();
                return ext === ".pdf" || ext === ".docx" || ext === ".doc";
              });
              availableFiles = [
                ...availableFiles,
                ...files.map((f) => path.join(dir, f)),
              ];
            } catch (err) {
              // Ignore errors reading directories
            }
          }
        }

        // De-duplicate
        availableFiles = [...new Set(availableFiles)];

        if (availableFiles.length > 0) {
          const { selectedFile } = await inquirer.prompt([
            {
              type: "list",
              name: "selectedFile",
              message: "Select a resume file:",
              choices: [
                ...availableFiles.map((f) => ({
                  name:
                    path.basename(f) +
                    chalk.gray(` (${path.relative(process.cwd(), f)})`),
                  value: f,
                })),
                new inquirer.Separator(),
                { name: "Enter path manually...", value: "manual" },
              ],
            },
          ]);

          if (selectedFile === "manual") {
            const { manualPath } = await inquirer.prompt([
              {
                type: "input",
                name: "manualPath",
                message: "Enter path to resume file:",
                validate: (input) => (input ? true : "Path is required"),
              },
            ]);
            filePath = await findResumeFile(manualPath);
          } else {
            filePath = selectedFile;
          }
        } else {
          const { selectedFile } = await inquirer.prompt([
            {
              type: "input",
              name: "selectedFile",
              message: "Enter path to resume file (PDF or DOCX):",
              validate: (input) => {
                if (!input) return "File path is required";
                return true;
              },
            },
          ]);
          filePath = await findResumeFile(selectedFile);
        }
      }

      if (!filePath) {
        throw new Error("No file selected.");
      }

      logger.header("Resume Upload");

      // Get file info
      const fileStats = fs.statSync(filePath);
      const fileExt = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);

      // Display file info
      console.log(chalk.cyan("📁 File:"), chalk.white(fileName));
      console.log(
        chalk.cyan("📏 Size:"),
        chalk.white(formatFileSize(fileStats.size)),
      );
      console.log(
        chalk.cyan("📄 Type:"),
        chalk.white(fileExt === ".pdf" ? "PDF" : "DOCX"),
      );
      console.log();

      // Confirm upload
      const { confirmUpload } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmUpload",
          message: "Parse this file?",
          default: true,
        },
      ]);

      if (!confirmUpload) {
        logger.info("Upload cancelled");
        return;
      }

      // Parse file
      const spinner = ora("Reading file...").start();

      let wordCount: number;
      if (fileExt === ".pdf") {
        const pdfParser = getPDFParserService();
        wordCount = await pdfParser.getWordCount(filePath);
      } else {
        const docxParser = getDOCXParserService();
        wordCount = await docxParser.getWordCount(filePath);
      }

      spinner.succeed(`Extracted ${wordCount.toLocaleString()} words`);

      // Parse with AI
      const parsingSpinner = ora("Parsing with AI...").start();

      const parser = getResumeParserService();
      const parsed = await parser.parseResumeFile(filePath);

      parsingSpinner.succeed("Parsing complete!");

      // Validate
      const validation = parser.validateParsedResume(parsed);

      if (validation.errors.length > 0) {
        console.log(chalk.red("\n⚠️  Errors found:"));
        validation.errors.forEach((err) =>
          console.log(chalk.red("  • " + err)),
        );
      }

      if (validation.warnings.length > 0) {
        console.log(chalk.yellow("\n⚠️  Warnings:"));
        validation.warnings.forEach((warn) =>
          console.log(chalk.yellow("  • " + warn)),
        );
      }

      if (!validation.valid) {
        const { continueAnyway } = await inquirer.prompt([
          {
            type: "confirm",
            name: "continueAnyway",
            message: "Errors found. Continue anyway?",
            default: false,
          },
        ]);

        if (!continueAnyway) {
          logger.info("Upload cancelled");
          return;
        }
      }

      // Display preview
      console.log();
      displayPreview(parsed);

      // Confirm save
      const { confirmSave } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmSave",
          message: "Save this data to your master resume?",
          default: true,
        },
      ]);

      if (!confirmSave) {
        logger.info("Upload cancelled");
        return;
      }

      // Save to database
      const saveSpinner = ora("Saving to database...").start();

      const prisma = getPrismaClient();

      // Check if master resume exists
      let masterResume = await prisma.masterResume.findFirst();

      if (masterResume) {
        const { overwrite } = await inquirer.prompt([
          {
            type: "confirm",
            name: "overwrite",
            message: "Master resume already exists. Overwrite with new data?",
            default: false,
          },
        ]);

        if (!overwrite) {
          saveSpinner.fail("Upload cancelled");
          return;
        }

        // Delete existing data
        await prisma.masterResume.delete({ where: { id: masterResume.id } });
      }

      // Create new master resume
      masterResume = await prisma.masterResume.create({
        data: {
          fullName: parsed.personalInfo.fullName || "Unknown",
          email: parsed.personalInfo.email || "unknown@example.com",
          phone: parsed.personalInfo.phone || "",
          location: parsed.personalInfo.location || "",
          linkedInUrl: parsed.personalInfo.linkedInUrl,
          githubUrl: parsed.personalInfo.githubUrl,
          portfolioUrl: parsed.personalInfo.portfolioUrl,
          summaryShort: parsed.summary.short || "",
          summaryLong: parsed.summary.long || parsed.summary.short || "",
        },
      });

      // Save experiences
      for (const exp of parsed.experiences) {
        await prisma.experience.create({
          data: {
            resumeId: masterResume.id,
            company: exp.company,
            title: exp.title,
            location: exp.location || "",
            startDate: new Date(exp.startDate),
            endDate: exp.endDate ? new Date(exp.endDate) : null,
            current: exp.current,
            description: exp.description,
            achievements: {
              create: exp.achievements.map((ach) => ({
                description: ach.description,
                metrics: ach.metrics,
                impact: ach.impact || "medium",
                keywords: [],
              })),
            },
          },
        });
      }

      // Save projects
      for (const proj of parsed.projects) {
        await prisma.project.create({
          data: {
            resumeId: masterResume.id,
            name: proj.name,
            description: proj.description,
            role: proj.role || "",
            githubUrl: proj.githubUrl,
            liveUrl: proj.liveUrl,
            startDate: proj.startDate ? new Date(proj.startDate) : new Date(),
            endDate: proj.endDate ? new Date(proj.endDate) : new Date(),
            achievements: proj.achievements,
            featured: false,
          },
        });
      }

      // Save education
      for (const edu of parsed.education) {
        await prisma.education.create({
          data: {
            resumeId: masterResume.id,
            institution: edu.institution,
            degree: edu.degree,
            field: edu.field,
            startDate: edu.startDate ? new Date(edu.startDate) : new Date(),
            endDate: edu.endDate ? new Date(edu.endDate) : null,
            gpa: edu.gpa,
          },
        });
      }

      // Save certifications
      for (const cert of parsed.certifications) {
        await prisma.certification.create({
          data: {
            resumeId: masterResume.id,
            name: cert.name,
            issuer: cert.issuer || "",
            issueDate: cert.issueDate ? new Date(cert.issueDate) : new Date(),
            expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
            credentialId: cert.credentialId,
            url: cert.url,
          },
        });
      }

      // Save skills - THIS WAS MISSING!
      const allTechnicalSkills = [
        ...parsed.skills.technical,
        ...parsed.skills.languages,
        ...parsed.skills.frameworks,
        ...parsed.skills.tools,
        ...parsed.skills.databases,
      ];

      for (const skill of allTechnicalSkills) {
        await prisma.skill.create({
          data: {
            resumeId: masterResume.id,
            name: skill,
            category: "Technical", // Default category
            proficiency: "intermediate", // Default proficiency
            technologies: {
              connectOrCreate: {
                where: { name: skill },
                create: {
                  name: skill,
                  category: "language", // Default for skills
                },
              },
            },
          },
        });
      }

      // Also save soft skills
      for (const skill of parsed.skills.soft || []) {
        await prisma.skill.create({
          data: {
            resumeId: masterResume.id,
            name: skill,
            category: "Soft Skills",
            proficiency: "intermediate",
            technologies: {
              connectOrCreate: {
                where: { name: skill },
                create: {
                  name: skill,
                  category: "tool",
                },
              },
            },
          },
        });
      }

      saveSpinner.succeed("Saved to database!");

      // Success summary
      const stats = parser.getSummaryStats(parsed);

      logger.box(`
Master Resume Created! ✓

Personal Info: ${parsed.personalInfo.fullName}
Email: ${parsed.personalInfo.email}

Data Imported:
• ${stats.totalExperiences} work experiences
• ${stats.totalProjects} projects
• ${stats.totalSkills} skills
• ${stats.totalEducation} education entries
• ${stats.totalCertifications} certifications

Years of Experience: ${stats.yearsOfExperience} years

Next steps:
  1. Review: npm run dev resume list
  2. Edit: npm run dev resume edit [id]
  3. Apply: npm run dev apply <job-url>
      `);
    } catch (error: any) {
      logger.error("Upload failed", error);
      console.log(chalk.red("\n✗ Upload failed: " + error.message));
    }
  });

/**
 * Find resume file in various locations
 */
async function findResumeFile(filename: string): Promise<string> {
  // 1. Check if it's an absolute path
  if (path.isAbsolute(filename) && fs.existsSync(filename)) {
    return filename;
  }

  // 2. Check in uploads directory
  const uploadsPath = path.join(process.cwd(), "data", "uploads", filename);
  if (fs.existsSync(uploadsPath)) {
    return uploadsPath;
  }

  // 3. Check in current directory
  if (fs.existsSync(filename)) {
    return path.resolve(filename);
  }

  // 4. Check common locations
  const commonLocations = [
    path.join(process.cwd(), filename),
    path.join(process.cwd(), "data", filename),
    path.join(process.cwd(), "data", "uploads", filename),
    path.join(process.cwd(), "src", "data", "uploads", filename),
    path.join(process.cwd(), "src", "data", filename),
    path.join(process.env.HOME || "", "Downloads", filename),
    path.join(process.env.HOME || "", "Documents", filename),
  ];

  for (const location of commonLocations) {
    if (fs.existsSync(location)) {
      return location;
    }
  }

  throw new Error(
    `File not found: ${filename}\n\nTry:\n  - Absolute path\n  - Copy to data/uploads/\n  - Specify full path`,
  );
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Display preview of parsed resume
 */
function displayPreview(parsed: any) {
  logger.section("Preview - Personal Info");
  console.log(chalk.white(`  ${parsed.personalInfo.fullName}`));
  console.log(chalk.gray(`  ${parsed.personalInfo.email}`));
  console.log(chalk.gray(`  ${parsed.personalInfo.phone}`));
  if (parsed.personalInfo.linkedInUrl) {
    console.log(chalk.gray(`  LinkedIn: ${parsed.personalInfo.linkedInUrl}`));
  }
  if (parsed.personalInfo.githubUrl) {
    console.log(chalk.gray(`  GitHub: ${parsed.personalInfo.githubUrl}`));
  }

  logger.section("Preview - Work Experience");
  parsed.experiences.slice(0, 3).forEach((exp: any, i: number) => {
    const current = exp.current ? chalk.green(" (Current)") : "";
    console.log(
      chalk.white(`  ${i + 1}. ${exp.title} at ${exp.company}${current}`),
    );
    console.log(
      chalk.gray(`     ${exp.startDate} - ${exp.endDate || "Present"}`),
    );
    if (exp.achievements.length > 0) {
      console.log(
        chalk.gray(
          `     • ${exp.achievements[0].description.substring(0, 60)}...`,
        ),
      );
    }
  });

  if (parsed.experiences.length > 3) {
    console.log(chalk.gray(`  ... and ${parsed.experiences.length - 3} more`));
  }

  logger.section("Preview - Projects");
  parsed.projects.slice(0, 3).forEach((proj: any, i: number) => {
    console.log(chalk.white(`  ${i + 1}. ${proj.name}`));
    console.log(chalk.gray(`     ${proj.description.substring(0, 60)}...`));
    if (proj.technologies.length > 0) {
      console.log(
        chalk.gray(`     Tech: ${proj.technologies.slice(0, 5).join(", ")}`),
      );
    }
  });

  if (parsed.projects.length > 3) {
    console.log(chalk.gray(`  ... and ${parsed.projects.length - 3} more`));
  }

  logger.section("Preview - Skills");
  const allSkills = [
    ...parsed.skills.languages,
    ...parsed.skills.frameworks,
    ...parsed.skills.tools,
  ].slice(0, 15);
  console.log(chalk.white(`  ${allSkills.join(", ")}`));
  if (allSkills.length > 15) {
    console.log(chalk.gray(`  ... and more`));
  }
}
