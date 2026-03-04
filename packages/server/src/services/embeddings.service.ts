// src/services/embeddings.service.ts
import { CohereClient } from "cohere-ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { InferenceClient } from "@huggingface/inference";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
}

export class EmbeddingsService {
  private cohere: CohereClient | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private huggingface: InferenceClient | null = null;
  private prisma = getPrismaClient();
  private cohereRateLimited = false;

  constructor() {
    // Initialize all available clients
    if (process.env.COHERE_API_KEY) {
      this.cohere = new CohereClient({
        token: process.env.COHERE_API_KEY,
      });
    }

    if (process.env.HUGGINGFACE_API_KEY) {
      this.huggingface = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
    }

    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    logger.info("Embeddings Service initialized", {
      cohere: !!this.cohere,
      huggingface: !!this.huggingface,
      gemini: !!this.gemini,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // 1. Try Hugging Face (Primary)
    if (this.huggingface) {
      try {
        const model =
          process.env.HUGGINGFACE_EMBEDDING_MODEL ||
          "sentence-transformers/all-MiniLM-L6-v2";
        const result = await this.huggingface.featureExtraction({
          model: model,
          inputs: text,
        });

        if (Array.isArray(result)) {
          // Handle batch vs single return
          if (Array.isArray(result[0])) {
            return result[0] as number[];
          }
          return result as number[];
        }
      } catch (error: any) {
        logger.warn(
          `Hugging Face embedding failed: ${error.message}. Trying fallback...`,
        );
      }
    }

    // 2. Try Gemini (Secondary)
    if (this.gemini) {
      try {
        const model = this.gemini.getGenerativeModel({
          model: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
        });
        const result = await model.embedContent(text);
        return result.embedding.values;
      } catch (error: any) {
        logger.warn(
          `Gemini embedding failed: ${error.message}. Trying fallback...`,
        );
      }
    }

    // 3. Try Cohere (Tertiary)
    if (this.cohere && !this.cohereRateLimited) {
      try {
        const response = await this.cohere.embed({
          texts: [text],
          model: process.env.COHERE_EMBEDDING_MODEL || "embed-english-v3.0",
          inputType: "search_document",
        });

        if (
          response.embeddings &&
          Array.isArray(response.embeddings) &&
          response.embeddings.length > 0
        ) {
          const embedding = (response.embeddings as number[][])[0];
          if (Array.isArray(embedding)) return embedding;
        }
      } catch (error: any) {
        if (this.isRateLimitError(error)) {
          this.cohereRateLimited = true;
          logger.warn(
            "Cohere embedding rate-limited; disabling Cohere for this process and using other providers/fallbacks.",
          );
        }
        logger.warn(
          `Cohere embedding failed: ${error.message}. Trying fallback...`,
        );
      }
    }

    // 4. Mock Fallback
    logger.warn("All embedding providers failed, using mock embedding");
    return this.generateMockEmbedding(text);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.generateEmbedding(text)));
  }

  async embedExperience(experienceId: string): Promise<void> {
    try {
      const experience = await this.prisma.experience.findUnique({
        where: { id: experienceId },
        include: { achievements: true, technologies: true },
      });

      if (!experience) {
        throw new Error(`Experience not found: ${experienceId}`);
      }

      const text = this.createExperienceText(experience);
      await this.generateEmbedding(text);

      logger.debug("Experience would be embedded", {
        experienceId,
        textLength: text.length,
      });
    } catch (error: any) {
      logger.error("Failed to embed experience", error);
      throw new Error(`Experience embedding failed: ${error.message}`);
    }
  }

  async embedProject(projectId: string): Promise<void> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { technologies: true },
      });

      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const text = this.createProjectText(project);
      await this.generateEmbedding(text);

      logger.debug("Project would be embedded", {
        projectId,
        textLength: text.length,
      });
    } catch (error: any) {
      logger.error("Failed to embed project", error);
      throw new Error(`Project embedding failed: ${error.message}`);
    }
  }

  async embedJobRequirements(jobId: string): Promise<number[]> {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      const text = this.createJobText(job);
      return await this.generateEmbedding(text);
    } catch (error: any) {
      logger.error("Failed to embed job requirements", error);
      throw new Error(`Job embedding failed: ${error.message}`);
    }
  }

  async findRelevantExperiences(
    jobId: string,
    limit: number = 3,
  ): Promise<Array<{ experience: any; similarity: number }>> {
    try {
      logger.info("Finding relevant experiences", { jobId, limit });

      const jobEmbedding = await this.embedJobRequirements(jobId);

      const experiences = await this.prisma.experience.findMany({
        include: { achievements: true, technologies: true },
      });

      const similarities = await Promise.all(
        experiences.map(async (experience) => {
          const text = this.createExperienceText(experience);
          // Use the same generation method as the job embedding to ensure matching dimensions
          const expEmbedding = await this.generateEmbedding(text);
          const similarity = this.calculateCosineSimilarity(
            jobEmbedding,
            expEmbedding,
          );
          return { experience, similarity };
        }),
      );

      // Boost tech roles and sort by relevance
      const techKeywords = [
        "software",
        "developer",
        "engineer",
        "programmer",
        "full stack",
        "frontend",
        "backend",
        "web",
        "mobile",
        "data",
        "ai",
        "machine learning",
        "devops",
        "qa",
        "test",
        "technical",
        "architect",
      ];

      const sortedSimilarities = similarities
        .map(({ experience, similarity }) => {
          // Boost similarity for tech roles
          const title = (experience.title || "").toLowerCase();
          const isTechRole = techKeywords.some((keyword) =>
            title.includes(keyword),
          );
          const boostedSimilarity = isTechRole ? similarity + 0.3 : similarity;

          return { experience, similarity: boostedSimilarity };
        })
        .sort((a, b) => {
          // Primary sort: by boosted similarity score (descending)
          const similarityDiff = b.similarity - a.similarity;
          if (Math.abs(similarityDiff) > 0.1) {
            return similarityDiff;
          }

          // Secondary sort: by start date (most recent first)
          const dateA = new Date(a.experience.startDate);
          const dateB = new Date(b.experience.startDate);

          // Handle current jobs (no endDate) - put them first
          if (!a.experience.endDate && b.experience.endDate) return -1;
          if (a.experience.endDate && !b.experience.endDate) return 1;

          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, limit);

      logger.info("Found relevant experiences", {
        count: sortedSimilarities.length,
        topSimilarity: sortedSimilarities[0]?.similarity || 0,
      });

      return sortedSimilarities;
    } catch (error: any) {
      logger.error("Failed to find relevant experiences", error);
      throw new Error(`Experience search failed: ${error.message}`);
    }
  }

  async findRelevantProjects(
    jobId: string,
    limit: number = 2,
  ): Promise<Array<{ project: any; similarity: number }>> {
    try {
      logger.info("Finding relevant projects", { jobId, limit });

      const jobEmbedding = await this.embedJobRequirements(jobId);

      const projects = await this.prisma.project.findMany({
        include: { technologies: true },
      });

      const similarities = await Promise.all(
        projects.map(async (project) => {
          const text = this.createProjectText(project);
          // Use the same generation method as the job embedding to ensure matching dimensions
          const projEmbedding = await this.generateEmbedding(text);
          const similarity = this.calculateCosineSimilarity(
            jobEmbedding,
            projEmbedding,
          );
          return { project, similarity };
        }),
      );

      // Sort by relevance first, then by recency (most recent first)
      const sortedSimilarities = similarities
        .sort((a, b) => {
          // Primary sort: by similarity score (descending)
          const similarityDiff = b.similarity - a.similarity;
          if (Math.abs(similarityDiff) > 0.1) {
            return similarityDiff;
          }

          // Secondary sort: by start date (most recent first)
          const dateA = new Date(a.project.startDate);
          const dateB = new Date(b.project.startDate);

          // Handle current projects (no endDate) - put them first
          if (!a.project.endDate && b.project.endDate) return -1;
          if (a.project.endDate && !b.project.endDate) return 1;

          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, limit);

      logger.info("Found relevant projects", {
        count: sortedSimilarities.length,
        topSimilarity: sortedSimilarities[0]?.similarity || 0,
      });

      return sortedSimilarities;
    } catch (error: any) {
      logger.error("Failed to find relevant projects", error);
      throw new Error(`Project search failed: ${error.message}`);
    }
  }

  async generateAllExperienceEmbeddings(): Promise<void> {
    try {
      logger.info("Generating mock embeddings for all experiences");

      const masterResume = await this.prisma.masterResume.findFirst({
        include: {
          experiences: { include: { achievements: true, technologies: true } },
        },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const experiences = masterResume.experiences;

      logger.info(`Found ${experiences.length} experiences`);

      for (const experience of experiences) {
        await this.embedExperience(experience.id);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      logger.success("All experience embeddings generated");
    } catch (error: any) {
      logger.error("Failed to generate experience embeddings", error);
      throw error;
    }
  }

  async generateAllProjectEmbeddings(): Promise<void> {
    try {
      logger.info("Generating mock embeddings for all projects");

      const masterResume = await this.prisma.masterResume.findFirst({
        include: {
          projects: { include: { technologies: true } },
        },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const projects = masterResume.projects;

      logger.info(`Found ${projects.length} projects`);

      for (const project of projects) {
        await this.embedProject(project.id);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      logger.success("All project embeddings generated");
    } catch (error: any) {
      logger.error("Failed to generate project embeddings", error);
      throw error;
    }
  }

  private generateMockEmbedding(text: string): number[] {
    const dimensions = 512;
    const embedding: number[] = [];

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    for (let i = 0; i < dimensions; i++) {
      hash = ((hash << 7) - hash + i) & hash;
      embedding.push(((hash % 2000) - 1000) / 1000);
    }

    return embedding;
  }

  private isRateLimitError(error: any): boolean {
    const message = (error?.message || "").toLowerCase();
    return (
      message.includes("429") ||
      message.includes("toomanyrequestserror") ||
      message.includes("rate limit") ||
      message.includes("limited to")
    );
  }

  private createExperienceText(experience: any): string {
    const parts = [
      experience.title,
      experience.company,
      experience.description || "",
    ];

    // Boost tech roles with keywords
    const title = (experience.title || "").toLowerCase();
    const techKeywords = [
      "software",
      "developer",
      "engineer",
      "programmer",
      "full stack",
      "frontend",
      "backend",
      "web",
      "mobile",
      "data",
      "ai",
      "machine learning",
      "devops",
      "qa",
      "test",
      "technical",
      "architect",
    ];

    const isTechRole = techKeywords.some((keyword) => title.includes(keyword));
    if (isTechRole) {
      parts.push("software engineering technology development programming");
    }

    if (experience.achievements?.length > 0) {
      parts.push(...experience.achievements.map((a: any) => a.description));
    }

    if (experience.technologies?.length > 0) {
      parts.push(
        "Technologies: " +
          experience.technologies
            .map((t: any) => (typeof t === "string" ? t : t.name))
            .join(", "),
      );
    }

    return parts.join(" ");
  }

  private createProjectText(project: any): string {
    const parts = [project.name, project.description, project.role];

    if (project.achievements?.length > 0) {
      parts.push(...project.achievements);
    }

    if (project.technologies?.length > 0) {
      parts.push(
        "Technologies: " +
          project.technologies
            .map((t: any) => (typeof t === "string" ? t : t.name))
            .join(", "),
      );
    }

    return parts.join(" ");
  }

  private createJobText(job: any): string {
    const parts = [
      job.title,
      ...(job.requiredSkills || []),
      ...(job.preferredSkills || []),
      ...(job.responsibilities || []),
      ...(job.qualifications || []),
      ...(job.keywords || []),
    ];

    return parts.join(" ");
  }

  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

let embeddingsService: EmbeddingsService | null = null;

export function getEmbeddingsService(): EmbeddingsService {
  if (!embeddingsService) {
    embeddingsService = new EmbeddingsService();
  }
  return embeddingsService;
}

export default getEmbeddingsService;
