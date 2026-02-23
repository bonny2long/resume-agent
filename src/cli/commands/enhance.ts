// src/cli/commands/enhance.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { logger } from "@/utils/logger";
import { getAchievementQuantifierAgent } from "@/agents/resume/achievement-quantifier.agent";
import { getATSOptimizerAgent } from "@/agents/resume/ats-optimizer.agent";
import { getHarvardSummaryAgent } from "@/agents/resume/harvard-summary.agent";
import { getBehavioralCoachAgent } from "@/agents/interview/behavioral-coach.agent";
import { getLinkedInOptimizerAgent } from "@/agents/linkedin/linkedin-optimizer.agent";
import { getSalaryNegotiatorAgent } from "@/agents/career/salary-negotiator.agent";
import { getPersonalBrandAgent } from "@/agents/career/personal-brand.agent";
import { getCareerPivotAgent } from "@/agents/career/career-pivot.agent";
import { getInterviewExportService } from "@/services/interview-export.service";
import { getCareerExportService } from "@/services/career-export.service";
import getPrismaClient from "@/database/client";

export const enhanceCommand = new Command("enhance")
  .description("Enhanced tools: resume, interview, LinkedIn, career tools")
  .argument("[action]", "Action: quantify | ats | summary | interview | linkedin | salary | brand | pivot")
  .argument("[target]", "Optional target (job-id, role, etc)")
  .option("--export", "Export to PDF/DOCX (for interview stories)")
  .action(async (action?: string, target?: string, options?: { export?: boolean }) => {
    try {
      if (!action) {
        console.log(chalk.bold.cyan("\n📝 Enhancement Tools\n"));
        console.log(chalk.bold.cyan("\nResume Tools:"));
        console.log(chalk.gray("  quantify    - Quantify achievements with McKinsey-style metrics"));
        console.log(chalk.gray("  ats         - ATS optimization report"));
        console.log(chalk.gray("  summary     - Generate 5 summary versions (Harvard-style)"));
        console.log(chalk.bold.cyan("\nInterview Tools:"));
        console.log(chalk.gray("  interview   - STAR story bank for behavioral questions"));
        console.log(chalk.gray("  interview --export  - Generate and export to DOCX"));
        console.log(chalk.bold.cyan("\nLinkedIn Tools:"));
        console.log(chalk.gray("  linkedin    - Optimize LinkedIn profile for recruiters"));
        console.log(chalk.bold.cyan("\nCareer Tools:"));
        console.log(chalk.gray("  salary      - Salary negotiation strategy (Robert Half)"));
        console.log(chalk.gray("  brand       - Personal brand strategy (Heidrick & Struggles"));
        console.log(chalk.gray("  pivot       - Career pivot plan (Korn Ferry)"));
        console.log();
        console.log(chalk.cyan("Usage:"));
        console.log(chalk.white("   npm run dev enhance quantify"));
        console.log(chalk.white("   npm run dev enhance ats <job-id>"));
        console.log(chalk.white("   npm run dev enhance summary <job-id>"));
        console.log(chalk.white("   npm run dev enhance interview <role>"));
        console.log(chalk.white("   npm run dev enhance interview <role> --export"));
        console.log(chalk.white("   npm run dev enhance linkedin <role>"));
        console.log(chalk.white("   npm run dev enhance salary <job-id>"));
        console.log(chalk.white("   npm run dev enhance salary --export"));
        console.log(chalk.white("   npm run dev enhance brand <role>"));
        console.log(chalk.white("   npm run dev enhance pivot <target-role>"));
        console.log(chalk.white("   npm run dev enhance pivot --export"));
        return;
      }

      switch (action.toLowerCase()) {
        case "quantify":
          await runQuantify(target);
          break;
        case "ats":
          await runATS(target);
          break;
        case "summary":
          await runSummary(target);
          break;
        case "interview":
          await runInterview(target, options?.export);
          break;
        case "linkedin":
          await runLinkedIn(target);
          break;
        case "salary":
          await runSalary(target, options?.export);
          break;
        case "brand":
          await runBrand(target);
          break;
        case "pivot":
          await runPivot(target, options?.export);
          break;
        default:
          console.log(chalk.red(`Unknown action: ${action}`));
          console.log(chalk.yellow("Valid actions: quantify, ats, summary, interview, linkedin, salary, brand, pivot"));
      }
    } catch (error: any) {
      logger.error("Enhance command failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });

async function runQuantify(jobId?: string) {
  const spinner = ora("Quantifying achievements...").start();

  const agent = getAchievementQuantifierAgent();

  let result;
  if (jobId) {
    result = await agent.quantifyJobAchievements(jobId);
  } else {
    result = await agent.quantifyResumeAchievements();
  }

  if (!result.success || !result.data) {
    spinner.fail("Failed to quantify achievements");
    console.log(chalk.red("\n✗ Error: " + result.error));
    return;
  }

  spinner.succeed("Achievements quantified!");

  const { achievements, summary } = result.data;

  console.log(chalk.bold.cyan("\n📊 Quantification Summary:\n"));
  console.log(chalk.white(`  Total Quantified: ${summary.totalQuantified}`));
  console.log(chalk.green(`  With Revenue Impact: ${summary.withRevenueImpact}`));
  console.log(chalk.green(`  With Scale Metrics: ${summary.withScaleMetrics}`));
  console.log(chalk.green(`  With Time Improvements: ${summary.withTimeImprovements}`));
  console.log(chalk.green(`  With Percentage Gains: ${summary.withPercentageGains}`));

  console.log(chalk.bold.cyan("\n📝 Quantified Achievements:\n"));

  achievements.forEach((ach, index) => {
    console.log(chalk.yellow(`\n${index + 1}. ORIGINAL:`));
    console.log(chalk.gray(`   ${ach.original}`));
    console.log(chalk.green(`\n   REWRITTEN:`));
    console.log(chalk.white(`   ${ach.rewritten}`));
    if (ach.context) {
      console.log(chalk.cyan(`\n   CONTEXT: ${ach.context}`));
    }
  });

  console.log(chalk.bold.cyan("\n✨ All achievements quantified with STAR method!"));
}

async function runATS(jobId?: string) {
  if (!jobId) {
    const prisma = getPrismaClient();
    const recentJobs = await prisma.job.findMany({
      include: { company: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (recentJobs.length === 0) {
      console.log(chalk.yellow("⚠️  No analyzed jobs found"));
      console.log(chalk.cyan("\n💡 Analyze a job first:"));
      console.log(chalk.white("   npm run dev analyze <job-url> --save"));
      return;
    }

    console.log(chalk.bold.cyan("\n📋 Select a job for ATS optimization:\n"));
    recentJobs.forEach((job, index) => {
      console.log(
        chalk.white(`${index + 1}. ${job.title} at ${job.company?.name || "Unknown"}`),
      );
    });

    const { selectedIndex } = await inquirer.prompt([
      {
        type: "input",
        name: "selectedIndex",
        message: "Enter job number:",
        validate: (input) => {
          const num = parseInt(input);
          if (!num || num < 1 || num > recentJobs.length) {
            return `Enter a number between 1 and ${recentJobs.length}`;
          }
          return true;
        },
      },
    ]);

    jobId = recentJobs[parseInt(selectedIndex) - 1].id;
  }

  const spinner = ora("Analyzing ATS optimization...").start();

  const agent = getATSOptimizerAgent();
  const result = await agent.optimizeForATS(jobId);

  if (!result.success || !result.data) {
    spinner.fail("Failed to analyze ATS");
    console.log(chalk.red("\n✗ Error: " + result.error));
    return;
  }

  spinner.succeed("ATS analysis complete!");

  const report = result.data;

  console.log(chalk.bold.cyan("\n🎯 ATS Optimization Report\n"));
  console.log(chalk.white(`  Overall Score: ${report.overallScore}/100`));
  console.log(chalk.white(`  ATS Match: ${report.atsEstimatedMatch}/100`));

  console.log(chalk.bold.cyan("\n📊 Section Scores:\n"));
  console.log(chalk.white(`  Summary: ${report.sectionScores.summary}/100`));
  console.log(chalk.white(`  Experience: ${report.sectionScores.experience}/100`));
  console.log(chalk.white(`  Skills: ${report.sectionScores.skills}/100`));
  console.log(chalk.white(`  Education: ${report.sectionScores.education}/100`));

  if (report.keywordAnalysis.length > 0) {
    console.log(chalk.bold.cyan("\n🔑 Keyword Analysis:\n"));

    const categories = ["required", "preferred", "missing"];
    categories.forEach((cat) => {
      const keywords = report.keywordAnalysis.filter((k) => k.category === cat);
      if (keywords.length > 0) {
        console.log(chalk.yellow(`  ${cat.toUpperCase()}:`));
        keywords.slice(0, 5).forEach((k) => {
          console.log(chalk.gray(`    - ${k.keyword} (${k.frequency}x)`));
        });
      }
    });
  }

  if (report.recommendations.length > 0) {
    console.log(chalk.bold.cyan("\n💡 Recommendations:\n"));
    report.recommendations.forEach((rec, index) => {
      console.log(chalk.white(`  ${index + 1}. ${rec}`));
    });
  }

  console.log(chalk.bold.cyan("\n📄 Format Guidance:\n"));
  console.log(chalk.white(`  Recommended: ${report.formatGuidance.recommendedFormat}`));
  console.log(chalk.gray(`  Font: ${report.formatGuidance.fontGuidelines}`));
  console.log(chalk.gray(`  Margins: ${report.formatGuidance.marginGuidelines}`));
  console.log(chalk.yellow(`  Avoid: ${report.formatGuidance.avoidElements.join(", ")}`));

  console.log(chalk.bold.cyan("\n✅ ATS optimization complete!"));
}

async function runSummary(jobId?: string) {
  if (jobId) {
    const prisma = getPrismaClient();
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (job) {
      console.log(chalk.cyan(`\n📝 Generating summaries for: ${job.title} at ${job.company?.name}\n`));
    }
  }

  const spinner = ora("Generating summary versions...").start();

  const agent = getHarvardSummaryAgent();
  const result = await agent.generateSummaries(jobId);

  if (!result.success || !result.data) {
    spinner.fail("Failed to generate summaries");
    console.log(chalk.red("\n✗ Error: " + result.error));
    return;
  }

  spinner.succeed("Summaries generated!");

  const { versions, recommendation, candidateBackground } = result.data;

  console.log(chalk.bold.cyan("\n👤 Candidate Background:\n"));
  console.log(chalk.white(`  Name: ${candidateBackground.name}`));
  console.log(chalk.white(`  Experience: ${candidateBackground.yearsExperience} years`));
  console.log(chalk.gray(`  Skills: ${candidateBackground.topSkills.slice(0, 5).join(", ")}`));

  console.log(chalk.bold.cyan("\n📝 5 Summary Versions:\n"));

  versions.forEach((version, index) => {
    const label = index === 0 ? "LEADERSHIP" :
                  index === 1 ? "TECHNICAL" :
                  index === 2 ? "RESULTS" :
                  index === 3 ? "INDUSTRY" : "VISION";

    console.log(chalk.yellow(`\n${index + 1}. ${label} (${version.bestFor})`));
    console.log(chalk.white(`   ${version.summary}`));
    console.log(chalk.gray(`   Focus: ${version.keyFocus}`));
  });

  const rec = versions[recommendation.suggestedVersion];
  console.log(chalk.bold.cyan("\n✨ Recommendation:\n"));
  console.log(chalk.green(`   Suggested: ${rec?.angle?.toUpperCase()} version`));
  console.log(chalk.gray(`   Reason: ${recommendation.reasoning}`));

  console.log(chalk.bold.cyan("\n✅ Summary generation complete!"));
}

async function runInterview(targetRole?: string, exportToFile?: boolean) {
  const spinner = ora("Generating STAR story bank...").start();

  const agent = getBehavioralCoachAgent();
  const result = await agent.generateStoryBank(targetRole);

  if (!result.success || !result.data) {
    spinner.fail("Failed to generate story bank");
    console.log(chalk.red("\n✗ Error: " + result.error));
    return;
  }

  spinner.succeed("Story bank generated!");

  const { stories, questionMapping, deliveryTips } = result.data;

  // Export to file if requested
  if (exportToFile) {
    const exportSpinner = ora("Exporting to DOCX...").start();
    const exportService = getInterviewExportService();
    const exportResult = await exportService.exportStoriesToPDF(targetRole);

    if (exportResult.success && exportResult.filepath) {
      exportSpinner.succeed(`Exported to ${exportResult.filepath}`);
    } else {
      exportSpinner.fail("Export failed: " + exportResult.error);
    }
  }

  console.log(chalk.bold.cyan("\n📚 STAR Story Bank\n"));
  console.log(chalk.white(`  Total Stories: ${stories.length}`));

  const categories = ["leadership", "conflict", "failure", "innovation", "collaboration", "pressure", "customer", "growth"];
  categories.forEach((cat) => {
    const count = stories.filter(s => s.category === cat).length;
    if (count > 0) {
      console.log(chalk.gray(`  ${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${count}`));
    }
  });

  console.log(chalk.bold.cyan("\n📖 Sample Stories:\n"));

  stories.slice(0, 4).forEach((story, index) => {
    console.log(chalk.yellow(`\n${index + 1}. ${story.title} (${story.category})`));
    console.log(chalk.white(`   S: ${story.situation.slice(0, 80)}...`));
    console.log(chalk.white(`   T: ${story.task.slice(0, 60)}...`));
    console.log(chalk.green(`   A: ${story.action.slice(0, 100)}...`));
    console.log(chalk.cyan(`   R: ${story.result}`));
    if (story.lessons) {
      console.log(chalk.gray(`   Lesson: ${story.lessons}`));
    }
  });

  console.log(chalk.bold.cyan("\n❓ Question-to-Story Mapping\n"));
  questionMapping.slice(0, 5).forEach((mapping, index) => {
    console.log(chalk.yellow(`\n${index + 1}. ${mapping.question}`));
    console.log(chalk.gray(`   Best stories: ${mapping.suggestedStoryIds.join(", ")}`));
  });

  console.log(chalk.bold.cyan("\n🎤 Delivery Tips\n"));
  console.log(chalk.white(`  Pacing: ${deliveryTips.pacing}`));
  console.log(chalk.white(`  Detail Level: ${deliveryTips.detailLevel}`));
  console.log(chalk.yellow(`  What interviewers listen for:`));
  deliveryTips.whatInterviewersListenFor.forEach((tip) => {
    console.log(chalk.gray(`    - ${tip}`));
  });

  console.log(chalk.bold.cyan("\n✅ Interview preparation complete!"));
}

async function runLinkedIn(targetRole?: string) {
  const spinner = ora("Optimizing LinkedIn profile...").start();

  const agent = getLinkedInOptimizerAgent();
  const result = await agent.optimizeProfile(targetRole ? [targetRole] : undefined);

  if (!result.success || !result.data) {
    spinner.fail("Failed to optimize LinkedIn");
    console.log(chalk.red("\n✗ Error: " + result.error));
    return;
  }

  spinner.succeed("LinkedIn optimized!");

  const { headline, about, skills, profileOptimizationTips, activityStrategy, recommendations } = result.data;

  console.log(chalk.bold.cyan("\n💼 LinkedIn Optimization\n"));

  console.log(chalk.bold.cyan("\n📌 Headline\n"));
  console.log(chalk.yellow("  CURRENT:"));
  console.log(chalk.gray(`  ${headline.current}`));
  console.log(chalk.green("\n  RECOMMENDED:"));
  console.log(chalk.white(`  ${headline.recommended}`));
  console.log(chalk.gray(`  ${headline.characterCount}/220 characters`));

  console.log(chalk.bold.cyan("\n👤 About Section\n"));
  console.log(chalk.green("  RECOMMENDED:"));
  console.log(chalk.white(`  ${about.recommended.slice(0, 300)}...`));
  console.log(chalk.gray(`  Keywords: ${about.keywords.slice(0, 8).join(", ")}`));

  console.log(chalk.bold.cyan("\n🔧 Skills Section\n"));
  console.log(chalk.white(`  Top Skills (for search ranking):`));
  skills.orderedForSearch.slice(0, 10).forEach((skill, index) => {
    console.log(chalk.gray(`    ${index + 1}. ${skill}`));
  });

  console.log(chalk.bold.cyan("\n👥 Recommendations\n"));
  console.log(chalk.white(`  Request: ${recommendations.requested} recommendations`));
  console.log(chalk.gray(`  Template: ${recommendations.template.slice(0, 100)}...`));

  console.log(chalk.bold.cyan("\n🖼️ Profile Optimization Tips\n"));
  console.log(chalk.gray(`  Banner: ${profileOptimizationTips.bannerImage}`));
  console.log(chalk.gray(`  Photo: ${profileOptimizationTips.photo}`));
  console.log(chalk.gray(`  Custom URL: ${profileOptimizationTips.customURL}`));

  console.log(chalk.bold.cyan("\n📈 Activity Strategy\n"));
  console.log(chalk.white(`  Frequency: ${activityStrategy.postingFrequency}`));
  console.log(chalk.gray(`  Content types: ${activityStrategy.contentTypes.join(", ")}`));

  console.log(chalk.bold.cyan("\n✅ LinkedIn optimization complete!"));
}

async function runSalary(jobId?: string, exportToFile?: boolean) {
  const spinner = ora("Preparing salary negotiation strategy...").start();

  const agent = getSalaryNegotiatorAgent();
  const result = await agent.prepareNegotiation(jobId);

  if (!result.success || !result.data) {
    spinner.fail("Failed to prepare negotiation strategy");
    console.log(chalk.red("\n✗ Error: " + result.error));
    return;
  }

  spinner.succeed("Negotiation strategy prepared!");

  // Export to file if requested
  if (exportToFile) {
    const exportSpinner = ora("Exporting to DOCX...").start();
    const exportService = getCareerExportService();
    const exportResult = await exportService.exportSalaryNegotiation();

    if (exportResult.success && exportResult.filepath) {
      exportSpinner.succeed(`Exported to ${exportResult.filepath}`);
    } else {
      exportSpinner.fail("Export failed: " + exportResult.error);
    }
  }

  const { marketAnalysis, totalCompensation, scripts, leveragePoints, nonSalaryNegotiables, walkAwayNumber } = result.data;

  console.log(chalk.bold.cyan("\n💰 Salary Negotiation Strategy\n"));

  console.log(chalk.bold.cyan("\n📊 Market Analysis\n"));
  console.log(chalk.white(`  Role: ${marketAnalysis.role}`));
  console.log(chalk.white(`  Location: ${marketAnalysis.location}`));
  console.log(chalk.green(`  Salary Range: $${marketAnalysis.salaryRange.low.toLocaleString()} - $${marketAnalysis.salaryRange.high.toLocaleString()}`));
  console.log(chalk.gray(`  Mid: $${marketAnalysis.salaryRange.mid.toLocaleString()}`));

  console.log(chalk.bold.cyan("\n💵 Total Compensation\n"));
  console.log(chalk.white(`  Base: $${totalCompensation.base.toLocaleString()}`));
  console.log(chalk.gray(`  Bonus: $${totalCompensation.bonus.toLocaleString()}`));
  console.log(chalk.gray(`  Equity: $${totalCompensation.equity.toLocaleString()}`));
  console.log(chalk.gray(`  Signing: $${totalCompensation.signing.toLocaleString()}`));
  console.log(chalk.green(`  TOTAL: $${totalCompensation.total.toLocaleString()}`));

  console.log(chalk.bold.cyan("\n🎯 Leverage Points\n"));
  leveragePoints.forEach((point) => {
    console.log(chalk.gray(`  • ${point}`));
  });

  console.log(chalk.bold.cyan("\n📝 Key Scripts\n"));
  console.log(chalk.yellow("\nInitial Response:"));
  console.log(chalk.white(`  ${scripts.initialResponse.script.slice(0, 200)}...`));
  console.log(chalk.yellow("\nCounter Offer:"));
  console.log(chalk.white(`  ${scripts.counterOffer.script.slice(0, 200)}...`));

  console.log(chalk.bold.cyan("\n🔑 Non-Salary Negotiables\n"));
  nonSalaryNegotiables.forEach((item) => {
    console.log(chalk.white(`  ${item.item} (${item.priority})`));
    console.log(chalk.gray(`    ${item.script.slice(0, 80)}...`));
  });

  console.log(chalk.bold.cyan("\n⚠️ Walk-Away Number\n"));
  console.log(chalk.red(`  $${walkAwayNumber.toLocaleString()} minimum`));

  console.log(chalk.bold.cyan("\n📧 Email Templates\n"));
  console.log(chalk.yellow("  Initial: Check generated output"));
  console.log(chalk.yellow("  Counter: Check generated output"));
  console.log(chalk.yellow("  Final: Check generated output"));

  console.log(chalk.bold.cyan("\n✅ Negotiation strategy complete!"));
}

async function runBrand(targetRole?: string) {
  const spinner = ora("Building personal brand strategy...").start();

  const agent = getPersonalBrandAgent();
  const result = await agent.buildBrand(targetRole);

  if (!result.success || !result.data) {
    spinner.fail("Failed to build brand strategy");
    console.log(chalk.red("\n✗ Error: " + result.error));
    return;
  }

  spinner.succeed("Brand strategy created!");

  const { positioning, thoughtLeadership, contentStrategy, speakingStrategy, networkingStrategy, actionPlan90Days } = result.data;

  console.log(chalk.bold.cyan("\n🎨 Personal Brand Strategy\n"));

  console.log(chalk.bold.cyan("\n📌 Positioning\n"));
  console.log(chalk.yellow("  One-Liner:"));
  console.log(chalk.white(`  ${positioning.oneLiner}`));
  console.log(chalk.yellow("\n  Unique Expertise:"));
  console.log(chalk.white(`  ${positioning.uniqueExpertise}`));
  console.log(chalk.yellow("\n  Differentiator:"));
  console.log(chalk.white(`  ${positioning.differentiator}`));

  console.log(chalk.bold.cyan("\n💡 Thought Leadership Topics\n"));
  thoughtLeadership.topics.forEach((topic, index) => {
    console.log(chalk.white(`  ${index + 1}. ${topic.topic}`));
    console.log(chalk.gray(`     Angle: ${topic.angle}`));
  });

  console.log(chalk.bold.cyan("\n📱 Content Strategy\n"));
  contentStrategy.platforms.forEach((platform) => {
    console.log(chalk.white(`  ${platform.name} (${platform.priority}) - ${platform.frequency}`));
  });

  console.log(chalk.bold.cyan("\n🎤 Speaking Strategy\n"));
  console.log(chalk.gray(`  Target: ${speakingStrategy.targetConferences.join(", ")}`));

  console.log(chalk.bold.cyan("\n🤝 Networking Strategy\n"));
  console.log(chalk.gray(`  Target roles: ${networkingStrategy.targetConnections.join(", ")}`));

  console.log(chalk.bold.cyan("\n📅 90-Day Action Plan\n"));
  actionPlan90Days.forEach((phase) => {
    console.log(chalk.yellow(`  Week ${phase.week * 4 - 3}-${phase.week * 4}: ${phase.milestone}`));
    phase.actions.slice(0, 2).forEach((action) => {
      console.log(chalk.gray(`    • ${action}`));
    });
  });

  console.log(chalk.bold.cyan("\n✅ Personal brand strategy complete!"));
}

async function runPivot(targetRole?: string, exportToFile?: boolean) {
  const spinner = ora("Planning career pivot...").start();

  const agent = getCareerPivotAgent();
  const result = await agent.planPivot(targetRole);

  if (!result.success || !result.data) {
    spinner.fail("Failed to plan career pivot");
    console.log(chalk.red("\n✗ Error: " + result.error));
    return;
  }

  spinner.succeed("Career pivot plan created!");

  // Export to file if requested
  if (exportToFile) {
    const exportSpinner = ora("Exporting to DOCX...").start();
    const exportService = getCareerExportService();
    const exportResult = await exportService.exportCareerPivot();

    if (exportResult.success && exportResult.filepath) {
      exportSpinner.succeed(`Exported to ${exportResult.filepath}`);
    } else {
      exportSpinner.fail("Export failed: " + exportResult.error);
    }
  }

  const { pivotNarrative, transferableSkills, gapAnalysis, bridgeRoles, resumeTranslation, networkingPlan, timeline } = result.data;

  console.log(chalk.bold.cyan("\n🔄 Career Pivot Strategy\n"));

  console.log(chalk.bold.cyan("\n📖 Pivot Narrative\n"));
  console.log(chalk.yellow("  Hook:"));
  console.log(chalk.white(`  ${pivotNarrative.hook}`));
  console.log(chalk.yellow("\n  Story:"));
  console.log(chalk.white(`  ${pivotNarrative.story}`));
  console.log(chalk.yellow("\n  Value Prop:"));
  console.log(chalk.white(`  ${pivotNarrative.valueProp}`));

  console.log(chalk.bold.cyan("\n🔄 Transferable Skills\n"));
  transferableSkills.forEach((skill) => {
    console.log(chalk.white(`  ${skill.skill} (${skill.relevance}/10)`));
    console.log(chalk.gray(`    ${skill.fromContext} → ${skill.toContext}`));
  });

  console.log(chalk.bold.cyan("\n📊 Gap Analysis\n"));
  console.log(chalk.yellow("  Missing Skills:"));
  gapAnalysis.missing.slice(0, 3).forEach((gap) => {
    console.log(chalk.white(`    • ${gap.skill} (${gap.importance}) - ${gap.gapClosing}`));
  });

  console.log(chalk.bold.cyan("\n🌉 Bridge Roles\n"));
  bridgeRoles.forEach((role) => {
    console.log(chalk.white(`  ${role.title} (relevance: ${role.relevance})`));
    console.log(chalk.gray(`    ${role.whyItWorks}`));
  });

  console.log(chalk.bold.cyan("\n📝 Resume Translation\n"));
  console.log(chalk.yellow("  Before:"));
  console.log(chalk.gray(`    ${resumeTranslation.before}`));
  console.log(chalk.green("  After:"));
  console.log(chalk.white(`    ${resumeTranslation.after}`));

  console.log(chalk.bold.cyan("\n🤝 Networking Plan\n"));
  console.log(chalk.white(`  Weekly goal: ${networkingPlan.weeklyGoal} connections`));
  networkingPlan.targets.slice(0, 2).forEach((target) => {
    console.log(chalk.gray(`    ${target.role}: ${target.template.slice(0, 50)}...`));
  });

  console.log(chalk.bold.cyan("\n📅 Timeline\n"));
  console.log(chalk.yellow(`  Phase 1 (${timeline.phase1.weeks}): ${timeline.phase1.goal}`));
  console.log(chalk.gray(`    ${timeline.phase1.actions.join(", ")}`));
  console.log(chalk.yellow(`  Phase 2 (${timeline.phase2.weeks}): ${timeline.phase2.goal}`));
  console.log(chalk.gray(`    ${timeline.phase2.actions.join(", ")}`));
  console.log(chalk.yellow(`  Phase 3 (${timeline.phase3.weeks}): ${timeline.phase3.goal}`));
  console.log(chalk.gray(`    ${timeline.phase3.actions.join(", ")}`));

  console.log(chalk.bold.cyan("\n✅ Career pivot plan complete!"));
}
