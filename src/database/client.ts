// src/database/client.ts
import { PrismaClient } from "@prisma/client";
import { logger } from "@/utils/logger";

// Singleton pattern for Prisma Client
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development" ?
          ["query", "error", "warn"]
        : ["error"],
    });

    // Handle graceful shutdown
    process.on("beforeExit", async () => {
      await prisma.$disconnect();
    });
  }

  return prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    logger.success("Database connected successfully");
  } catch (error) {
    logger.error("Failed to connect to database", error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$disconnect();
    logger.info("Database disconnected");
  } catch (error) {
    logger.error("Error disconnecting from database", error);
  }
}

// Helper for running queries with retry logic
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        logger.warn(
          `Database operation failed, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export default getPrismaClient;
