// src/cli/commands/list.ts
import { Command } from "commander";
import chalk from "chalk";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";

export const listCommand = new Command("list")
  .description("List various entities (jobs, applications, resumes, etc.)")
  .option("--type <type>", "Type of entity to list (jobs|applications|resumes|companies|skills)", "jobs")
  .option("--limit <number>", "Number of items to show", "20")
  .option("--sort <field>", "Sort by field", "date")
  .action(async (options) => {
    try {
      const prisma = getPrismaClient();
      const limit = parseInt(options.limit);

      switch (options.type) {
        case "jobs":
          await listJobs(prisma, limit, options.sort);
          break;
        case "applications":
          await listApplications(prisma, limit, options.sort);
          break;
        case "resumes":
          await listResumes(prisma, limit);
          break;
        case "companies":
          await listCompanies(prisma, limit);
          break;
        case "skills":
          await listSkills(prisma, limit);
          break;
        default:
          console.log(chalk.red(`\n✗ Unknown type: ${options.type}`));
          console.log(chalk.yellow("\nAvailable types:"));
          console.log(chalk.gray("  • jobs - List analyzed job postings"));
          console.log(chalk.gray("  • applications - List job applications"));
          console.log(chalk.gray("  • resumes - List master resumes"));
          console.log(chalk.gray("  • companies - List companies"));
          console.log(chalk.gray("  • skills - List skills"));
          return;
      }
    } catch (error: any) {
      logger.error("Failed to list items", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });

async function listJobs(prisma: any, limit: number, sort: string) {
  const orderBy = sort === "match" ? 
    { skillsMatch: "desc" as const } : 
    { createdAt: "desc" as const };

  const jobs = await prisma.job.findMany({
    include: { company: true },
    orderBy,
    take: limit,
  });

  if (jobs.length === 0) {
    console.log(chalk.yellow("\n⚠️  No analyzed jobs found"));
    console.log(chalk.cyan("\n💡 To analyze a job:"));
    console.log(chalk.white("   npm run dev analyze <job-url> --save"));
    return;
  }

  console.log(chalk.bold.cyan(`\n📋 Analyzed Jobs (${jobs.length}):\n`));

  jobs.forEach((job: any, index: number) => {
    const matchColor = (job.skillsMatch || 0) >= 80 ? chalk.green :
                      (job.skillsMatch || 0) >= 60 ? chalk.yellow : chalk.red;

    console.log(chalk.white(`${index + 1}. ${job.title} at ${job.company?.name || "Unknown"}`));
    console.log(chalk.cyan(`   ID: ${job.id}`));
    console.log(chalk.gray(
      `   Level: ${job.experienceLevel || "N/A"} | Match: ${matchColor(`${job.skillsMatch || "N/A"}%`)} | Skills: ${job.requiredSkills.length} | ${new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    ));
    console.log();
  });
}

async function listApplications(prisma: any, limit: number, _sort: string) {
  const applications = await prisma.application.findMany({
    include: { 
      job: { 
        include: { company: true } 
      } 
    },
    orderBy: { createdAt: "desc" as const },
    take: limit,
  });

  if (applications.length === 0) {
    console.log(chalk.yellow("\n⚠️  No applications found"));
    console.log(chalk.cyan("\n💡 To apply for a job:"));
    console.log(chalk.white("   npm run dev apply <job-url>"));
    return;
  }

  console.log(chalk.bold.cyan(`\n📝 Applications (${applications.length}):\n`));

  applications.forEach((app: any, index: number) => {
    const statusColor = app.status === "applied" ? chalk.green :
                       app.status === "draft" ? chalk.yellow : chalk.gray;

    console.log(chalk.white(`${index + 1}. ${app.job.title} at ${app.job.company?.name || "Unknown"}`));
    console.log(chalk.cyan(`   ID: ${app.id}`));
    console.log(chalk.gray(
      `   Status: ${statusColor(app.status)} | ATS Score: ${app.atsScore || "N/A"}% | Applied: ${app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "Not yet"}`
    ));
    console.log();
  });
}

async function listResumes(prisma: any, limit: number) {
  const resumes = await prisma.masterResume.findMany({
    orderBy: { updatedAt: "desc" as const },
    take: limit,
  });

  if (resumes.length === 0) {
    console.log(chalk.yellow("\n⚠️  No master resumes found"));
    console.log(chalk.cyan("\n💡 To create a resume:"));
    console.log(chalk.white("   npm run dev init"));
    return;
  }

  console.log(chalk.bold.cyan(`\n📄 Master Resumes (${resumes.length}):\n`));

  resumes.forEach((resume: any, index: number) => {
    console.log(chalk.white(`${index + 1}. ${resume.fullName}`));
    console.log(chalk.cyan(`   ID: ${resume.id}`));
    console.log(chalk.gray(
      `   Email: ${resume.email} | Location: ${resume.location} | Updated: ${new Date(resume.updatedAt).toLocaleDateString()}`
    ));
    console.log();
  });
}

async function listCompanies(prisma: any, limit: number) {
  const companies = await prisma.company.findMany({
    orderBy: { lastResearched: "desc" as const },
    take: limit,
  });

  if (companies.length === 0) {
    console.log(chalk.yellow("\n⚠️  No companies found"));
    console.log(chalk.cyan("\n💡 Companies are added when analyzing jobs"));
    return;
  }

  console.log(chalk.bold.cyan(`\n🏢 Companies (${companies.length}):\n`));

  companies.forEach((company: any, index: number) => {
    console.log(chalk.white(`${index + 1}. ${company.name}`));
    console.log(chalk.cyan(`   ID: ${company.id}`));
    console.log(chalk.gray(
      `   Industry: ${company.industry || "N/A"} | Size: ${company.size || "N/A"} | Domain: ${company.domain || "N/A"}`
    ));
    console.log();
  });
}

async function listSkills(prisma: any, limit: number) {
  const skills = await prisma.skill.groupBy({
    by: ["name"],
    _count: { name: true },
    orderBy: { _count: { name: "desc" as const } },
    take: limit,
  });

  if (skills.length === 0) {
    console.log(chalk.yellow("\n⚠️  No skills found"));
    console.log(chalk.cyan("\n💡 Skills are extracted from resumes"));
    return;
  }

  console.log(chalk.bold.cyan(`\n🛠️  Top Skills (${skills.length}):\n`));

  skills.forEach((skill: any, index: number) => {
    console.log(chalk.white(`${index + 1}. ${skill.name}`));
    console.log(chalk.gray(`   Found in ${skill._count.name} resume(s)`));
    console.log();
  });
}