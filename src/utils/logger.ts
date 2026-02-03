// src/utils/logger.ts
import chalk from "chalk";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() || "INFO";
    this.level = LogLevel[envLevel as keyof typeof LogLevel] || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;

    if (meta) {
      formatted += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return formatted;
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(chalk.gray(this.formatMessage("DEBUG", message, meta)));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.blue(this.formatMessage("INFO", message, meta)));
    }
  }

  success(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.green(this.formatMessage("SUCCESS", message, meta)));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(chalk.yellow(this.formatMessage("WARN", message, meta)));
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const meta =
        error instanceof Error ?
          {
            message: error.message,
            stack: error.stack,
          }
        : error;
      console.error(chalk.red(this.formatMessage("ERROR", message, meta)));
    }
  }

  // Special formatters for CLI
  header(text: string): void {
    console.log("\n" + chalk.bold.cyan(text));
    console.log(chalk.cyan("─".repeat(text.length)));
  }

  section(text: string): void {
    console.log("\n" + chalk.bold(text));
  }

  item(text: string, value?: string): void {
    if (value) {
      console.log(`  ${chalk.gray("•")} ${text}: ${chalk.white(value)}`);
    } else {
      console.log(`  ${chalk.gray("•")} ${text}`);
    }
  }

  step(step: number, total: number, message: string): void {
    console.log(chalk.cyan(`[${step}/${total}]`) + ` ${message}`);
  }

  box(message: string): void {
    const lines = message.split("\n");
    const maxLength = Math.max(...lines.map((l) => l.length));
    const border = "─".repeat(maxLength + 4);

    console.log(chalk.cyan("┌" + border + "┐"));
    lines.forEach((line) => {
      const padding = " ".repeat(maxLength - line.length);
      console.log(chalk.cyan("│ ") + line + padding + chalk.cyan(" │"));
    });
    console.log(chalk.cyan("└" + border + "┘"));
  }
}

export const logger = new Logger();
export default logger;
