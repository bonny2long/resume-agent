// src/types/index.ts
// Central type definitions for the resume agent

export * from "./resume.types";
export * from "./job.types";
export * from "./linkedin.types";

// Common types
export interface Config {
  database: {
    url: string;
  };
  llm: {
    provider: "anthropic" | "openai";
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  embeddings?: {
    provider: "anthropic" | "openai" | "cohere" | "gemini";
    apiKey: string;
    model: string;
  };
  github: {
    token?: string;
    enabled: boolean;
  };
  paths: {
    data: string;
    outputs: string;
    cache: string;
    uploads: string;
  };
  features: {
    webScraping: boolean;
    githubSync: boolean;
    linkedinSearch: boolean;
  };
  contactFinder: {
    hunter: {
      apiKey?: string;
      monthlyLimit: number;
      enabled: boolean;
    };
    apollo: {
      apiKey?: string;
      monthlyLimit: number;
      enabled: boolean;
    };
    rocketReach: {
      apiKey?: string;
      monthlyLimit: number;
      enabled: boolean;
    };
  };
}

export interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    confidence?: number;
    provider?: string;
  };
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebScrapingResult {
  url: string;
  title?: string;
  content: string;
  metadata?: Record<string, any>;
  scrapedAt: Date;
}

// Embedding types
export interface EmbeddingResult {
  embedding: number[];
  text: string;
  model: string;
}

export interface VectorSearchResult<T> {
  item: T;
  similarity: number;
  distance: number;
}

// Status types
export type ApplicationStatus =
  | "draft"
  | "ready"
  | "submitted"
  | "linkedin_sent"
  | "connection_accepted"
  | "follow_up_sent"
  | "interview_requested"
  | "interviewed"
  | "offer"
  | "rejected"
  | "withdrawn";

export type ExperienceLevel =
  | "entry"
  | "junior"
  | "mid"
  | "senior"
  | "staff"
  | "principal"
  | "executive";

export type ImpactLevel = "high" | "medium" | "low";

export type MessageTone = "professional" | "friendly" | "casual";

export type TechCategory =
  | "language"
  | "framework"
  | "tool"
  | "database"
  | "cloud"
  | "other";

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type WithTimestamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

export type WithId<T> = T & {
  id: string;
};
