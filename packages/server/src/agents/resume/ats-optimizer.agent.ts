// src/agents/resume/ats-optimizer.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import VoiceLoader from "@/utils/voice-loader";

export interface ATSKeywordAnalysis {
  keyword: string;
  category: "required" | "preferred" | "bonus" | "missing";
  frequency: number;
  placement: string[];
  weight: number;
}

export interface ATSOptimizationReport {
  overallScore: number;
  keywordAnalysis: ATSKeywordAnalysis[];
  sectionScores: {
    summary: number;
    experience: number;
    skills: number;
    education: number;
  };
  recommendations: string[];
  formatGuidance: {
    recommendedFormat: "PDF" | "DOCX";
    fontGuidelines: string;
    marginGuidelines: string;
    sectionHeadings: string[];
    avoidElements: string[];
  };
  atsEstimatedMatch: number;
  beforeOptimization?: string;
  afterOptimization?: string;
}

export class ATSOptimizerAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  async optimizeForATS(jobId: string): Promise<AgentResponse<ATSOptimizationReport>> {
    try {
      logger.header("ATS Optimizer Agent");
      logger.info("Analyzing ATS optimization for job", { jobId });

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
          projects: true,
          skills: true,
          education: true,
        },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const analysis = await this.analyzeAndOptimize(job, masterResume);

      logger.success("ATS optimization complete");

      return {
        success: true,
        data: analysis,
      };
    } catch (error: any) {
      logger.error("ATS optimization failed", error);
      return { success: false, error: error.message };
    }
  }

  async analyzeResumeATS(resumeText: string, jobDescription: string): Promise<AgentResponse<ATSOptimizationReport>> {
    try {
      logger.header("ATS Optimizer Agent");
      logger.info("Analyzing standalone resume ATS compatibility");

      const voiceGuidance = await VoiceLoader.getVoiceGuidance();

      const prompt = `${voiceGuidance}

---

You are a senior Google recruiter who has reviewed 50,000+ resumes and knows exactly how ATS systems score and filter candidates.

## Your Task
Analyze the resume against the job description and provide:
1. Keyword extraction from job description
2. Keyword placement analysis
3. ATS score estimation
4. Format recommendations
5. Section heading optimization

## Resume:
${resumeText}

## Job Description:
${jobDescription}

## Output Format (Strict JSON):
{
  "overallScore": 0-100,
  "keywordAnalysis": [
    {
      "keyword": "JavaScript",
      "category": "required|preferred|bonus|missing",
      "frequency": 3,
      "placement": ["summary", "experience", "skills"],
      "weight": 1.0
    }
  ],
  "sectionScores": {
    "summary": 0-100,
    "experience": 0-100,
    "skills": 0-100,
    "education": 0-100
  },
  "recommendations": [
    "Add keyword X to summary section",
    "Include acronym Y alongside full term"
  ],
  "formatGuidance": {
    "recommendedFormat": "PDF|DOCX",
    "fontGuidelines": "Use Arial or Calibri 10-12pt",
    "marginGuidelines": "0.5-1 inch margins",
    "sectionHeadings": ["Work Experience", "Education", "Skills"],
    "avoidElements": ["tables", "columns", "graphics"]
  },
  "atsEstimatedMatch": 0-100
}

Return ONLY valid JSON.`;

      const response = await this.llm.complete(prompt, {
        temperature: 0.2,
        maxTokens: 1500,
      });

      if (response.success && response.data) {
        try {
          let jsonStr = response.data.trim();
          if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
          }

          const parsed = JSON.parse(jsonStr);
          return { success: true, data: parsed };
        } catch (parseError) {
          logger.warn("Failed to parse ATS analysis", parseError);
        }
      }

      return {
        success: false,
        error: "Failed to generate ATS analysis",
      };
    } catch (error: any) {
      logger.error("ATS analysis failed", error);
      return { success: false, error: error.message };
    }
  }

  private async analyzeAndOptimize(job: any, masterResume: any): Promise<ATSOptimizationReport> {
    const voiceGuidance = await VoiceLoader.getVoiceGuidance();

    const resumeText = this.buildResumeText(masterResume);

    const prompt = `${voiceGuidance}

---

You are a senior Google recruiter optimizing resumes for ATS systems.

## Job Requirements:
Required Skills: ${(job.requiredSkills || []).join(", ")}
Preferred Skills: ${(job.preferredSkills || []).join(", ")}

## Current Resume:
${resumeText.slice(0, 3000)}

## Your Task
Analyze and provide ATS optimization report with:
1. Keyword extraction and matching
2. Section heading recommendations (ATS-recognized headings only)
3. Format guidance (PDF vs DOCX, fonts, margins)
4. Score estimation

## Standard ATS Section Headings (use these):
- Work Experience / Professional Experience
- Education
- Skills / Technical Skills
- Summary / Professional Summary
- Certifications

## Output (Strict JSON):
{
  "overallScore": number,
  "keywordAnalysis": [
    {
      "keyword": "string",
      "category": "required|preferred|bonus|missing",
      "frequency": number,
      "placement": ["summary", "experience", "skills"],
      "weight": number
    }
  ],
  "sectionScores": {
    "summary": number,
    "experience": number,
    "skills": number,
    "education": number
  },
  "recommendations": ["string"],
  "formatGuidance": {
    "recommendedFormat": "PDF",
    "fontGuidelines": "string",
    "marginGuidelines": "string",
    "sectionHeadings": ["Work Experience", "Education", "Skills"],
    "avoidElements": ["string"]
  },
  "atsEstimatedMatch": number
}`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.2,
      maxTokens: 1500,
    });

    if (response.success && response.data) {
      try {
        let jsonStr = response.data.trim();
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        }

        return JSON.parse(jsonStr);
      } catch (parseError) {
        logger.warn("Failed to parse ATS optimization", parseError);
      }
    }

    return this.getDefaultAnalysis();
  }

  private buildResumeText(resume: any): string {
    const parts = [
      resume.summaryShort || resume.summaryLong || "",
      ...resume.experiences.flatMap((exp: any) =>
        exp.achievements.map((a: any) => a.description),
      ),
      ...resume.skills.map((s: any) => s.name),
    ];

    return parts.join(" ");
  }

  private getDefaultAnalysis(): ATSOptimizationReport {
    return {
      overallScore: 50,
      keywordAnalysis: [],
      sectionScores: {
        summary: 50,
        experience: 50,
        skills: 50,
        education: 50,
      },
      recommendations: ["Add more keywords from job description"],
      formatGuidance: {
        recommendedFormat: "PDF",
        fontGuidelines: "Use Arial or Calibri, 10-12pt",
        marginGuidelines: "0.5-1 inch margins",
        sectionHeadings: ["Work Experience", "Education", "Skills"],
        avoidElements: ["tables", "columns", "text boxes", "graphics"],
      },
      atsEstimatedMatch: 50,
    };
  }

  async saveToDatabase(resumeId: string, jobId: string | null, analysis: ATSOptimizationReport): Promise<void> {
    try {
      // Save new ATS analysis
      await this.prisma.aTSAnalysis.create({
        data: {
          resumeId,
          jobId: jobId || null,
          overallScore: analysis.overallScore,
          atsMatchScore: analysis.atsEstimatedMatch,
          summaryScore: analysis.sectionScores.summary,
          experienceScore: analysis.sectionScores.experience,
          skillsScore: analysis.sectionScores.skills,
          educationScore: analysis.sectionScores.education,
          keywordAnalysis: analysis.keywordAnalysis as any,
          recommendations: analysis.recommendations,
          formatGuidance: analysis.formatGuidance as any,
        },
      });

      logger.debug("Saved ATS analysis to database");
    } catch (error) {
      logger.warn("Failed to save ATS analysis to database", error);
    }
  }

  async getFromDatabase(resumeId: string, jobId?: string): Promise<ATSOptimizationReport | null> {
    const record = await this.prisma.aTSAnalysis.findFirst({
      where: {
        resumeId,
        jobId: jobId || undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) return null;

    return {
      overallScore: record.overallScore,
      keywordAnalysis: record.keywordAnalysis as any,
      sectionScores: {
        summary: record.summaryScore,
        experience: record.experienceScore,
        skills: record.skillsScore,
        education: record.educationScore,
      },
      recommendations: record.recommendations,
      formatGuidance: record.formatGuidance as any,
      atsEstimatedMatch: record.atsMatchScore,
    };
  }
}

let atsOptimizerAgent: ATSOptimizerAgent | null = null;

export function getATSOptimizerAgent(): ATSOptimizerAgent {
  if (!atsOptimizerAgent) {
    atsOptimizerAgent = new ATSOptimizerAgent();
  }
  return atsOptimizerAgent;
}

export default getATSOptimizerAgent;
