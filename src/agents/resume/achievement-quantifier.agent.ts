// src/agents/resume/achievement-quantifier.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import VoiceLoader from "@/utils/voice-loader";

export interface QuantifiedAchievement {
  original: string;
  rewritten: string;
  metrics: {
    revenue?: string;
    scale?: string;
    time?: string;
    percentage?: string;
    comparison?: string;
  };
  context: string;
  category: "leadership" | "technical" | "collaboration" | "innovation" | "impact";
}

export interface QuantifierResult {
  achievements: QuantifiedAchievement[];
  summary: {
    totalQuantified: number;
    withRevenueImpact: number;
    withScaleMetrics: number;
    withTimeImprovements: number;
    withPercentageGains: number;
  };
}

export class AchievementQuantifierAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  async quantifyJobAchievements(jobId: string): Promise<AgentResponse<QuantifierResult>> {
    try {
      logger.header("Achievement Quantifier Agent");
      logger.info("Quantifying achievements for job", { jobId });

      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      const masterResume = await this.prisma.masterResume.findFirst({
        include: {
          experiences: {
            include: { achievements: true },
            orderBy: { startDate: "desc" },
          },
          projects: {
            include: { technologies: true },
          },
        },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const achievements = await this.quantifyAchievements(
        masterResume.experiences.flatMap(exp => exp.achievements),
        job.requiredSkills,
      );

      const summary = this.calculateSummary(achievements);

      logger.success(`Quantified ${achievements.length} achievements`);

      return {
        success: true,
        data: { achievements, summary },
      };
    } catch (error: any) {
      logger.error("Achievement quantification failed", error);
      return { success: false, error: error.message };
    }
  }

  async quantifyResumeAchievements(resumeId?: string): Promise<AgentResponse<QuantifierResult>> {
    try {
      logger.header("Achievement Quantifier Agent");
      logger.info("Quantifying achievements from master resume");

      const masterResume = resumeId
        ? await this.prisma.masterResume.findUnique({
            where: { id: resumeId },
            include: {
              experiences: {
                include: { achievements: true },
                orderBy: { startDate: "desc" },
              },
              projects: true,
            },
          })
        : await this.prisma.masterResume.findFirst({
            include: {
              experiences: {
                include: { achievements: true },
                orderBy: { startDate: "desc" },
              },
              projects: true,
            },
          });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const achievements = await this.quantifyAchievements(
        masterResume.experiences.flatMap(exp => exp.achievements),
        [],
      );

      const summary = this.calculateSummary(achievements);

      logger.success(`Quantified ${achievements.length} achievements`);

      return {
        success: true,
        data: { achievements, summary },
      };
    } catch (error: any) {
      logger.error("Achievement quantification failed", error);
      return { success: false, error: error.message };
    }
  }

  private async quantifyAchievements(
    achievements: any[],
    targetSkills: string[],
  ): Promise<QuantifiedAchievement[]> {
    const voiceGuidance = await VoiceLoader.getVoiceGuidance();

    const prompt = `${voiceGuidance}

---

You are a McKinsey-level achievement quantifier. Transform weak, vague achievements into powerful, quantified bullet points.

## Your Task
Analyze each achievement and rewrite it with:
1. **Revenue Impact**: How much money did the work generate or save?
2. **Scale Metrics**: Team size, customers served, projects delivered
3. **Time Metrics**: Deadlines beaten, speed improvements, efficiency gains
4. **Percentage Improvements**: Growth rates, conversion lifts, cost reductions
5. **Before/After**: Show the situation before you arrived vs after your impact
6. **Context Setting**: Briefly explain the challenge so the achievement feels impressive

## Original Achievements to Quantify:
${achievements
  .slice(0, 8)
  .map((a, i) => `${i + 1}. ${a.description}${a.metrics ? ` (${a.metrics})` : ""}`)
  .join("\n")}

Target Skills (for keyword relevance): ${targetSkills.slice(0, 5).join(", ") || "N/A"}

## Output Format (Strict JSON):
[
  {
    "original": "original achievement text",
    "rewritten": "quantified rewritten achievement - STAR format with metrics",
    "metrics": {
      "revenue": "$ amount or range if applicable",
      "scale": "team size, customers, projects",
      "time": "time saved or gained",
      "percentage": "X% improvement or reduction",
      "comparison": "rank #1 out of X, exceeded target by Y%"
    },
    "context": "2-3 sentence context setting the stage for this achievement",
    "category": "leadership|technical|collaboration|innovation|impact"
  }
]

Return ONLY valid JSON array.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.3,
      maxTokens: 2000,
    });

    if (response.success && response.data) {
      try {
        let jsonStr = response.data.trim();
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        }

        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (parseError) {
        logger.warn("Failed to parse quantified achievements", parseError);
      }
    }

    return achievements.slice(0, 5).map((a) => ({
      original: a.description,
      rewritten: a.description + (a.metrics ? ` (${a.metrics})` : ""),
      metrics: {},
      context: "",
      category: "impact" as const,
    }));
  }

  private calculateSummary(achievements: QuantifiedAchievement[]): QuantifierResult["summary"] {
    return {
      totalQuantified: achievements.length,
      withRevenueImpact: achievements.filter(a => a.metrics.revenue).length,
      withScaleMetrics: achievements.filter(a => a.metrics.scale).length,
      withTimeImprovements: achievements.filter(a => a.metrics.time).length,
      withPercentageGains: achievements.filter(a => a.metrics.percentage).length,
    };
  }
}

let achievementQuantifierAgent: AchievementQuantifierAgent | null = null;

export function getAchievementQuantifierAgent(): AchievementQuantifierAgent {
  if (!achievementQuantifierAgent) {
    achievementQuantifierAgent = new AchievementQuantifierAgent();
  }
  return achievementQuantifierAgent;
}

export default getAchievementQuantifierAgent;
