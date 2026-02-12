// src/cli/commands/status.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import { logger } from "@/utils/logger";
import { getApplicationRepository } from "@/database/repositories/application.repository";
import path from "path";

export const statusCommand = new Command("status")
  .description("View and manage job applications")
  .option(
    "--status <status>",
    "Filter by status (prepared, applied, interviewing, offered, rejected)",
  )
  .option("--list", "List all applications", false)
  .option("--stats", "Show statistics only", false)
  .option("--follow-up", "Show applications needing follow-up", false)
  .argument("[application-id]", "View specific application details")
  .action(async (applicationId?: string, options?: any) => {
    try {
      const appRepo = getApplicationRepository();

      // Show specific application
      if (applicationId) {
        await showApplicationDetails(applicationId, appRepo);
        return;
      }

      // Show follow-up needed
      if (options?.followUp) {
        await showFollowUpNeeded(appRepo);
        return;
      }

      // Show stats only
      if (options?.stats) {
        await showStats(appRepo);
        return;
      }

      // Default: Show overview with applications list
      logger.header("Application Status");
      console.log();

      // Get applications
      const filter = options?.status ? { status: options.status } : undefined;
      const applications = await appRepo.findAll(filter);

      if (applications.length === 0) {
        console.log(chalk.yellow("📭 No applications found"));
        console.log();
        console.log(chalk.cyan("💡 Start applying:"));
        console.log(chalk.white("   npm run dev -- apply <job-url>"));
        return;
      }

      // Show statistics
      const stats = await appRepo.getStats();
      displayStats(stats);

      console.log();

      // Show applications
      logger.section(`Applications (${applications.length})`);
      console.log();

      applications.forEach((app, index) => {
        const daysAgo = Math.floor(
          (Date.now() - app.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        const timeAgo =
          daysAgo === 0 ? "today"
          : daysAgo === 1 ? "yesterday"
          : `${daysAgo} days ago`;

        // Status color
        const statusColor =
          app.status === "offered" ? chalk.green
          : app.status === "interviewing" ? chalk.cyan
          : app.status === "applied" ? chalk.blue
          : app.status === "rejected" ? chalk.red
          : chalk.gray;

        // Header
        console.log(
          chalk.bold.white(
            `${index + 1}. ${app.job.title} @ ${app.job.company.name}`,
          ),
        );

        // Details
        console.log(
          chalk.gray(
            `   ${statusColor(app.status)} • ${app.job.location} • ${timeAgo}`,
          ),
        );

        if (app.job.skillsMatch) {
          const matchColor =
            app.job.skillsMatch >= 80 ? chalk.green
            : app.job.skillsMatch >= 60 ? chalk.yellow
            : chalk.red;
          console.log(
            chalk.gray(`   Match: ${matchColor(app.job.skillsMatch + "%")}`),
          );
        }

        // Hiring manager
        if (app.hiringManager) {
          console.log(
            chalk.gray(`   👤 ${app.hiringManager.name}`) +
              (app.linkedInSent ? chalk.green(" ✓ contacted") : ""),
          );
        }

        // Interview date
        if (app.interviewDate) {
          const interviewDate = new Date(app.interviewDate);
          const isFuture = interviewDate > new Date();
          console.log(
            isFuture ?
              chalk.cyan(
                `   📅 Interview: ${interviewDate.toLocaleDateString()} ${interviewDate.toLocaleTimeString()}`,
              )
            : chalk.gray(
                `   📅 Interviewed: ${interviewDate.toLocaleDateString()}`,
              ),
          );
        }

        // Follow-up
        if (app.followUpDate && !app.responded) {
          const followUpDate = new Date(app.followUpDate);
          const isPast = followUpDate <= new Date();
          console.log(
            isPast ?
              chalk.yellow(`   ⚠️  Follow up overdue`)
            : chalk.gray(
                `   📌 Follow up: ${followUpDate.toLocaleDateString()}`,
              ),
          );
        }

        // Recent notes
        if (app.notes) {
          const noteLines = app.notes.split("\n");
          const lastNote = noteLines[noteLines.length - 1];
          if (lastNote.length > 60) {
            console.log(chalk.gray(`   📝 ${lastNote.substring(0, 57)}...`));
          } else {
            console.log(chalk.gray(`   📝 ${lastNote}`));
          }
        }

        console.log(chalk.gray(`   ID: ${app.id}`));
        console.log();
      });

      // Interactive actions
      console.log();
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "View application details", value: "view" },
            { name: "Update application status", value: "update" },
            { name: "Add note to application", value: "note" },
            { name: "Show statistics", value: "stats" },
            { name: "Exit", value: "exit" },
          ],
        },
      ]);

      if (action === "exit") {
        return;
      }

      if (action === "stats") {
        await showStats(appRepo);
        return;
      }

      // Get application ID
      const { selectedId } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedId",
          message: "Select application:",
          choices: applications.map((app) => ({
            name: `${app.job.title} @ ${app.job.company.name}`,
            value: app.id,
          })),
        },
      ]);

      if (action === "view") {
        await showApplicationDetails(selectedId, appRepo);
      } else if (action === "update") {
        await updateApplicationStatus(selectedId, appRepo);
      } else if (action === "note") {
        await addApplicationNote(selectedId, appRepo);
      }
    } catch (error: any) {
      logger.error("Status command failed", error);
      console.log(chalk.red("\n✗ Error: " + error.message));
    }
  });

/**
 * Display statistics
 */
function displayStats(stats: any) {
  logger.section("Statistics");
  console.log();

  console.log(chalk.white(`  Total Applications: ${stats.total}`));
  console.log(
    chalk.white(
      `  Response Rate: ${chalk.cyan(stats.responseRate.toFixed(1) + "%")}`,
    ),
  );
  console.log(
    chalk.white(
      `  Average Match: ${chalk.cyan(stats.averageMatchScore.toFixed(0) + "%")}`,
    ),
  );

  if (stats.needsFollowUp > 0) {
    console.log(chalk.yellow(`  ⚠️  Need Follow-up: ${stats.needsFollowUp}`));
  }

  console.log();
  console.log(chalk.white("  By Status:"));
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    const statusColor =
      status === "offered" ? chalk.green
      : status === "interviewing" ? chalk.cyan
      : status === "applied" ? chalk.blue
      : status === "rejected" ? chalk.red
      : chalk.gray;
    console.log(chalk.gray(`    ${statusColor(status)}: ${count}`));
  });
}

/**
 * Show detailed statistics
 */
async function showStats(appRepo: any) {
  logger.header("Application Statistics");
  console.log();

  const stats = await appRepo.getStats();
  displayStats(stats);
}

/**
 * Show applications needing follow-up
 */
async function showFollowUpNeeded(appRepo: any) {
  logger.header("Applications Needing Follow-Up");
  console.log();

  const applications = await appRepo.getNeedingFollowUp();

  if (applications.length === 0) {
    console.log(chalk.green("✓ No follow-ups needed!"));
    return;
  }

  applications.forEach((app: any, index: number) => {
    const followUpDate = new Date(app.followUpDate);
    const daysOverdue = Math.floor(
      (Date.now() - followUpDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    console.log(
      chalk.bold.white(
        `${index + 1}. ${app.job.title} @ ${app.job.company.name}`,
      ),
    );
    console.log(
      chalk.yellow(
        `   ⚠️  Overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`,
      ),
    );
    console.log(
      chalk.gray(
        `   Applied: ${app.appliedAt?.toLocaleDateString() || "Not yet"}`,
      ),
    );
    console.log(chalk.gray(`   ID: ${app.id}`));
    console.log();
  });
}

/**
 * Show application details
 */
async function showApplicationDetails(id: string, appRepo: any) {
  const app = await appRepo.findById(id);

  if (!app) {
    console.log(chalk.red("Application not found"));
    return;
  }

  logger.header("Application Details");
  console.log();

  // Job info
  console.log(chalk.bold.white("📋 Job"));
  console.log(chalk.white(`   ${app.job.title}`));
  console.log(chalk.gray(`   ${app.job.company.name}`));
  console.log(chalk.gray(`   ${app.job.location}`));
  if (app.job.skillsMatch) {
    console.log(chalk.cyan(`   Match: ${app.job.skillsMatch}%`));
  }
  console.log();

  // Status
  console.log(chalk.bold.white("📊 Status"));
  console.log(chalk.white(`   ${app.status}`));
  if (app.appliedAt) {
    console.log(
      chalk.gray(`   Applied: ${app.appliedAt.toLocaleDateString()}`),
    );
  }
  if (app.responded) {
    console.log(
      chalk.green(`   ✓ Responded: ${app.respondedAt?.toLocaleDateString()}`),
    );
  }
  console.log();

  // Files
  if (app.resumePath || app.coverLetterPath) {
    console.log(chalk.bold.white("📄 Documents"));
    if (app.resumePath) {
      console.log(chalk.gray(`   Resume: ${path.basename(app.resumePath)}`));
    }
    if (app.coverLetterPath) {
      console.log(
        chalk.gray(`   Cover Letter: ${path.basename(app.coverLetterPath)}`),
      );
    }
    console.log();
  }

  // Hiring manager
  if (app.hiringManager) {
    console.log(chalk.bold.white("👤 Hiring Manager"));
    console.log(chalk.white(`   ${app.hiringManager.name}`));
    if (app.hiringManager.title) {
      console.log(chalk.gray(`   ${app.hiringManager.title}`));
    }
    if (app.hiringManager.linkedInUrl) {
      console.log(chalk.blue(`   ${app.hiringManager.linkedInUrl}`));
    }
    if (app.linkedInSent) {
      console.log(
        chalk.green(
          `   ✓ LinkedIn sent: ${app.linkedInSentAt?.toLocaleDateString()}`,
        ),
      );
    }
    console.log();
  }

  // Interview
  if (app.interviewDate) {
    console.log(chalk.bold.white("📅 Interview"));
    console.log(
      chalk.cyan(`   ${new Date(app.interviewDate).toLocaleString()}`),
    );
    console.log();
  }

  // Notes
  if (app.notes) {
    console.log(chalk.bold.white("📝 Notes"));
    console.log(
      chalk.gray(
        app.notes
          .split("\n")
          .map((line: string) => `   ${line}`)
          .join("\n"),
      ),
    );
    console.log();
  }

  // Metadata
  console.log(chalk.gray(`Created: ${app.createdAt.toLocaleDateString()}`));
  console.log(chalk.gray(`Updated: ${app.updatedAt.toLocaleDateString()}`));
  console.log(chalk.gray(`ID: ${app.id}`));
}

/**
 * Update application status
 */
async function updateApplicationStatus(id: string, appRepo: any) {
  const { newStatus } = await inquirer.prompt([
    {
      type: "list",
      name: "newStatus",
      message: "Select new status:",
      choices: [
        "prepared",
        "applied",
        "interviewing",
        "offered",
        "rejected",
        "accepted",
      ],
    },
  ]);

  await appRepo.updateStatus(id, newStatus);
  console.log(chalk.green(`\n✓ Status updated to: ${newStatus}`));

  // If interviewing, ask for interview date
  if (newStatus === "interviewing") {
    const { hasInterview } = await inquirer.prompt([
      {
        type: "confirm",
        name: "hasInterview",
        message: "Do you have an interview scheduled?",
        default: true,
      },
    ]);

    if (hasInterview) {
      const { interviewDate } = await inquirer.prompt([
        {
          type: "input",
          name: "interviewDate",
          message: "Interview date and time (YYYY-MM-DD HH:mm):",
          validate: (input) => {
            const date = new Date(input);
            return !isNaN(date.getTime()) || "Invalid date format";
          },
        },
      ]);

      await appRepo.update(id, {
        interviewDate: new Date(interviewDate),
      });
      console.log(chalk.green("✓ Interview date saved"));
    }
  }

  // If applied, set follow-up date
  if (newStatus === "applied") {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 7); // 7 days from now

    await appRepo.update(id, {
      followUpDate,
    });
    console.log(
      chalk.gray(
        `Follow-up reminder set for: ${followUpDate.toLocaleDateString()}`,
      ),
    );
  }
}

/**
 * Add note to application
 */
async function addApplicationNote(id: string, appRepo: any) {
  const { note } = await inquirer.prompt([
    {
      type: "input",
      name: "note",
      message: "Add note:",
      validate: (input) => input.length > 0 || "Note cannot be empty",
    },
  ]);

  await appRepo.addNote(id, note);
  console.log(chalk.green("\n✓ Note added"));
}
