// src/cli/commands/import.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { logger } from "@/utils/logger";
import {
  PrismaClient,
  Proficiency,
  Impact,
  TechCategory,
} from "@prisma/client";

export const importCommand = new Command("import")
  .description(
    "Import a master resume from a JSON file (standard export format)",
  )
  .option("-f, --file <path>", "Path to JSON file")
  .action(async (options) => {
    logger.header("Import Master Resume");

    try {
      let filePath = options.file;

      // If no file provided, look for files in data/outputs
      if (!filePath) {
        const outputsDir = path.join(process.cwd(), "data", "outputs");

        if (fs.existsSync(outputsDir)) {
          const files = fs
            .readdirSync(outputsDir)
            .filter((f) => f.endsWith(".json") && f.includes("master_resume"));

          if (files.length > 0) {
            // Sort by date (newest first)
            files.sort((a, b) => {
              const statA = fs.statSync(path.join(outputsDir, a));
              const statB = fs.statSync(path.join(outputsDir, b));
              return statB.mtime.getTime() - statA.mtime.getTime();
            });

            const { selectedFile } = await inquirer.prompt([
              {
                type: "list",
                name: "selectedFile",
                message: "Select a file to import:",
                choices: [
                  ...files.map((f) => ({
                    name:
                      f +
                      chalk.gray(
                        ` (${new Date(fs.statSync(path.join(outputsDir, f)).mtime).toLocaleString()})`,
                      ),
                    value: path.join(outputsDir, f),
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
                  message: "Enter path to JSON file:",
                  validate: (input) =>
                    fs.existsSync(input) ? true : "File not found",
                },
              ]);
              filePath = manualPath;
            } else {
              filePath = selectedFile;
            }
          } else {
            const { manualPath } = await inquirer.prompt([
              {
                type: "input",
                name: "manualPath",
                message: "Enter path to JSON file:",
                validate: (input) =>
                  fs.existsSync(input) ? true : "File not found",
              },
            ]);
            filePath = manualPath;
          }
        } else {
          const { manualPath } = await inquirer.prompt([
            {
              type: "input",
              name: "manualPath",
              message: "Enter path to JSON file:",
              validate: (input) =>
                fs.existsSync(input) ? true : "File not found",
            },
          ]);
          filePath = manualPath;
        }
      }

      if (!filePath) {
        logger.warn("No file selected. Import cancelled.");
        return;
      }

      // Read file
      const spinner = ora("Reading file...").start();
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(fileContent);
      spinner.succeed("File read successfully");

      // Validate data structure (basic check)
      if (
        !data.personalInfo ||
        !data.experiences ||
        !data.projects ||
        !data.skills
      ) {
        logger.error(
          "Invalid resume data format. Missing required top-level fields.",
        );
        return;
      }

      // Confirm import
      console.log(chalk.cyan("\n📄 File Preview:"));
      console.log(chalk.white(`   Name: ${data.personalInfo.fullName}`));
      console.log(chalk.white(`   Email: ${data.personalInfo.email}`));
      console.log(chalk.gray(`   Experiences: ${data.experiences.length}`));
      console.log(chalk.gray(`   Projects: ${data.projects.length}`));
      console.log(chalk.gray(`   Skills: ${data.skills.length}`));

      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message:
            "Import this data? (This will OVERWRITE your existing master resume)",
          default: false,
        },
      ]);

      if (!confirm) {
        logger.info("Import cancelled");
        return;
      }

      const dbSpinner = ora("Importing to database...").start();
      const prisma = new PrismaClient();

      try {
        // Find existing master resume
        const existing = await prisma.masterResume.findFirst();

        if (existing) {
          // Delete everything for this resume
          await prisma.experience.deleteMany({
            where: { resumeId: existing.id },
          });
          await prisma.project.deleteMany({ where: { resumeId: existing.id } });
          await prisma.skill.deleteMany({ where: { resumeId: existing.id } });
          await prisma.education.deleteMany({
            where: { resumeId: existing.id },
          });
          await prisma.certification.deleteMany({
            where: { resumeId: existing.id },
          });

          await prisma.masterResume.delete({ where: { id: existing.id } });
        }

        // Create new master resume
        const masterResume = await prisma.masterResume.create({
          data: {
            fullName: data.personalInfo.fullName || "Unknown",
            email: data.personalInfo.email || "unknown@example.com",
            phone: data.personalInfo.phone || "",
            location: data.personalInfo.location || "",
            linkedInUrl: data.personalInfo.linkedInUrl || null,
            githubUrl: data.personalInfo.githubUrl || null,
            portfolioUrl: data.personalInfo.portfolioUrl || null,
            summaryShort: data.personalInfo.summaryShort || "",
            summaryLong:
              data.personalInfo.summaryLong ||
              data.personalInfo.summaryShort ||
              "",
            version: data.metadata?.version || 1,
          },
        });

        // Import experiences
        for (const exp of data.experiences) {
          try {
            await prisma.experience.create({
              data: {
                resumeId: masterResume.id,
                company: exp.company,
                title: exp.title,
                location: exp.location || "",
                startDate: new Date(exp.startDate),
                endDate: exp.endDate ? new Date(exp.endDate) : null,
                current: exp.current,
                description: exp.description || null,
                achievements: {
                  create: exp.achievements.map((ach: any) => ({
                    description: ach.description,
                    metrics: ach.metrics || null,
                    impact: mapImpact(ach.impact),
                    keywords: ach.keywords || [],
                  })),
                },
                technologies: {
                  connectOrCreate: (exp.technologies || []).map(
                    (tech: string) => ({
                      where: { name: tech },
                      create: { name: tech, category: TechCategory.framework },
                    }),
                  ),
                },
              },
            });
          } catch (e: any) {
            // Ignore duplicates
            if (e.code !== "P2002") throw e;
          }
        }

        // Import projects
        for (const proj of data.projects) {
          try {
            await prisma.project.create({
              data: {
                resumeId: masterResume.id,
                name: proj.name,
                description: proj.description,
                role: proj.role || "",
                featured: proj.featured || false,
                startDate: new Date(proj.startDate),
                endDate: new Date(proj.endDate),
                githubUrl: proj.githubUrl || null,
                liveUrl: proj.liveUrl || null,
                achievements: proj.achievements || [],
                technologies: {
                  connectOrCreate: (proj.technologies || []).map(
                    (tech: string) => ({
                      where: { name: tech },
                      create: { name: tech, category: TechCategory.framework },
                    }),
                  ),
                },
              },
            });
          } catch (e: any) {
            // Ignore duplicates
            if (e.code !== "P2002") throw e;
          }
        }

        // Import skills
        for (const skill of data.skills) {
          try {
            await prisma.skill.create({
              data: {
                resumeId: masterResume.id,
                name: skill.name,
                category: skill.category,
                proficiency: mapProficiency(skill.proficiency),
                technologies: {
                  connectOrCreate: {
                    where: { name: skill.name },
                    create: {
                      name: skill.name,
                      category: TechCategory.language,
                    },
                  },
                },
              },
            });
          } catch (e: any) {
            // Ignore duplicates
            if (e.code !== "P2002") throw e;
          }
        }

        // Import education
        for (const edu of data.education) {
          await prisma.education.create({
            data: {
              resumeId: masterResume.id,
              institution: edu.institution,
              degree: edu.degree,
              field: edu.field,
              startDate: new Date(edu.startDate),
              endDate: edu.endDate ? new Date(edu.endDate) : null,
              gpa: edu.gpa || null,
            },
          });
        }

        // Import certifications
        for (const cert of data.certifications) {
          await prisma.certification.create({
            data: {
              resumeId: masterResume.id,
              name: cert.name,
              issuer: cert.issuer,
              issueDate: new Date(cert.issueDate),
              expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
              credentialId: cert.credentialId || null,
              url: cert.url || null,
            },
          });
        }

        dbSpinner.succeed("Import completed successfully!");
        logger.success(
          `Master resume imported from ${path.basename(filePath)}`,
        );
      } catch (error) {
        dbSpinner.fail("Database import failed");
        throw error;
      } finally {
        await prisma.$disconnect();
      }
    } catch (error: any) {
      logger.error("Import failed", error);
      console.log(chalk.red("\n❌ Import failed: " + error.message));
    }
  });

function mapImpact(impact?: string): Impact {
  if (!impact) return Impact.medium;
  const i = impact.toLowerCase();
  if (i === "high") return Impact.high;
  if (i === "low") return Impact.low;
  return Impact.medium;
}

function mapProficiency(p?: string): Proficiency {
  if (!p) return Proficiency.intermediate;
  const normalized = p.toLowerCase();
  if (normalized.includes("expert")) return Proficiency.expert;
  if (normalized.includes("advanced")) return Proficiency.advanced;
  if (normalized.includes("begin")) return Proficiency.beginner;
  return Proficiency.intermediate;
}
