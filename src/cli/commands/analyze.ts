// src/cli/commands/analyze.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import { getJobAnalyzerAgent } from "@/agents/job-analyzer.agent";
import { getCompanyResearcherAgent } from "@/agents/company-researcher";
import { getJobRepository } from "@/database/repositories/job.repository";
import { gitHubSkillsService } from "@/services/github-skills.service";
import getPrismaClient from "@/database/client";
import { MatchResult } from "@/agents/job-analyzer.agent";

export const analyzeCommand = new Command("analyze")
  .description("Analyze a job posting and research the company")
  .argument("[job-url]", "URL of the job posting")
  .option("--no-save", "Skip saving to database", false)
  .option("--verbose", "Show detailed logging output", false)
  .action(async (jobUrl?: string, options?: any) => {
    // Save by default, only skip if --no-save is explicitly provided
    const opts = {
      save: !options?.noSave && process.env.NO_SAVE !== "true",
      verbose: options?.verbose || process.argv.includes("--verbose")
    };

    try {
      // If no URL provided, prompt for it
      if (!jobUrl) {
        const { url } = await inquirer.prompt([
          {
            type: "input",
            name: "url",
            message: "Enter job posting URL:",
            validate: (input) => {
              if (!input) return "URL is required";
              if (!input.startsWith("http"))
                return "URL must start with http:// or https://";
              return true;
            },
          },
        ]);
        jobUrl = url;
      }

      // Check database connection (always save by default)
      if (opts?.save) {
        const prisma = getPrismaClient();
        try {
          await prisma.$connect();
          if (opts?.verbose) {
            console.log(chalk.gray("✅ Database connection verified"));
          }
        } catch (dbError) {
          console.log(chalk.red("\n❌ Database Connection Failed"));
          console.log(
            chalk.red("   Cannot save analysis - database is not accessible"),
          );
          console.log(chalk.yellow("\n💡 Please check:"));
          console.log(chalk.gray("   • PostgreSQL is running"));
          console.log(chalk.gray("   • DATABASE_URL is correct in .env"));
          console.log(chalk.gray("   • Database 'resume_agent' exists"));
          console.log(chalk.gray("   • Run: npx prisma migrate dev"));
          throw dbError;
        }
      }

      logger.header("Job Analysis");
      console.log(chalk.cyan("📋 Analyzing:"), chalk.white(jobUrl));
      if (opts?.save) {
        console.log(chalk.green("💾 Will save results to database"));
      }
      console.log();

      // Step 1: Analyze job posting
      const jobAnalyzer = getJobAnalyzerAgent();
      const spinner = ora("Analyzing job posting...").start();

      const jobAnalysis = await jobAnalyzer.analyzeJobFromUrl(jobUrl!);

      if (!jobAnalysis.success || !jobAnalysis.data) {
        spinner.fail("Failed to analyze job");
        console.log(chalk.red("\n✗ Error: " + jobAnalysis.error));
        return;
      }

      spinner.succeed("Job posting analyzed!");

      const job = jobAnalysis.data;

      // Display job info
      console.log();
      logger.section("Job Information");
      console.log(chalk.bold(`  ${job.title}`));
      console.log(chalk.gray(`  ${job.company} • ${job.location}`));
      if (job.salary) console.log(chalk.green(`  💰 ${job.salary}`));
      if (job.jobType)
        console.log(
          chalk.gray(`  📍 ${job.jobType}${job.remote ? " (Remote)" : ""}`),
        );
      console.log(chalk.gray(`  📊 Level: ${job.experienceLevel}`));
      if (job.requiredYearsExperience) {
        console.log(
          chalk.gray(`  ⏳ ${job.requiredYearsExperience}+ years experience`),
        );
      }

      // Required skills
      if (job.requiredSkills.length > 0) {
        logger.section("Required Skills");
        job.requiredSkills.slice(0, 10).forEach((skill: string) => {
          console.log(chalk.white(`  • ${skill}`));
        });
        if (job.requiredSkills.length > 10) {
          console.log(
            chalk.gray(`  ... and ${job.requiredSkills.length - 10} more`),
          );
        }
      }

      // Preferred skills
      if (job.preferredSkills.length > 0) {
        logger.section("Preferred Skills");
        job.preferredSkills.slice(0, 5).forEach((skill: string) => {
          console.log(chalk.gray(`  • ${skill}`));
        });
        if (job.preferredSkills.length > 5) {
          console.log(
            chalk.gray(`  ... and ${job.preferredSkills.length - 5} more`),
          );
        }
      }

      // Tech stack
      if (job.techStack.length > 0) {
        logger.section("Tech Stack");
        console.log(chalk.cyan(`  ${job.techStack.join(", ")}`));
      }

      // Step 2: Calculate match score
      console.log();
      const matchSpinner = ora("Calculating match score...").start();

      const prisma = getPrismaClient();
      const masterResume = await prisma.masterResume.findFirst({
        include: {
          skills: true,
        },
      });

      let matchResult: MatchResult | undefined;

      if (masterResume) {
        if (opts?.verbose) {
          console.log(
            chalk.gray(`🔍 Found master resume: ${masterResume.fullName}`),
          );
          console.log(
            chalk.gray(`🔍 User has ${masterResume.skills.length} skills`),
          );
        }

        // Get user skills from master resume
        let userSkills = masterResume.skills.map((s) => s.name);

        // Enhance with GitHub skills (filter by confidence)
        try {
          const githubSkills = await gitHubSkillsService.extractSkills();
          // Only include skills with confidence >= 0.5 (medium threshold)
          const highConfidenceGithubSkills = githubSkills.filter(
            (s) => s.confidence >= 0.5,
          );
          const githubSkillNames = highConfidenceGithubSkills.map(
            (s) => s.name,
          );

          // Combine and deduplicate skills
          userSkills = [...new Set([...userSkills, ...githubSkillNames])];

          if (opts?.verbose) {
            console.log(
              chalk.gray(
                `🔍 Enhanced with ${githubSkillNames.length} high-confidence GitHub skills (from ${githubSkills.length} total)`,
              ),
            );
            console.log(chalk.gray(`🔍 Total skills: ${userSkills.length}`));
          }
        } catch (error) {
          if (opts?.verbose) {
            console.log(
              chalk.yellow(
                `⚠️  Could not fetch GitHub skills: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
          }
        }

        matchResult = jobAnalyzer.calculateMatchScore(userSkills, job);

        matchSpinner.succeed("Match score calculated!");

        // Display match score
        logger.section("Match Analysis");

        const scoreColor =
          matchResult.score >= 80
            ? chalk.green
            : matchResult.score >= 60
              ? chalk.yellow
              : chalk.red;

        console.log(scoreColor(`  🎯 Match Score: ${matchResult.score}%`));
        console.log();

        // Matched skills
        if (matchResult.matched.length > 0) {
          console.log(
            chalk.green(
              `  ✓ You have ${matchResult.matched.length} required skills:`,
            ),
          );
          matchResult.matched.slice(0, 5).forEach((skill: string) => {
            console.log(chalk.green(`    • ${skill}`));
          });
          if (matchResult.matched.length > 5) {
            console.log(
              chalk.gray(`    ... and ${matchResult.matched.length - 5} more`),
            );
          }
        }

        // Missing skills
        if (matchResult.missing.length > 0) {
          console.log();
          console.log(
            chalk.yellow(
              `  ⚠ Missing ${matchResult.missing.length} required skills:`,
            ),
          );
          matchResult.missing.slice(0, 5).forEach((skill: string) => {
            console.log(chalk.yellow(`    • ${skill}`));
          });
          if (matchResult.missing.length > 5) {
            console.log(
              chalk.gray(`    ... and ${matchResult.missing.length - 5} more`),
            );
          }
        }

        // Bonus skills
        if (matchResult.extras.length > 0) {
          console.log();
          console.log(
            chalk.blue(
              `  ⭐ Bonus: You have ${matchResult.extras.length} preferred skills`,
            ),
          );
        }
      } else {
        matchSpinner.warn("No master resume found - skipping match analysis");
        console.log(chalk.yellow("  ⚠️  No master resume found in database"));
        console.log(
          chalk.yellow("  💡 To set up your resume: npm run dev init"),
        );
        console.log(
          chalk.yellow(
            "  💡 To upload resume: npm run dev upload <resume-file>",
          ),
        );

        if (opts?.verbose) {
          console.log(
            chalk.gray("🔍 Checked database for MasterResume but found none"),
          );
        }
      }

      // Step 3: Research company
      console.log();
      const companySpinner = ora("Researching company...").start();

      const companyResearcher = getCompanyResearcherAgent();
      const companyResult = await companyResearcher.researchCompany(
        job.company,
      );

      if (companyResult.success && companyResult.data) {
        companySpinner.succeed("Company researched!");

        const company = companyResult.data;

        logger.section("Company Information");
        console.log(chalk.bold(`  ${company.name}`));
        if (company.domain) console.log(chalk.gray(`  🌐 ${company.domain}`));
        if (company.industry)
          console.log(chalk.gray(`  🏢 ${company.industry}`));
        if (company.size) console.log(chalk.gray(`  👥 ${company.size}`));
        if (company.headquarters)
          console.log(chalk.gray(`  📍 ${company.headquarters}`));

        // Values
        if (company.values.length > 0) {
          console.log();
          console.log(chalk.cyan("  Values:"));
          company.values.slice(0, 5).forEach((value: string) => {
            console.log(chalk.gray(`    • ${value}`));
          });
        }

        // Tech stack
        if (company.techStack.length > 0) {
          console.log();
          console.log(chalk.cyan("  Tech Stack:"));
          console.log(chalk.white(`    ${company.techStack.join(", ")}`));
        }

        // Recent news
        if (company.recentNews.length > 0) {
          console.log();
          console.log(chalk.cyan("  Recent News:"));
          company.recentNews.slice(0, 3).forEach((news: any) => {
            console.log(chalk.white(`    • ${news.title}`));
            if (news.summary) {
              console.log(
                chalk.gray(`      ${news.summary.substring(0, 80)}...`),
              );
            }
          });
        }
      } else {
        companySpinner.warn("Could not research company");
      }

      // Step 4: Save to database
      if (opts?.save) {
        console.log();
        const saveSpinner = ora("Saving to database...").start();

        try {
          if (opts?.verbose) {
            console.log(chalk.gray("🔍 Connecting to database..."));
          }

          const jobRepo = getJobRepository();

          if (opts?.verbose) {
            console.log(chalk.gray("🔍 Saving company information..."));
          }

          // Save company
          const companyName = job.company || "Unknown Company";
          if (!companyName || companyName === "null") {
            throw new Error("Company name is missing or invalid");
          }

          const savedCompany = await jobRepo.upsertCompany({
            name: companyName,
            domain: companyResult.data?.domain,
            industry: companyResult.data?.industry,
            size: companyResult.data?.size,
            founded: companyResult.data?.founded,
            headquarters: companyResult.data?.headquarters,
            values: companyResult.data?.values || [],
            workStyle: companyResult.data?.workStyle || [],
            benefits: companyResult.data?.benefits || [],
            techStack: companyResult.data?.techStack || [],
            recentNews: companyResult.data?.recentNews,
          });

          if (opts?.verbose) {
            console.log(
              chalk.gray(
                `✅ Company saved: ${savedCompany.name} (ID: ${savedCompany.id})`,
              ),
            );
            console.log(chalk.gray("🔍 Saving job information..."));
          }

// Save job
          const jobTitle = job.title || "Software Engineer"; // Fallback title
          const uniqueTitle = `${jobTitle} - ${new Date().toISOString().split('T')[0]}`; // Add date to make unique
          console.log(`DEBUG: Saving job with title: "${uniqueTitle}"`);
          console.log(`DEBUG: Company ID: ${savedCompany.id}`);
          
          const savedJob = await jobRepo.createJob({
            companyId: savedCompany.id,
            title: uniqueTitle,
            url: jobUrl,
            location: job.location || "Remote",
            salary: job.salary,
            rawDescription: "Job description", // We'd store full text
            requiredSkills: job.requiredSkills,
            preferredSkills: job.preferredSkills,
            responsibilities: job.responsibilities,
            qualifications: job.qualifications,
            keywords: job.keywords,
            skillsMatch: matchResult?.score,
            experienceLevel: job.experienceLevel,
          });
          
          console.log(`DEBUG: Job saved with ID: ${savedJob.id}`);

          saveSpinner.succeed("Saved to database!");
          console.log(chalk.green(`  ✓ Company: ${savedCompany.name}`));
          console.log(chalk.green(`  ✓ Job: ${job.title}`));
          console.log(chalk.gray(`  🆔 Job ID: ${savedJob.id}`));

          if (opts?.verbose) {
            console.log(
              chalk.gray(`📊 Match Score: ${matchResult?.score || "N/A"}%`),
            );
            console.log(
              chalk.gray(`🔧 Required Skills: ${job.requiredSkills.length}`),
            );
            console.log(
              chalk.gray(`⭐ Preferred Skills: ${job.preferredSkills.length}`),
            );
          }
        } catch (error) {
          saveSpinner.fail("Failed to save to database");
          console.log(chalk.red("\n❌ Save Error Details:"));

          if (error instanceof Error) {
            console.log(chalk.red(`   Message: ${error.message}`));
            if (opts?.verbose && error.stack) {
              console.log(chalk.gray(`   Stack: ${error.stack}`));
            }
          } else {
            console.log(
              chalk.red(`   Unknown error: ${JSON.stringify(error, null, 2)}`),
            );
          }

          console.log(chalk.yellow("\n💡 Possible solutions:"));
          console.log(chalk.gray("   • Check if PostgreSQL is running"));
          console.log(chalk.gray("   • Verify DATABASE_URL in .env file"));
          console.log(chalk.gray("   • Run: npx prisma migrate dev"));
          console.log(chalk.gray("   • Run: npx prisma generate"));

          logger.error("Save failed", error);
        }
      }

      // Summary
      console.log();
      logger.box(`
Analysis Complete! ✓

Match Score: ${matchResult?.score || "N/A"}%
Required Skills: ${job.requiredSkills.length}
Your Matched Skills: ${matchResult?.matched.length || 0}

Next steps:
  ${opts?.save ? "✓ Analysis saved to database" : "• Add --save to save this analysis"}
  ${opts?.verbose ? "✓ Verbose logging enabled" : "• Add --verbose for detailed output"}
  • Generate tailored resume: npm run dev tailor <job-id>
  • Apply for this job: npm run dev apply ${jobUrl}
      `);
    } catch (error: any) {
      logger.error("Analysis failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });
