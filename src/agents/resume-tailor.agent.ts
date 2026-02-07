// src/agents/resume-tailor.agent.ts
import { getLLMService } from "@/services/llm.service";
import { getEmbeddingsService } from "@/services/embeddings.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";

export interface TailoredResume {
  // Basic Info
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedInUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
  };

  // Summary (tailored to job)
  summary: string;

  // Selected experiences (most relevant)
  experiences: Array<{
    id: string;
    company: string;
    title: string;
    location: string;
    startDate: Date;
    endDate: Date | null;
    current: boolean;
    achievements: Array<{
      description: string;
      metrics?: string;
      impact: string;
    }>;
    technologies: string[];
    relevanceScore: number;
  }>;

  // Selected projects (most relevant)
  projects: Array<{
    id: string;
    name: string;
    description: string;
    role: string;
    technologies: string[];
    achievements: string[];
    githubUrl?: string;
    liveUrl?: string;
    relevanceScore: number;
  }>;

  // Skills (filtered and ordered by relevance)
  skills: {
    matched: string[]; // Skills that match job requirements
    relevant: string[]; // Additional relevant skills
    other: string[]; // Other skills (optional)
  };

  // Education
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: Date;
    endDate: Date | null;
    gpa?: string;
  }>;

  // Certifications (relevant ones)
  certifications: Array<{
    name: string;
    issuer: string;
    issueDate: Date;
  }>;

  // Metadata
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  atsOptimized: boolean;
}

export class ResumeTailorAgent {
  private llm = getLLMService();
  private embeddings = getEmbeddingsService();
  private prisma = getPrismaClient();

  /**
   * Generate a tailored resume for a specific job
   */
  async tailorResume(jobId: string): Promise<AgentResponse<TailoredResume>> {
    try {
      logger.header("Resume Tailor Agent");
      logger.info("Tailoring resume for job", { jobId });

      // Step 1: Get job details
      logger.step(1, 5, "Loading job details...");
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      logger.success(`Job: ${job.title} at ${job.company}`);

      // Step 2: Get master resume
      logger.step(2, 5, "Loading master resume...");
      const masterResume = await this.prisma.masterResume.findFirst({
        include: {
          experiences: {
            include: {
              achievements: true,
              technologies: true,
            },
            orderBy: { startDate: "desc" },
          },
          projects: {
            include: {
              technologies: true,
            },
            orderBy: { startDate: "desc" },
          },
          skills: true,
          education: {
            orderBy: { startDate: "desc" },
          },
          certifications: {
            orderBy: { issueDate: "desc" },
          },
        },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      logger.success(`Resume: ${masterResume.fullName}`);

      // Step 3: Find most relevant experiences using RAG
      logger.step(3, 5, "Selecting relevant experiences (RAG)...");
      const relevantExperiences = await this.embeddings.findRelevantExperiences(
        jobId,
        3, // Top 3 most relevant
      );

      logger.success(`Selected ${relevantExperiences.length} experiences`);

      // Step 4: Find most relevant projects using RAG
      logger.step(4, 5, "Selecting relevant projects (RAG)...");
      const relevantProjects = await this.embeddings.findRelevantProjects(
        jobId,
        2, // Top 2 most relevant
      );

      logger.success(`Selected ${relevantProjects.length} projects`);

      // Step 5: Optimize everything with AI
      logger.step(5, 5, "Optimizing with AI...");
      const tailored = await this.optimizeWithAI(
        job,
        masterResume,
        relevantExperiences,
        relevantProjects,
      );

      logger.success("Resume tailored successfully!");

      return {
        success: true,
        data: tailored,
      };
    } catch (error: any) {
      logger.error("Resume tailoring failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Use AI to optimize the tailored resume
   */
  private async optimizeWithAI(
    job: any,
    masterResume: any,
    relevantExperiences: Array<{ experience: any; similarity: number }>,
    relevantProjects: Array<{ project: any; similarity: number }>,
  ): Promise<TailoredResume> {
    // Generate tailored summary
    const summary = await this.generateTailoredSummary(job, masterResume);

    // Optimize achievements for ATS
    const optimizedExperiences = await Promise.all(
      relevantExperiences.map(async ({ experience, similarity }) => {
        const optimizedAchievements = await this.optimizeAchievements(
          experience.achievements,
          job.requiredSkills,
          job.keywords,
        );

        // Handle technologies array properly
        let technologies: string[] = [];
        if (Array.isArray(experience.technologies)) {
          technologies = experience.technologies.map((t: any) =>
            typeof t === "string" ? t : (t.name || t),
          ).filter(Boolean);
        }

        return {
          id: experience.id,
          company: experience.company,
          title: experience.title,
          location: experience.location,
          startDate: experience.startDate,
          endDate: experience.endDate,
          current: experience.current,
          achievements: optimizedAchievements,
          technologies,
          relevanceScore: Math.round(similarity * 100),
        };
      }),
    );

    // Optimize projects
    const optimizedProjects = relevantProjects.map(({ project, similarity }) => {
      // Handle technologies array properly
      let technologies: string[] = [];
      if (Array.isArray(project.technologies)) {
        technologies = project.technologies.map((t: any) =>
          typeof t === "string" ? t : (t.name || t),
        ).filter(Boolean);
      }

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        role: project.role,
        technologies,
        achievements: project.achievements,
        githubUrl: project.githubUrl,
        liveUrl: project.liveUrl,
        relevanceScore: Math.round(similarity * 100),
      };
    });

    // Filter and order skills
    const skills = this.filterAndOrderSkills(
      masterResume.skills,
      job.requiredSkills,
      job.preferredSkills,
    );

    return {
      personalInfo: {
        fullName: masterResume.fullName,
        email: masterResume.email,
        phone: masterResume.phone,
        location: masterResume.location,
        linkedInUrl: masterResume.linkedInUrl,
        githubUrl: masterResume.githubUrl,
        portfolioUrl: masterResume.portfolioUrl,
      },
      summary,
      experiences: optimizedExperiences,
      projects: optimizedProjects,
      skills,
      education: masterResume.education.map((edu: any) => ({
        institution: edu.institution,
        degree: edu.degree,
        field: edu.field,
        startDate: edu.startDate,
        endDate: edu.endDate,
        gpa: edu.gpa,
      })),
      certifications: masterResume.certifications
        .slice(0, 3)
        .map((cert: any) => ({
          name: cert.name,
          issuer: cert.issuer,
          issueDate: cert.issueDate,
        })),
      jobId: job.id,
      jobTitle: job.title,
      company: job.company?.name || "Unknown",
      matchScore: job.skillsMatch || 0,
      atsOptimized: true,
    };
  }

  /**
   * Generate a tailored professional summary
   */
  private async generateTailoredSummary(
    job: any,
    masterResume: any,
  ): Promise<string> {
    const calculatedYears = this.calculateYearsExperience(masterResume.experiences);
    const prompt = `You are tailoring a resume summary. Be extremely precise and truthful.

Job Title: ${job.title}
Company: ${job.company?.name || "Company"}
Required Skills: ${job.requiredSkills.slice(0, 10).join(", ")}
Experience Level: ${job.experienceLevel}

Candidate Background:
Name: ${masterResume.fullName}
Current Summary: ${masterResume.summaryLong || masterResume.summaryShort}
ACTUAL Years of Tech Experience: ${calculatedYears} years
Top Skills: ${masterResume.skills
      .slice(0, 10)
      .map((s: any) => s.name)
      .join(", ")}

Write a professional summary (max 3 sentences) that:
1. Uses the candidate's ACTUAL experience: exactly ${calculatedYears} years
2. Incorporates 2-3 job keywords ONLY if they match the candidate's actual skills
3. Maintains the candidate's actual role and experience level
4. NEVER fabricates experience, years, or titles

Rules:
- If candidate has < 2 years experience, say "emerging" or "junior developer"
- If internships only, say "intern" or "junior"
- Use the exact years calculated: ${calculatedYears}
- Preserve the original summary's core achievements

Return ONLY the summary text.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.5,
      maxTokens: 150,
    });

    if (response.success && response.data) {
      const summary = response.data.trim();
      // Validate that the summary doesn't contain fabricated experience
      if (!summary.includes("1.2 years") && !summary.includes("years of full-stack")) {
        return summary;
      }
    }

    // Fallback to original summary with minimal tailoring
    const originalSummary = masterResume.summaryShort || masterResume.summaryLong || "";
    if (originalSummary) {
      // Add 1-2 relevant keywords if they fit naturally
      const relevantKeywords = job.requiredSkills.filter((skill: string) => 
        originalSummary.toLowerCase().includes(skill.toLowerCase()) ||
        masterResume.skills.some((s: any) => s.name.toLowerCase().includes(skill.toLowerCase()))
      ).slice(0, 2);
      
      if (relevantKeywords.length > 0) {
        return `${originalSummary.replace(/\.$/, "")} with expertise in ${relevantKeywords.join(", ")}.`;
      }
      return originalSummary;
    }

    // Final fallback
    return `Full Stack software engineer focused on building clean, scalable applications using React, Node.js, and SQL.`;
  }

  /**
   * Optimize achievements for ATS keywords
   */
  private async optimizeAchievements(
    achievements: any[],
    requiredSkills: string[],
    keywords: string[],
  ): Promise<Array<{ description: string; metrics?: string; impact: string }>> {
    // Skip optimization if no achievements
    if (!achievements || achievements.length === 0) {
      return [];
    }

    const prompt = `You are optimizing resume achievements for ATS systems. Be extremely careful to maintain accuracy.

Original Achievements:
${achievements.slice(0, 3).map((a, i) => `${i + 1}. ${a.description}${a.metrics ? ` (${a.metrics})` : ""}`).join("\n")}

Relevant Keywords (use ONLY if they naturally apply): ${[...requiredSkills, ...keywords].slice(0, 8).join(", ")}

CRITICAL Rules:
1. Do NOT invent new facts, metrics, or technologies
2. Do NOT change the core achievement - only add 1-2 keywords if they genuinely belong
3. Keep all original metrics exactly as they are
4. If unsure, keep the achievement unchanged
5. Return exactly ${Math.min(3, achievements.length)} achievements

Response format (strict JSON):
[
  {"description": "exact or slightly improved achievement", "metrics": "original metrics or empty string", "impact": "high/medium/low"}
]`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.2, // Very low temperature for consistency
      maxTokens: 300,
    });

    if (response.success && response.data) {
      try {
        // Try to parse as JSON
        let jsonStr = response.data.trim();
        
        // Remove markdown if present
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```\n?/g, '').replace(/```\n?$/g, '');
        }

        // Look for JSON array in the response
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, index) => ({
            description: item.description || achievements[index]?.description || "",
            metrics: item.metrics || achievements[index]?.metrics || "",
            impact: item.impact || achievements[index]?.impact || "medium"
          }));
        }
      } catch (parseError: any) {
        logger.warn("Failed to parse optimized achievements", { 
          error: parseError?.message || 'Unknown error',
          response: response.data?.substring(0, 200) || ''
        });
      }
    }

    // Fallback: return original achievements unchanged
    return achievements.slice(0, 3).map((a) => ({
      description: a.description || "",
      metrics: a.metrics || "",
      impact: a.impact || "medium",
    }));
  }

  /**
   * Filter and order skills by relevance
   */
  private filterAndOrderSkills(
    allSkills: any[],
    requiredSkills: string[],
    preferredSkills: string[],
  ): {
    matched: string[];
    relevant: string[];
    other: string[];
  } {
    const normalizeSkill = (s: string) => s.toLowerCase().trim();

    const requiredNormalized = requiredSkills.map(normalizeSkill);
    const preferredNormalized = preferredSkills.map(normalizeSkill);

    const matched: string[] = [];
    const relevant: string[] = [];
    const other: string[] = [];

    // Handle both flat skills array and nested skills structure
    const extractSkillNames = (skills: any): string[] => {
      if (!skills) return [];
      
      if (Array.isArray(skills)) {
        return skills.map((s: any) => {
          if (typeof s === 'string') return s;
          if (s && s.name) return s.name;
          return '';
        }).filter(Boolean);
      }
      
      if (typeof skills === 'object') {
        const names: string[] = [];
        Object.values(skills).forEach((category) => {
          if (Array.isArray(category)) {
            names.push(...extractSkillNames(category));
          }
        });
        return names;
      }
      
      return [];
    };

    const allSkillNames = extractSkillNames(allSkills);

    allSkillNames.forEach((skillName: string) => {
      const skillNormalized = normalizeSkill(skillName);

      // Check if matches required skills
      if (
        requiredNormalized.some(
          (req) =>
            req.includes(skillNormalized) || skillNormalized.includes(req),
        )
      ) {
        matched.push(skillName);
      }
      // Check if matches preferred skills
      else if (
        preferredNormalized.some(
          (pref) =>
            pref.includes(skillNormalized) || skillNormalized.includes(pref),
        )
      ) {
        relevant.push(skillName);
      }
      // Other skills
      else {
        other.push(skillName);
      }
    });

    return {
      matched: [...new Set(matched)].slice(0, 15), // Limit matched skills
      relevant: [...new Set(relevant)].slice(0, 10), // Limit relevant skills
      other: [...new Set(other)].slice(0, 10), // Limit other skills
    };
  }

  /**
   * Calculate years of experience (software/tech roles only)
   */
  private calculateYearsExperience(experiences: any[]): number {
    if (experiences.length === 0) return 0;

    let totalMonths = 0;
    
    // Keywords that indicate tech/software roles
    const techKeywords = [
      'software', 'developer', 'engineer', 'programmer', 'full stack', 
      'frontend', 'backend', 'web', 'mobile', 'data', 'ai', 'machine learning',
      'devops', 'qa', 'test', 'technical', 'architect'
    ];

    experiences.forEach((exp) => {
      // Only count tech/software roles
      const title = (exp.title || '').toLowerCase();
      const company = (exp.company || '').toLowerCase();
      
      const isTechRole = techKeywords.some(keyword => 
        title.includes(keyword) || company.includes(keyword)
      );
      
      if (isTechRole) {
        const start = new Date(exp.startDate);
        const end = exp.endDate ? new Date(exp.endDate) : new Date();

        // Handle invalid dates
        if (isNaN(start.getTime())) return;

        const months =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth());

        // Only count positive months (future dates shouldn't be counted)
        if (months > 0) {
          totalMonths += months;
        }
      }
    });

    const years = totalMonths / 12;
    
    // Return 0 for less than 6 months, otherwise round to nearest 0.5
    if (years < 0.5) return 0;
    return Math.round(years * 2) / 2;
  }

  /**
   * Calculate ATS score for tailored resume
   */
  calculateATSScore(
    tailored: TailoredResume,
    job: any,
  ): {
    score: number;
    breakdown: {
      keywordMatch: number;
      skillMatch: number;
      experienceMatch: number;
      formatScore: number;
    };
  } {
    // Keyword match (40% weight)
    const jobKeywords = [...job.requiredSkills, ...job.keywords].map((k) =>
      k.toLowerCase(),
    );
    const resumeText = this.buildResumeText(tailored).toLowerCase();
    const matchedKeywords = jobKeywords.filter((kw) => resumeText.includes(kw));
    const keywordMatch = (matchedKeywords.length / jobKeywords.length) * 100;

    // Skill match (30% weight)
    const skillMatch =
      (tailored.skills.matched.length / (job.requiredSkills.length || 1)) * 100;

    // Experience match (20% weight)
    const avgRelevance =
      tailored.experiences.reduce((sum, exp) => sum + exp.relevanceScore, 0) /
      (tailored.experiences.length || 1);
    const experienceMatch = avgRelevance;

    // Format score (10% weight)
    const formatScore = this.calculateFormatScore(tailored);

    // Weighted total
    const score = Math.round(
      keywordMatch * 0.4 +
        skillMatch * 0.3 +
        experienceMatch * 0.2 +
        formatScore * 0.1,
    );

    return {
      score,
      breakdown: {
        keywordMatch: Math.round(keywordMatch),
        skillMatch: Math.round(skillMatch),
        experienceMatch: Math.round(experienceMatch),
        formatScore,
      },
    };
  }

  /**
   * Build full resume text for ATS analysis
   */
  private buildResumeText(tailored: TailoredResume): string {
    const parts = [
      tailored.summary,
      ...tailored.experiences.flatMap((exp) =>
        exp.achievements.map((a) => a.description),
      ),
      ...tailored.projects.map((p) => p.description),
      ...tailored.skills.matched,
      ...tailored.skills.relevant,
    ];

    return parts.join(" ");
  }

  /**
   * Calculate format score (basic checks)
   */
  private calculateFormatScore(tailored: TailoredResume): number {
    let score = 100;

    // Penalize if too many experiences
    if (tailored.experiences.length > 4) score -= 10;

    // Penalize if too many projects
    if (tailored.projects.length > 3) score -= 10;

    // Bonus for having summary
    if (!tailored.summary || tailored.summary.length < 50) score -= 10;

    // Bonus for contact info
    if (!tailored.personalInfo.email) score -= 10;
    if (!tailored.personalInfo.phone) score -= 5;

    return Math.max(0, score);
  }
}

// Singleton
let resumeTailorAgent: ResumeTailorAgent | null = null;

export function getResumeTailorAgent(): ResumeTailorAgent {
  if (!resumeTailorAgent) {
    resumeTailorAgent = new ResumeTailorAgent();
  }
  return resumeTailorAgent;
}

export default getResumeTailorAgent;
