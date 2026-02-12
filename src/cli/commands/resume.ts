// src/cli/commands/resume.ts
import { Command } from "commander";
import chalk from "chalk";
import { logger } from "@/utils/logger";
import { PrismaClient } from "@prisma/client";
import inquirer from "inquirer";
import { ResumeRepository } from "@/database/repositories/resume.repository";
import {
  promptExperience,
  promptProject,
  promptSkill,
  promptEducation,
} from "@/cli/utils/prompts";

export const resumeCommand = new Command("resume").description(
  "Manage your master resume",
);

// Update profile
resumeCommand
  .command("profile")
  .description("Update personal profile information")
  .action(async () => {
    const prisma = new PrismaClient();
    const resumeRepo = new ResumeRepository(prisma);

    try {
      const masterResume = await resumeRepo.getMasterResume();
      if (!masterResume) {
        console.log(chalk.red("❌ No master resume found."));
        return;
      }

      console.log(chalk.bold.cyan("\n👤 Update Profile Information"));

      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "fullName",
          message: "Full Name:",
          default: masterResume.fullName,
        },
        {
          type: "input",
          name: "email",
          message: "Email:",
          default: masterResume.email,
        },
        {
          type: "input",
          name: "phone",
          message: "Phone:",
          default: masterResume.phone,
        },
        {
          type: "input",
          name: "location",
          message: "Location:",
          default: masterResume.location,
        },
        {
          type: "input",
          name: "linkedInUrl",
          message: "LinkedIn URL:",
          default: masterResume.linkedInUrl,
        },
        {
          type: "input",
          name: "githubUrl",
          message: "GitHub URL:",
          default: masterResume.githubUrl,
        },
        {
          type: "input",
          name: "portfolioUrl",
          message: "Portfolio URL:",
          default: masterResume.portfolioUrl,
        },
      ]);

      await resumeRepo.updateMasterResume(masterResume.id, answers);
      console.log(chalk.green("\n✅ Profile updated successfully!"));
    } catch (error) {
      console.log(chalk.red("❌ Error updating profile:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      await prisma.$disconnect();
    }
  });

// Add experience
resumeCommand
  .command("add-experience")
  .alias("add-exp")
  .description("Add a work experience")
  .action(async () => {
    const prisma = new PrismaClient();
    const resumeRepo = new ResumeRepository(prisma);

    try {
      // Check if master resume exists
      const masterResume = await resumeRepo.getMasterResume();
      if (!masterResume) {
        console.log(chalk.red("❌ No master resume found."));
        console.log(chalk.cyan("\n💡 Create a master resume first:"));
        console.log(chalk.white("   npm run dev init"));
        return;
      }

      // Prompt for experience details
      const experienceData = await promptExperience();

      console.log(chalk.bold.cyan("\n📝 Adding Experience..."));

      // Add experience to database
      const experience = await resumeRepo.addExperience(
        masterResume.id,
        experienceData,
      );

      console.log(chalk.green("✅ Experience added successfully!"));
      console.log(chalk.white(`ID: ${experience.id}`));
      console.log(chalk.white(`Company: ${experience.company}`));
      console.log(chalk.white(`Title: ${experience.title}`));
      console.log(
        chalk.white(`Achievements: ${experience.achievements.length}`),
      );
      console.log(
        chalk.white(`Technologies: ${experience.technologies.length}`),
      );

      // TODO: Generate embeddings when embeddings service is implemented
      // console.log(chalk.green("✓ Embeddings generated for RAG search"));
    } catch (error) {
      console.log(chalk.red("❌ Error adding experience:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Failed to add experience", error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Add project
resumeCommand
  .command("add-project")
  .description("Add a project")
  .action(async () => {
    const prisma = new PrismaClient();
    const resumeRepo = new ResumeRepository(prisma);

    try {
      // Check if master resume exists
      const masterResume = await resumeRepo.getMasterResume();
      if (!masterResume) {
        console.log(chalk.red("❌ No master resume found."));
        console.log(chalk.cyan("\n💡 Create a master resume first:"));
        console.log(chalk.white("   npm run dev init"));
        return;
      }

      // Prompt for project details
      const projectData = await promptProject();

      console.log(chalk.bold.cyan("\n📝 Adding Project..."));

      // Add project to database
      const project = await resumeRepo.addProject(masterResume.id, projectData);

      console.log(chalk.green("✅ Project added successfully!"));
      console.log(chalk.white(`ID: ${project.id}`));
      console.log(chalk.white(`Name: ${project.name}`));
      console.log(chalk.white(`Role: ${project.role}`));
      console.log(chalk.white(`Achievements: ${project.achievements.length}`));
      console.log(chalk.white(`Technologies: ${project.technologies.length}`));
    } catch (error) {
      console.log(chalk.red("❌ Error adding project:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Failed to add project", error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Add skill
resumeCommand
  .command("add-skill")
  .description("Add a skill")
  .action(async () => {
    const prisma = new PrismaClient();
    const resumeRepo = new ResumeRepository(prisma);

    try {
      // Check if master resume exists
      const masterResume = await resumeRepo.getMasterResume();
      if (!masterResume) {
        console.log(chalk.red("❌ No master resume found."));
        console.log(chalk.cyan("\n💡 Create a master resume first:"));
        console.log(chalk.white("   npm run dev init"));
        return;
      }

      // Prompt for skill details
      const skillData = await promptSkill();

      console.log(chalk.bold.cyan("\n📝 Adding Skill..."));

      // Add skill to database
      const skill = await resumeRepo.addSkill(masterResume.id, skillData);

      console.log(chalk.green("✅ Skill added successfully!"));
      console.log(chalk.white(`ID: ${skill.id}`));
      console.log(chalk.white(`Name: ${skill.name}`));
      console.log(chalk.white(`Category: ${skill.category}`));
      console.log(chalk.white(`Level: ${skill.proficiency}`));
      if (skillData.yearsOfExperience) {
        console.log(
          chalk.white(`Experience: ${skillData.yearsOfExperience} years`),
        );
      }
    } catch (error) {
      console.log(chalk.red("❌ Error adding skill:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Failed to add skill", error);
    } finally {
      await prisma.$disconnect();
    }
  });

// List all
resumeCommand
  .command("list")
  .description("List your resume data")
  .action(async () => {
    const prisma = new PrismaClient();
    const resumeRepo = new ResumeRepository(prisma);

    try {
      console.log(chalk.bold.blue("📋 Master Resume Data"));
      console.log(chalk.gray("─".repeat(50)));

      const masterResume = await resumeRepo.getMasterResume();

      if (!masterResume) {
        console.log(chalk.yellow("⚠️  No master resume found."));
        console.log(chalk.cyan("\n💡 To create a master resume:"));
        console.log(chalk.white("   npm run dev upload <resume-file>"));
        return;
      }

      // Personal Info
      console.log(chalk.bold.cyan("\n👤 Personal Information:"));
      console.log(chalk.white(`   Name: ${masterResume.fullName}`));
      console.log(chalk.white(`   Email: ${masterResume.email}`));
      console.log(chalk.white(`   Location: ${masterResume.location}`));
      if (masterResume.linkedInUrl) {
        console.log(chalk.white(`   LinkedIn: ${masterResume.linkedInUrl}`));
      }

      // Experience Summary
      console.log(chalk.bold.cyan("\n💼 Experience Summary:"));
      if (masterResume.experiences.length > 0) {
        masterResume.experiences.forEach((exp, index) => {
          console.log(
            chalk.white(`   ${index + 1}. ${exp.title} at ${exp.company}`),
          );
          console.log(
            chalk.gray(
              `      ${exp.startDate.getFullYear()} - ${exp.current ? "Present" : exp.endDate?.getFullYear()}`,
            ),
          );
          console.log(
            chalk.gray(`      ${exp.achievements.length} achievements`),
          );
        });
      } else {
        console.log(chalk.gray("   No experiences found"));
      }

      // Projects Summary
      console.log(chalk.bold.cyan("\n🚀 Projects:"));
      if (masterResume.projects.length > 0) {
        masterResume.projects.forEach((project, index) => {
          console.log(chalk.white(`   ${index + 1}. ${project.name}`));
          console.log(chalk.gray(`      Role: ${project.role}`));
          console.log(
            chalk.gray(`      ${project.achievements.length} achievements`),
          );
        });
      } else {
        console.log(chalk.gray("   No projects found"));
      }

      // Skills Summary
      console.log(chalk.bold.cyan("\n🛠️ Skills:"));
      if (masterResume.skills.length > 0) {
        const skillsByCategory = masterResume.skills.reduce(
          (acc, skill) => {
            if (!acc[skill.category]) acc[skill.category] = [];
            acc[skill.category].push(skill.name);
            return acc;
          },
          {} as Record<string, string[]>,
        );

        Object.entries(skillsByCategory).forEach(([category, skills]) => {
          console.log(chalk.white(`   ${category}: ${skills.join(", ")}`));
        });
      } else {
        console.log(chalk.gray("   No skills found"));
      }

      // Education Summary
      console.log(chalk.bold.cyan("\n🎓 Education:"));
      if (masterResume.education.length > 0) {
        masterResume.education.forEach((edu, index) => {
          console.log(
            chalk.white(`   ${index + 1}. ${edu.degree} in ${edu.field}`),
          );
          console.log(chalk.gray(`      ${edu.institution}`));
        });
      } else {
        console.log(chalk.gray("   No education found"));
      }

      // Summary Stats
      console.log(chalk.bold.cyan("\n📊 Summary:"));
      console.log(
        chalk.white(`   Total Experiences: ${masterResume.experiences.length}`),
      );
      console.log(
        chalk.white(`   Total Projects: ${masterResume.projects.length}`),
      );
      console.log(
        chalk.white(`   Total Skills: ${masterResume.skills.length}`),
      );
      console.log(
        chalk.white(
          `   Total Achievements: ${masterResume.experiences.reduce((sum, exp) => sum + exp.achievements.length, 0)}`,
        ),
      );

      console.log(
        chalk.green("\n✅ Use the export command to get complete data:"),
      );
      console.log(
        chalk.white("   npm run dev export --format json --type master"),
      );
    } catch (error) {
      console.log(chalk.red("❌ Error fetching resume data:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      await prisma.$disconnect();
    }
  });

// Add education
resumeCommand
  .command("add-education")
  .description("Add education")
  .action(async () => {
    const prisma = new PrismaClient();
    const resumeRepo = new ResumeRepository(prisma);

    try {
      // Check if master resume exists
      const masterResume = await resumeRepo.getMasterResume();
      if (!masterResume) {
        console.log(chalk.red("❌ No master resume found."));
        console.log(chalk.cyan("\n💡 Create a master resume first:"));
        console.log(chalk.white("   npm run dev init"));
        return;
      }

      // Prompt for education details
      const educationData = await promptEducation();

      console.log(chalk.bold.cyan("\n📝 Adding Education..."));

      // Add education to database
      const education = await resumeRepo.addEducation(
        masterResume.id,
        educationData,
      );

      console.log(chalk.green("✅ Education added successfully!"));
      console.log(chalk.white(`ID: ${education.id}`));
      console.log(chalk.white(`Institution: ${education.institution}`));
      console.log(chalk.white(`Degree: ${education.degree}`));
      console.log(chalk.white(`Field: ${education.field}`));
      console.log(chalk.white(`Start: ${education.startDate.getFullYear()}`));
      if (education.endDate) {
        console.log(chalk.white(`End: ${education.endDate.getFullYear()}`));
      } else {
        console.log(chalk.white("Status: Current"));
      }
      if (education.gpa) {
        console.log(chalk.white(`GPA: ${education.gpa}`));
      }
    } catch (error) {
      console.log(chalk.red("❌ Error adding education:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Failed to add education", error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Edit entries
resumeCommand
  .command("edit <type> <id>")
  .description("Edit an entry (experience, project, skill, education)")
  .action(async (type: string, id: string) => {
    const prisma = new PrismaClient();
    const resumeRepo = new ResumeRepository(prisma);

    try {
      // Check if master resume exists
      const masterResume = await resumeRepo.getMasterResume();
      if (!masterResume) {
        console.log(chalk.red("❌ No master resume found."));
        return;
      }

      let entry;
      switch (type.toLowerCase()) {
        case "experience":
        case "exp":
          entry = await resumeRepo.getExperienceById(id);
          break;
        case "project":
          entry = await resumeRepo.getProjectById(id);
          break;
        case "skill":
          entry = await resumeRepo.getSkillById(id);
          break;
        case "education":
        case "edu":
          entry = await resumeRepo.getEducationById(id);
          break;
        default:
          console.log(
            chalk.red(
              "❌ Invalid type. Use: experience, project, skill, or education",
            ),
          );
          return;
      }

      if (!entry) {
        console.log(chalk.red(`❌ ${type} with ID ${id} not found`));
        return;
      }

      console.log(chalk.bold.cyan(`\n📝 Current ${type}:`));
      console.log(chalk.gray(JSON.stringify(entry, null, 2)));

      console.log(chalk.yellow("\n⚠️  Edit functionality coming soon!"));
      console.log(chalk.cyan("For now, you can delete and re-add entries."));
    } catch (error) {
      console.log(chalk.red("❌ Error editing entry:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Failed to edit entry", error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Delete entries
resumeCommand
  .command("delete <type> <id>")
  .alias("rm")
  .description("Delete an entry (experience, project, skill, education)")
  .action(async (type: string, id: string) => {
    const prisma = new PrismaClient();
    const resumeRepo = new ResumeRepository(prisma);

    try {
      // Check if master resume exists
      const masterResume = await resumeRepo.getMasterResume();
      if (!masterResume) {
        console.log(chalk.red("❌ No master resume found."));
        return;
      }

      let entry;
      switch (type.toLowerCase()) {
        case "experience":
        case "exp":
          entry = await resumeRepo.getExperienceById(id);
          break;
        case "project":
          entry = await resumeRepo.getProjectById(id);
          break;
        case "skill":
          entry = await resumeRepo.getSkillById(id);
          break;
        case "education":
        case "edu":
          entry = await resumeRepo.getEducationById(id);
          break;
        default:
          console.log(
            chalk.red(
              "❌ Invalid type. Use: experience, project, skill, or education",
            ),
          );
          return;
      }

      if (!entry) {
        console.log(chalk.red(`❌ ${type} with ID ${id} not found`));
        return;
      }

      console.log(chalk.bold.cyan(`\n🗑️  Delete ${type}:`));
      console.log(
        chalk.white(
          `${(entry as any).company || (entry as any).name || (entry as any).institution || (entry as any).name}`,
        ),
      );

      // In a real implementation, you'd add confirmation here
      console.log(
        chalk.yellow(
          "\n⚠️  Delete functionality will be implemented with confirmation.",
        ),
      );
    } catch (error) {
      console.log(chalk.red("❌ Error deleting entry:"));
      console.log(
        chalk.white(error instanceof Error ? error.message : "Unknown error"),
      );
      logger.error("Failed to delete entry", error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Export
resumeCommand
  .command("export")
  .description("Export your master resume as JSON")
  .action(async () => {
    logger.info("Export command - Coming in Week 2");
    console.log(chalk.yellow("This feature will be implemented in Phase 2"));
  });
