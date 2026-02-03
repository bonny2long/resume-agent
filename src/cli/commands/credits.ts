// src/cli/commands/credits.ts
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { logger } from "@/utils/logger";
import { getContactFinderService } from "@/services/contact-finder.service";

export const creditsCommand = new Command("credits")
  .description("View contact finder API credits and usage")
  .action(async () => {
    try {
      const contactFinder = getContactFinderService();
      const stats = contactFinder.getStats();

      logger.header("Contact Finder API Credits");

      // Create table
      const table = new Table({
        head: [
          chalk.cyan("Service"),
          chalk.cyan("Used"),
          chalk.cyan("Remaining"),
          chalk.cyan("Limit"),
          chalk.cyan("% Used"),
          chalk.cyan("Status"),
        ],
        colWidths: [20, 10, 12, 10, 12, 15],
      });

      // Hunter.io row
      const hunterPercent = (stats.hunter.used / stats.hunter.limit) * 100;
      const hunterStatus =
        stats.hunter.remaining > 10 ? chalk.green("✓ Good")
        : stats.hunter.remaining > 0 ? chalk.yellow("⚠ Low")
        : chalk.red("✗ Exhausted");

      table.push([
        chalk.blue("Hunter.io"),
        stats.hunter.used.toString(),
        stats.hunter.remaining.toString(),
        stats.hunter.limit.toString(),
        hunterPercent.toFixed(1) + "%",
        hunterStatus,
      ]);

      // Apollo.io row
      const apolloPercent = (stats.apollo.used / stats.apollo.limit) * 100;
      const apolloStatus =
        stats.apollo.remaining > 20 ? chalk.green("✓ Good")
        : stats.apollo.remaining > 0 ? chalk.yellow("⚠ Low")
        : chalk.red("✗ Exhausted");

      table.push([
        chalk.blue("Apollo.io"),
        stats.apollo.used.toString(),
        stats.apollo.remaining.toString(),
        stats.apollo.limit.toString(),
        apolloPercent.toFixed(1) + "%",
        apolloStatus,
      ]);

      // RocketReach row
      const rocketPercent =
        (stats.rocketReach.used / stats.rocketReach.limit) * 100;
      const rocketStatus =
        stats.rocketReach.remaining > 2 ? chalk.green("✓ Available")
        : stats.rocketReach.remaining > 0 ? chalk.yellow("⚠ Limited")
        : chalk.red("✗ Exhausted");

      table.push([
        chalk.magenta("RocketReach ⭐"),
        stats.rocketReach.used.toString(),
        chalk.bold(stats.rocketReach.remaining.toString()),
        stats.rocketReach.limit.toString(),
        rocketPercent.toFixed(1) + "%",
        rocketStatus,
      ]);

      console.log(table.toString());

      // Recommendations
      console.log("\n" + chalk.bold("Recommendations:"));

      if (stats.rocketReach.remaining > 0) {
        console.log(
          chalk.green("✓") +
            " You have RocketReach credits! Use them for high-priority jobs only.",
        );
      } else {
        console.log(
          chalk.yellow("⚠") +
            " RocketReach exhausted. Premium lookups unavailable this month.",
        );
      }

      if (stats.apollo.remaining < 20) {
        console.log(
          chalk.yellow("⚠") +
            " Apollo.io credits running low. Use strategically.",
        );
      }

      if (stats.hunter.remaining < 10) {
        console.log(
          chalk.yellow("⚠") +
            " Hunter.io credits running low. Use strategically.",
        );
      }

      if (stats.apollo.remaining === 0 && stats.hunter.remaining === 0) {
        console.log(
          chalk.red("✗") +
            " All services exhausted! Credits reset on 1st of next month.",
        );
      }

      // Usage tips
      console.log("\n" + chalk.bold("Usage Strategy:"));
      console.log(
        chalk.gray("  1. Apollo.io - First choice (100 credits/month)"),
      );
      console.log(
        chalk.gray("  2. Hunter.io - Email backup (50 credits/month)"),
      );
      console.log(
        chalk.gray(
          "  3. RocketReach - High priority only! (5 credits/month) ⭐",
        ),
      );

      console.log("\n" + chalk.bold("Priority Levels:"));
      console.log(chalk.gray("  • Low: Uses Apollo → Hunter (no RocketReach)"));
      console.log(
        chalk.gray("  • Medium: Uses Apollo → Hunter (no RocketReach)"),
      );
      console.log(
        chalk.gray("  • High: Uses Apollo → Hunter → RocketReach ⭐"),
      );

      console.log(
        "\n" + chalk.gray("Credits reset on the 1st of each month\n"),
      );
    } catch (error: any) {
      logger.error("Failed to get credits info", error);
      console.log(chalk.red("\n✗ Error: ") + error.message);
      console.log(
        chalk.gray("Make sure your API keys are configured in .env\n"),
      );
    }
  });
