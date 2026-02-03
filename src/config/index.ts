// src/config/index.ts
import dotenv from "dotenv";
import path from "path";
import { Config } from "@/types";

// Load environment variables
dotenv.config();

const config: Config = {
  database: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/resume_agent",
  },
  llm: {
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.DEFAULT_MODEL || "claude-sonnet-4-20250514",
    maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || "4000"),
    temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || "0.7"),
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    enabled: process.env.ENABLE_GITHUB_SYNC === "true",
  },
  paths: {
    data: process.env.DATA_DIR || path.join(process.cwd(), "data"),
    outputs:
      process.env.OUTPUTS_DIR || path.join(process.cwd(), "data", "outputs"),
    cache: process.env.CACHE_DIR || path.join(process.cwd(), "data", "cache"),
    uploads:
      process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads"),
  },
  features: {
    webScraping: process.env.ENABLE_WEB_SCRAPING === "true",
    githubSync: process.env.ENABLE_GITHUB_SYNC === "true",
    linkedinSearch: process.env.ENABLE_LINKEDIN_SEARCH === "true",
  },
  contactFinder: {
    hunter: {
      apiKey: process.env.HUNTER_API_KEY,
      monthlyLimit: 50,
      enabled: !!process.env.HUNTER_API_KEY,
    },
    apollo: {
      apiKey: process.env.APOLLO_API_KEY,
      monthlyLimit: 100,
      enabled: !!process.env.APOLLO_API_KEY,
    },
    rocketReach: {
      apiKey: process.env.ROCKETREACH_API_KEY,
      monthlyLimit: 5,
      enabled: !!process.env.ROCKETREACH_API_KEY,
    },
  },
};

// Validate required config
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push("DATABASE_URL is required");
  }

  if (!config.llm.apiKey) {
    errors.push("ANTHROPIC_API_KEY is required");
  }

  if (config.features.githubSync && !config.github.token) {
    errors.push("GITHUB_TOKEN is required when GitHub sync is enabled");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join("\n")}`);
  }
}

export default config;
