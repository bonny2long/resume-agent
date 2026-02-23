// src/agents/resume/harvard-summary.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import VoiceLoader from "@/utils/voice-loader";

export interface SummaryVersion {
  angle: "leadership" | "technical" | "results" | "industry" | "vision";
  summary: string;
  bestFor: string;
  keyFocus: string;
  atsKeywords: string[];
}

export interface SummaryWriterResult {
  versions: SummaryVersion[];
  recommendation: {
    suggestedVersion: number;
    reasoning: string;
  };
  candidateBackground: {
    name: string;
    yearsExperience: number;
    topSkills: string[];
    targetRole?: string;
    targetCompany?: string;
  };
}

export class HarvardSummaryAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  async generateSummaries(jobId?: string): Promise<AgentResponse<SummaryWriterResult>> {
    try {
      logger.header("Harvard Summary Writer Agent");
      logger.info("Generating 5 summary versions");

      let job = null;
      let masterResume;

      if (jobId) {
        job = await this.prisma.job.findUnique({
          where: { id: jobId },
          include: { company: true },
        });
      }

      masterResume = await this.prisma.masterResume.findFirst({
        include: {
          experiences: {
            include: { achievements: true },
            orderBy: { startDate: "desc" },
          },
          skills: true,
        },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const yearsExperience = this.calculateYearsExperience(masterResume.experiences);
      const topSkills = masterResume.skills.slice(0, 10).map((s: any) => s.name);

      const summaries = await this.generate5Versions(
        masterResume,
        job,
        yearsExperience,
        topSkills,
      );

      const result: SummaryWriterResult = {
        versions: summaries,
        recommendation: {
          suggestedVersion: job?.title?.toLowerCase().includes("senior") ||
                          job?.title?.toLowerCase().includes("lead") ? 0 : 2,
          reasoning: this.getRecommendationReasoning(summaries, job),
        },
        candidateBackground: {
          name: masterResume.fullName,
          yearsExperience,
          topSkills,
          targetRole: job?.title,
          targetCompany: job?.company?.name,
        },
      };

      logger.success("Generated 5 summary versions");

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      logger.error("Summary generation failed", error);
      return { success: false, error: error.message };
    }
  }

  private async generate5Versions(
    masterResume: any,
    job: any,
    yearsExperience: number,
    topSkills: string[],
  ): Promise<SummaryVersion[]> {
    const voiceGuidance = await VoiceLoader.getVoiceGuidance();

    const targetCompany = job?.company?.name || "target company";

    const requiredSkills = job?.requiredSkills?.slice(0, 8).join(", ") || "";

    const prompt = `${voiceGuidance}

---

You are the director of career services at Harvard Business School. Generate 5 distinct professional summary versions for a candidate.

## Candidate Background:
Name: ${masterResume.fullName}
Years of Experience: ${yearsExperience}
Top Skills: ${topSkills.join(", ")}
Career Story: ${masterResume.summaryShort || "Career transition from trades to software engineering"}

${job ? `## Target Job:
Role: ${job.title}
Company: ${targetCompany}
Required Skills: ${requiredSkills}` : ""}

## Your Task
Write 5 different 3-4 line professional summaries, each with a different angle:

1. **LEADERSHIP** - Focus on team leadership, mentorship, and strategic impact
2. **TECHNICAL** - Focus on technical expertise, technologies, and engineering excellence  
3. **RESULTS** - Focus on measurable achievements, metrics, and business impact
4. **INDUSTRY** - Focus on domain expertise, industry knowledge, and market understanding
5. **VISION** - Focus on future direction, innovation, and long-term potential

Each summary must:
- State who you are and what you do in the first line
- Include your signature achievement
- Show what makes you different from other candidates
- Include relevant keywords naturally
- Be 3-4 lines maximum
- Match the candidate's authentic voice (direct, specific, no corporate buzzwords)

## Output Format (Strict JSON):
{
  "versions": [
    {
      "angle": "leadership|technical|results|industry|vision",
      "summary": "3-4 line professional summary",
      "bestFor": "when to use this version",
      "keyFocus": "1-2 sentence description of angle",
      "atsKeywords": ["keyword1", "keyword2"]
    }
  ]
}

Return ONLY valid JSON.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.6,
      maxTokens: 1500,
    });

    if (response.success && response.data) {
      try {
        let jsonStr = response.data.trim();
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        }

        const parsed = JSON.parse(jsonStr);
        if (parsed.versions && Array.isArray(parsed.versions)) {
          return parsed.versions;
        }
      } catch (parseError) {
        logger.warn("Failed to parse summary versions", parseError);
      }
    }

    return this.getDefaultSummaries(masterResume, yearsExperience, topSkills);
  }

  private calculateYearsExperience(experiences: any[]): number {
    if (!experiences || experiences.length === 0) return 0;

    let totalMonths = 0;
    experiences.forEach((exp) => {
      const start = new Date(exp.startDate);
      const end = exp.endDate ? new Date(exp.endDate) : new Date();

      if (!isNaN(start.getTime())) {
        const months =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth());
        if (months > 0) totalMonths += months;
      }
    });

    return Math.round(totalMonths / 12);
  }

  private getRecommendationReasoning(_summaries: SummaryVersion[], job: any): string {
    if (!job) {
      return "For general applications, the Results version (3) is recommended as it highlights measurable impact that appeals to most employers.";
    }

    const title = job.title?.toLowerCase() || "";

    if (title.includes("senior") || title.includes("lead") || title.includes("principal")) {
      return "For senior roles, Leadership version (1) is recommended as it demonstrates strategic impact and team management experience.";
    }

    if (title.includes("technical") || title.includes("engineer") || title.includes("developer")) {
      return "For technical roles, Technical version (2) is recommended as it showcases your tech stack and engineering expertise.";
    }

    if (title.includes("manager") || title.includes("director")) {
      return "For management roles, Leadership version (1) is recommended as it emphasizes team building and strategic initiatives.";
    }

    return "For this role, Results version (3) is recommended as it highlights measurable achievements that resonate with hiring managers.";
  }

  private getDefaultSummaries(_masterResume: any, years: number, skills: string[]): SummaryVersion[] {
    const defaultSummary = `Full-stack developer with ${years} years of experience building scalable applications.`;

    return [
      {
        angle: "leadership",
        summary: defaultSummary,
        bestFor: "Senior/leadership positions",
        keyFocus: "Team management and strategic impact",
        atsKeywords: skills.slice(0, 5),
      },
      {
        angle: "technical",
        summary: defaultSummary,
        bestFor: "Technical roles",
        keyFocus: "Technical expertise and technologies",
        atsKeywords: skills.slice(0, 5),
      },
      {
        angle: "results",
        summary: defaultSummary,
        bestFor: "General applications",
        keyFocus: "Measurable achievements and impact",
        atsKeywords: skills.slice(0, 5),
      },
      {
        angle: "industry",
        summary: defaultSummary,
        bestFor: "Industry-specific roles",
        keyFocus: "Domain expertise and market knowledge",
        atsKeywords: skills.slice(0, 5),
      },
      {
        angle: "vision",
        summary: defaultSummary,
        bestFor: "Innovation-focused roles",
        keyFocus: "Future direction and long-term potential",
        atsKeywords: skills.slice(0, 5),
      },
    ];
  }

  async saveToDatabase(resumeId: string, jobId: string | null, versions: SummaryVersion[]): Promise<void> {
    try {
      // Delete old summaries for this resume/job combo
      await this.prisma.enhancedSummary.deleteMany({
        where: { resumeId, jobId: jobId || undefined },
      });

      // Save new summaries
      await this.prisma.enhancedSummary.createMany({
        data: versions.map((v, index) => ({
          resumeId,
          jobId: jobId || null,
          angle: v.angle,
          summary: v.summary,
          recommended: index === 0, // First one is recommended
          atsKeywords: v.atsKeywords || [],
        })),
      });

      logger.debug(`Saved ${versions.length} summaries to database`);
    } catch (error) {
      logger.warn("Failed to save summaries to database", error);
    }
  }

  async getFromDatabase(resumeId: string, jobId?: string): Promise<SummaryVersion[]> {
    const records = await this.prisma.enhancedSummary.findMany({
      where: { 
        resumeId,
        jobId: jobId || undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => ({
      angle: r.angle as any,
      summary: r.summary,
      bestFor: r.recommended ? "Recommended" : "Alternative",
      keyFocus: r.angle,
      atsKeywords: r.atsKeywords,
    }));
  }
}

let harvardSummaryAgent: HarvardSummaryAgent | null = null;

export function getHarvardSummaryAgent(): HarvardSummaryAgent {
  if (!harvardSummaryAgent) {
    harvardSummaryAgent = new HarvardSummaryAgent();
  }
  return harvardSummaryAgent;
}

export default getHarvardSummaryAgent;
