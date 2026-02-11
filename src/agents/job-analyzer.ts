// src/agents/job-analyzer.agent.ts
import { getLLMService } from "@/services/llm.service";
import { getWebScraperService } from "@/services/web-scraper.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";

export interface MatchResult {
  score: number;
  matched: string[];
  missing: string[];
  extras: string[];
}

export interface JobAnalysis {
  // Basic Info
  title: string;
  company: string;
  location: string;
  salary?: string;
  jobType?: string; // Full-time, Part-time, Contract
  remote?: boolean;

  // Requirements
  requiredSkills: string[];
  preferredSkills: string[];
  requiredYearsExperience?: number;
  educationRequired?: string;

  // Responsibilities
  responsibilities: string[];

  // Qualifications
  qualifications: string[];

  // Benefits
  benefits?: string[];

  // Keywords for ATS
  keywords: string[];

  // AI Analysis
  experienceLevel:
    | "entry"
    | "junior"
    | "mid"
    | "senior"
    | "staff"
    | "principal"
    | "executive";
  techStack: string[];
  industryKeywords: string[];

  // Metadata
  postedDate?: Date;
  applicationDeadline?: Date;
  originalUrl: string;
}

export class JobAnalyzerAgent {
  private llm = getLLMService();
  private scraper = getWebScraperService();

  /**
   * Analyze a job posting from URL
   */
  async analyzeJobFromUrl(url: string): Promise<AgentResponse<JobAnalysis>> {
    try {
      logger.header("Job Analyzer Agent");
      logger.info("Analyzing job posting", { url });

      // Step 1: Scrape the job posting
      logger.step(1, 3, "Scraping job posting...");
      const scrapedData = await this.scraper.scrapeJobPosting(url);

      // Step 2: Use AI to parse and structure the data
      logger.step(2, 3, "Parsing with AI...");
      const analysis = await this.parseJobWithAI(
        scrapedData.description,
        scrapedData,
      );

      // Step 3: Enrich with additional data
      logger.step(3, 3, "Enriching analysis...");
      const enriched = await this.enrichAnalysis(analysis, url);

      logger.success("Job analysis complete!");

      return {
        success: true,
        data: enriched,
        metadata: {
          duration: 0,
        },
      };
    } catch (error: any) {
      logger.error("Job analysis failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Analyze job from raw text
   */
  async analyzeJobFromText(
    jobText: string,
    basicInfo?: Partial<JobAnalysis>,
  ): Promise<AgentResponse<JobAnalysis>> {
    try {
      logger.header("Job Analyzer Agent");
      logger.info("Analyzing job text");

      const analysis = await this.parseJobWithAI(jobText, basicInfo);

      return {
        success: true,
        data: analysis,
      };
    } catch (error: any) {
      logger.error("Job analysis failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse job description using AI
   */
  private async parseJobWithAI(
    jobText: string,
    basicInfo?: any,
  ): Promise<JobAnalysis> {
    const prompt = `
You are an expert job posting analyzer. Parse this job description and extract structured information.

Job Description:
${jobText}

${basicInfo?.title ? `Title: ${basicInfo.title}` : ""}
${basicInfo?.company ? `Company: ${basicInfo.company}` : ""}
${basicInfo?.location ? `Location: ${basicInfo.location}` : ""}

Extract the following information and return ONLY valid JSON:

{
  "title": "Job title",
  "company": "Company name",
  "location": "Location (city, state/country, or 'Remote')",
  "salary": "Salary range if mentioned, null otherwise",
  "jobType": "Full-time | Part-time | Contract | Internship",
  "remote": boolean,
  
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "requiredYearsExperience": number or null,
  "educationRequired": "Degree requirement or null",
  
  "responsibilities": ["responsibility1", "responsibility2"],
  "qualifications": ["qualification1", "qualification2"],
  "benefits": ["benefit1", "benefit2"],
  
  "keywords": ["keyword1", "keyword2"],
  "experienceLevel": "entry | junior | mid | senior | staff | principal | executive",
  "techStack": ["tech1", "tech2"],
  "industryKeywords": ["keyword1", "keyword2"]
}

Rules:
1. Extract ALL technical skills mentioned (programming languages, frameworks, tools, platforms)
2. Separate required skills from preferred/nice-to-have skills
3. Identify experience level from titles like "Senior", "Junior", "Staff", etc.
4. Extract benefits like health insurance, 401k, PTO, etc.
5. Generate relevant keywords for ATS optimization
6. Identify the tech stack and tools they use
`;

    const response = await this.llm.completeJSON<JobAnalysis>(prompt, {
      temperature: 0.3, // Lower for more consistent extraction
    });

    if (!response.success || !response.data) {
      throw new Error("Failed to parse job with AI: " + response.error);
    }

    return {
      ...response.data,
      originalUrl: basicInfo?.url || "",
    };
  }

  /**
   * Enrich analysis with additional processing
   */
  private async enrichAnalysis(
    analysis: JobAnalysis,
    url: string,
  ): Promise<JobAnalysis> {
    // Add original URL
    analysis.originalUrl = url;

    // Deduplicate skills
    analysis.requiredSkills = [...new Set(analysis.requiredSkills)];
    analysis.preferredSkills = [...new Set(analysis.preferredSkills)];
    analysis.techStack = [...new Set(analysis.techStack)];
    analysis.keywords = [...new Set(analysis.keywords)];

    // Infer experience level if not set
    if (!analysis.experienceLevel) {
      analysis.experienceLevel = this.inferExperienceLevel(analysis.title);
    }

    // Extract years of experience if not found
    if (!analysis.requiredYearsExperience) {
      analysis.requiredYearsExperience = this.extractYearsExperience(
        analysis.qualifications.join(" ") +
          " " +
          analysis.responsibilities.join(" "),
      );
    }

    return analysis;
  }

  /**
   * Infer experience level from job title
   */
  private inferExperienceLevel(title: string): JobAnalysis["experienceLevel"] {
    const lower = title.toLowerCase();

    if (lower.includes("intern") || lower.includes("entry")) return "entry";
    if (lower.includes("junior") || lower.includes("jr")) return "junior";
    if (lower.includes("senior") || lower.includes("sr")) return "senior";
    if (lower.includes("staff")) return "staff";
    if (lower.includes("principal") || lower.includes("lead"))
      return "principal";
    if (
      lower.includes("director") ||
      lower.includes("vp") ||
      lower.includes("head")
    )
      return "executive";

    // Default based on common patterns
    return "mid";
  }

  /**
   * Extract years of experience from text
   */
  private extractYearsExperience(text: string): number | undefined {
    const patterns = [
      /(\d+)\+?\s*years?\s*of\s*experience/i,
      /(\d+)\+?\s*yrs?\s*experience/i,
      /experience:\s*(\d+)\+?\s*years?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return undefined;
  }

  /**
   * Calculate match score between user skills and job requirements
   */
  calculateMatchScore(
    userSkills: string[],
    jobAnalysis: JobAnalysis,
  ): MatchResult {
    const normalizeSkill = (skill: string) => skill.toLowerCase().trim();

    const userSkillsNormalized = userSkills.map(normalizeSkill);
    const requiredSkillsNormalized =
      jobAnalysis.requiredSkills.map(normalizeSkill);
    const preferredSkillsNormalized =
      jobAnalysis.preferredSkills.map(normalizeSkill);

    // Find matches
    const matched = requiredSkillsNormalized.filter((skill) =>
      userSkillsNormalized.includes(skill),
    );

    // Find missing required skills
    const missing = requiredSkillsNormalized.filter(
      (skill) => !userSkillsNormalized.includes(skill),
    );

    // Find user skills that match preferred but not required
    const extras = preferredSkillsNormalized.filter(
      (skill) =>
        userSkillsNormalized.includes(skill) &&
        !requiredSkillsNormalized.includes(skill),
    );

    // Calculate score
    const requiredMatch =
      requiredSkillsNormalized.length > 0 ?
        (matched.length / requiredSkillsNormalized.length) * 100
      : 100;

    const preferredBonus = extras.length * 2; // 2 points per preferred skill

    const score = Math.min(100, Math.round(requiredMatch + preferredBonus));

    return {
      score,
      matched: matched.map(
        (s) =>
          jobAnalysis.requiredSkills.find(
            (orig) => normalizeSkill(orig) === s,
          ) || s,
      ),
      missing: missing.map(
        (s) =>
          jobAnalysis.requiredSkills.find(
            (orig) => normalizeSkill(orig) === s,
          ) || s,
      ),
      extras: extras.map(
        (s) =>
          jobAnalysis.preferredSkills.find(
            (orig) => normalizeSkill(orig) === s,
          ) || s,
      ),
    };
  }
}

// Singleton
let jobAnalyzerAgent: JobAnalyzerAgent | null = null;

export function getJobAnalyzerAgent(): JobAnalyzerAgent {
  if (!jobAnalyzerAgent) {
    jobAnalyzerAgent = new JobAnalyzerAgent();
  }
  return jobAnalyzerAgent;
}

export default getJobAnalyzerAgent;
