import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import fs from "fs";
import path from "path";
import { logger } from "@/utils/logger";
import { getResumeParserService } from "@/services/resume-parser.service";
import getPrismaClient from "@/database/client";

export const uploadAllCommand = new Command("upload-all")
  .description("Upload and parse ALL resume files from data/resumes folder")
  .option("--confirm", "Skip confirmation prompt")
  .action(async (options: { confirm?: boolean }) => {
    try {
      const resumesDir = path.join(process.cwd(), "data", "resumes");

      // Check if directory exists
      if (!fs.existsSync(resumesDir)) {
        logger.error(`Resumes directory not found: ${resumesDir}`);
        logger.info("Create the directory and add resume files:");
        logger.info("  mkdir -p data/resumes");
        logger.info("  # Copy your PDF/DOCX files to data/resumes/");
        return;
      }

      // Find all resume files
      const files = fs.readdirSync(resumesDir).filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return ext === ".pdf" || ext === ".docx" || ext === ".doc";
      });

      if (files.length === 0) {
        logger.warn("No resume files found in data/resumes/");
        logger.info("Add PDF or DOCX files to the directory and try again.");
        return;
      }

      logger.info(`Found ${files.length} resume file(s):`);
      files.forEach((file) => {
        logger.info(`  • ${file}`);
      });

      // Confirm before processing all files
      if (!options.confirm) {
        const { shouldProceed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "shouldProceed",
            message: `Process all ${files.length} resume files?`,
            default: false,
          },
        ]);

        if (!shouldProceed) {
          logger.info("Upload cancelled.");
          return;
        }
      }

      // Process each file
      const prisma = getPrismaClient();
      const resumeParser = getResumeParserService();

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const file of files) {
        const filePath = path.join(resumesDir, file);
        const spinner = ora(`Processing ${file}...`).start();

        try {
          // Parse resume
          const parsed = await resumeParser.parseResumeFile(filePath);

          // Save to database (reuse existing logic)
          const masterResume = await prisma.masterResume.create({
            data: {
              version: 1,
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

          // Save experiences, projects, education, certifications, and SKILLS
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
                startDate: proj.startDate
                  ? new Date(proj.startDate)
                  : new Date(),
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
                issueDate: cert.issueDate
                  ? new Date(cert.issueDate)
                  : new Date(),
                expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
                credentialId: cert.credentialId,
                url: cert.url,
              },
            });
          }

          // SAVE SKILLS - THIS WAS MISSING!
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

          successCount++;
          spinner.succeed(`✅ ${file} uploaded successfully`);
        } catch (error) {
          errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          errors.push(`${file}: ${errorMsg}`);
          spinner.fail(`❌ ${file} failed: ${errorMsg}`);
        }
      }

      // Summary
      logger.info(`\n📊 Upload Summary:`);
      logger.info(`  ✅ Success: ${successCount} files`);
      if (errorCount > 0) {
        logger.info(`  ❌ Errors: ${errorCount} files`);
        logger.info(`\nError details:`);
        errors.forEach((error) => logger.info(`  • ${error}`));
      }
    } catch (error) {
      logger.error("Bulk upload failed:", error);
    }
  });
