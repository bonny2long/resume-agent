import { beforeAll, afterAll, afterEach, vi } from "vitest";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let prisma: any;

beforeAll(async () => {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log("\n✅ Database connected for tests");
  } catch (error) {
    console.error("\n❌ Database connection failed:", error);
    throw error;
  }

  globalThis.prisma = prisma;
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
    console.log("\n✅ Database disconnected");
  }
});

afterEach(async () => {
  vi.clearAllMocks();
});

vi.mock("axios", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
    })),
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: {
    Anthropic: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: "{}" }],
        }),
      },
    })),
  },
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ text: "{}" }],
      }),
    },
  })),
}));

vi.mock("openai", () => ({
  __esModule: true,
  default: {
    OpenAI: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "{}" } }],
          }),
        },
      },
    })),
  },
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "{}" } }],
        }),
      },
    },
  })),
}));

vi.mock("@octokit/rest", () => ({
  __esModule: true,
  default: {
    Octokit: vi.fn().mockImplementation(() => ({
      repos: {
        listForUser: vi.fn().mockResolvedValue({ data: [] }),
        get: vi.fn().mockResolvedValue({ data: {} }),
      },
    })),
  },
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      listForUser: vi.fn().mockResolvedValue({ data: [] }),
      get: vi.fn().mockResolvedValue({ data: {} }),
    },
  })),
}));

declare global {
  namespace NodeJS {
    interface Global {
      prisma: typeof prisma;
    }
  }
}
