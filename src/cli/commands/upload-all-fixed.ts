// src/cli/commands/upload-all-fixed.ts
import { Command } from "commander";
import { logger } from "@/utils/logger";
import ora from "ora";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { getPrismaClient } from "@/database/client";
import { getResumeParserService } from "@/services/resume-parser.service";
import { ParsedResume } from "@/services/resume-parser.service";
import { Proficiency, Impact, TechCategory } from "@prisma/client";

export const uploadAllFixedCommand = new Command("upload-all")
  .description("Upload and parse ALL resume files")
  .option("--confirm", "Skip confirmation prompt")
  .action(async (options: { confirm?: boolean }) => {
    logger.header("Resume Batch Upload (Fixed)");

    const resumesDir = path.join(process.cwd(), "data", "resumes");

    // Check if directory exists
    if (!fs.existsSync(resumesDir)) {
      logger.error("Resumes directory not found");
      logger.info("Create directory first:");
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
      logger.info("Add PDF or DOCX files to directory and try again.");
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
          message: `Process all ${files.length} resume files and merge into one master resume?`,
          default: false,
        },
      ]);

      if (!shouldProceed) {
        logger.info("Upload cancelled.");
        return;
      }
    }

    // Process all files and merge data
    const prisma = getPrismaClient();
    const resumeParser = getResumeParserService();

    const mergedData: ParsedResume = {
      personalInfo: {
        fullName: "",
        email: "",
        phone: "",
        location: "",
        linkedInUrl: "",
        githubUrl: "",
        portfolioUrl: "",
      },
      summary: {
        short: "",
        long: "",
      },
      experiences: [],
      projects: [],
      skills: {
        technical: [],
        soft: [],
        languages: [],
        frameworks: [],
        tools: [],
        databases: [],
      },
      education: [],
      certifications: [],
    };

    let totalSkills = 0;
    const spinner = ora("Processing and merging all resumes...").start();

    try {
      // Parse and merge all files
      for (const file of files) {
        const filePath = path.join(resumesDir, file);

        try {
          const parsed = await resumeParser.parseResumeFile(filePath);

          // Use first file's personal info (most recent)
          if (
            mergedData.personalInfo.fullName === "" &&
            parsed.personalInfo.fullName
          ) {
            mergedData.personalInfo = parsed.personalInfo;
          }

          // Merge experiences (avoid duplicates by company+title)
          parsed.experiences.forEach((exp) => {
            const exists = mergedData.experiences.some(
              (existing) =>
                existing.company === exp.company &&
                existing.title === exp.title,
            );
            if (!exists) {
              mergedData.experiences.push(exp);
            }
          });

          // Merge projects (avoid duplicates by name)
          parsed.projects.forEach((proj) => {
            const exists = mergedData.projects.some(
              (existing) => existing.name === proj.name,
            );
            if (!exists) {
              mergedData.projects.push(proj);
            }
          });

          // Merge all skill categories (avoid duplicates)
          const skillCategories = [
            "technical",
            "languages",
            "frameworks",
            "tools",
            "databases",
            "soft",
          ] as const;
          skillCategories.forEach((category) => {
            const skills = parsed.skills[
              category as keyof typeof parsed.skills
            ] as string[];
            skills.forEach((skill) => {
              if (
                !mergedData.skills[
                  category as keyof typeof mergedData.skills
                ].includes(skill)
              ) {
                (
                  mergedData.skills[
                    category as keyof typeof mergedData.skills
                  ] as string[]
                ).push(skill);
                totalSkills++;
              }
            });
          });

          // Merge education
          parsed.education.forEach((edu) => {
            const exists = mergedData.education.some(
              (existing) =>
                existing.institution === edu.institution &&
                existing.degree === edu.degree,
            );
            if (!exists) {
              mergedData.education.push(edu);
            }
          });

          // Merge certifications
          parsed.certifications.forEach((cert) => {
            const exists = mergedData.certifications.some(
              (existing) =>
                existing.name === cert.name && existing.issuer === cert.issuer,
            );
            if (!exists) {
              mergedData.certifications.push(cert);
            }
          });

          spinner.text = `Processing ${file}...`;
        } catch (error) {
          logger.error(
            `Failed to process ${file}: ${(error as Error).message}`,
          );
        }
      }

      spinner.succeed("All resumes processed and merged!");

      // Save merged data to database
      spinner.start("Saving to database...");

      // Check if master resume exists
      let masterResume = await prisma.masterResume.findFirst();

      if (masterResume) {
        spinner.stop();
        const { overwrite } = await inquirer.prompt([
          {
            type: "confirm",
            name: "overwrite",
            message:
              "Master resume already exists. Overwrite with merged data?",
            default: false,
          },
        ]);

        if (!overwrite) {
          spinner.fail("Upload cancelled");
          return;
        }

        // Delete existing data
        spinner.start("Overwriting existing data...");
        await prisma.masterResume.delete({ where: { id: masterResume.id } });
      } else {
        spinner.text = "Creating master resume...";
      }

      // Create new master resume with merged data
      masterResume = await prisma.masterResume.create({
        data: {
          fullName: mergedData.personalInfo.fullName || "Unknown",
          email: mergedData.personalInfo.email || "unknown@example.com",
          phone: mergedData.personalInfo.phone || "",
          location: mergedData.personalInfo.location || "",
          linkedInUrl: mergedData.personalInfo.linkedInUrl,
          githubUrl: mergedData.personalInfo.githubUrl,
          portfolioUrl: mergedData.personalInfo.portfolioUrl,
          summaryShort: mergedData.summary.short || "",
          summaryLong:
            mergedData.summary.long || mergedData.summary.short || "",
        },
      });

      // Save all merged experiences
      for (const exp of mergedData.experiences) {
        try {
          await prisma.experience.create({
            data: {
              resume: {
                connect: {
                  id: masterResume.id,
                },
              },
              company: exp.company,
              title: exp.title,
              location: exp.location || "",
              startDate:
                exp.startDate && !isNaN(new Date(exp.startDate).getTime()) ?
                  new Date(exp.startDate)
                : new Date(),
              endDate:
                exp.endDate && !isNaN(new Date(exp.endDate).getTime()) ?
                  new Date(exp.endDate)
                : null,
              current: exp.current,
              description: exp.description,
              achievements: {
                create: exp.achievements.map((ach) => ({
                  description: ach.description,
                  metrics: ach.metrics,
                  impact: mapImpact(ach.impact),
                  keywords: [],
                })),
              },
            },
          });
        } catch (error: any) {
          if (error.code === "P2002") {
            // Duplicate experience, ignore
          } else {
            throw error;
          }
        }
      }

      // Save all merged projects
      for (const proj of mergedData.projects) {
        try {
          await prisma.project.create({
            data: {
              resume: {
                connect: {
                  id: masterResume.id,
                },
              },
              name: proj.name,
              description: proj.description,
              role: proj.role || "",
              githubUrl: proj.githubUrl,
              liveUrl: proj.liveUrl,
              startDate:
                proj.startDate && !isNaN(new Date(proj.startDate).getTime()) ?
                  new Date(proj.startDate)
                : new Date(),
              endDate:
                proj.endDate && !isNaN(new Date(proj.endDate).getTime()) ?
                  new Date(proj.endDate)
                : new Date(),
              achievements: proj.achievements,
              featured: false,
            },
          });
        } catch (error: any) {
          if (error.code === "P2002") {
            // Duplicate project, ignore
          } else {
            throw error;
          }
        }
      }

      // Save all merged education
      for (const edu of mergedData.education) {
        await prisma.education.create({
          data: {
            resume: {
              connect: {
                id: masterResume.id,
              },
            },
            institution: edu.institution,
            degree: edu.degree,
            field: edu.field,
            startDate:
              edu.startDate && !isNaN(new Date(edu.startDate).getTime()) ?
                new Date(edu.startDate)
              : new Date(),
            endDate:
              edu.endDate && !isNaN(new Date(edu.endDate).getTime()) ?
                new Date(edu.endDate)
              : null,
            gpa: edu.gpa,
          },
        });
      }

      // Save all merged certifications
      for (const cert of mergedData.certifications) {
        await prisma.certification.create({
          data: {
            resume: {
              connect: {
                id: masterResume.id,
              },
            },
            name: cert.name,
            issuer: cert.issuer || "",
            issueDate:
              cert.issueDate && !isNaN(new Date(cert.issueDate).getTime()) ?
                new Date(cert.issueDate)
              : new Date(),
            expiryDate:
              cert.expiryDate && !isNaN(new Date(cert.expiryDate).getTime()) ?
                new Date(cert.expiryDate)
              : null,
            credentialId: cert.credentialId,
            url: cert.url,
          },
        });
      }

      // SAVE ALL MERGED SKILLS - Optimized
      const allTechnicalSkills = [
        ...mergedData.skills.technical,
        ...mergedData.skills.languages,
        ...mergedData.skills.frameworks,
        ...mergedData.skills.tools,
        ...mergedData.skills.databases,
      ];

      await Promise.all(
        allTechnicalSkills.map(async (skill) => {
          try {
            await prisma.skill.create({
              data: {
                resume: {
                  connect: {
                    id: masterResume.id,
                  },
                },
                name: skill,
                category: "Technical",
                proficiency: Proficiency.intermediate,
                technologies: {
                  connectOrCreate: {
                    where: { name: skill },
                    create: {
                      name: skill,
                      category: TechCategory.language,
                    },
                  },
                },
              },
            });
          } catch (err) {
            // Ignore duplicate errors
          }
        }),
      );

      // Also save soft skills - Optimized
      await Promise.all(
        (mergedData.skills.soft || []).map(async (skill) => {
          try {
            await prisma.skill.create({
              data: {
                resume: {
                  connect: {
                    id: masterResume.id,
                  },
                },
                name: skill,
                category: "Soft Skills",
                proficiency: Proficiency.intermediate,
                technologies: {
                  connectOrCreate: {
                    where: { name: skill },
                    create: {
                      name: skill,
                      category: TechCategory.tool,
                    },
                  },
                },
              },
            });
          } catch (err) {
            // Ignore duplicate errors
          }
        }),
      );

      spinner.succeed("Saved merged data to database!");

      // Success summary
      logger.box(`
🎉 All Resumes Successfully Merged!

Files Processed: ${files.length}
Total Experiences: ${mergedData.experiences.length}
Total Projects: ${mergedData.projects.length}
Total Skills: ${totalSkills}
Total Education: ${mergedData.education.length}
Total Certifications: ${mergedData.certifications.length}

✨ Your master resume now contains data from ALL resume files!
      `);
    } catch (error) {
      spinner.fail("Upload failed");
      logger.error("Failed to process resumes", error);
    } finally {
      await prisma.$disconnect();
    }
  });

function mapImpact(impact?: string): Impact {
  if (!impact) return Impact.medium;
  const i = impact.toLowerCase();
  if (i === "high") return Impact.high;
  if (i === "low") return Impact.low;
  return Impact.medium;
}
