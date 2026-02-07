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

      // 🔴 CRITICAL FIX: Deduplicate experiences by company + title
      // This handles multiple master resumes with same jobs but different descriptions
      const experienceMap = new Map<string, any>();
      
      // Group similar experiences together
      relevantExperiences.forEach(({ experience, similarity }) => {
        const key = `${experience.company?.toLowerCase().trim()}_${experience.title?.toLowerCase().trim()}`;
        
        if (!experienceMap.has(key)) {
          experienceMap.set(key, { experience, similarity });
        } else {
          // Keep the one with higher similarity score (more relevant to current job)
          const existing = experienceMap.get(key);
          if (similarity > existing.similarity) {
            logger.info(`Replacing with higher relevance version: ${experience.title} at ${experience.company} (${Math.round(similarity * 100)}% vs ${Math.round(existing.similarity * 100)}%)`);
            experienceMap.set(key, { experience, similarity });
          } else {
            logger.warn(`Duplicate experience filtered: ${experience.title} at ${experience.company} (keeping higher relevance version)`);
          }
        }
      });
      
      // 🚨 ADDITIONAL CHECK: Look for very similar jobs (same company + time + overlapping keywords)
      const deduplicatedList = Array.from(experienceMap.values());
      const finalExperiences: any[] = [];
      
      deduplicatedList.forEach(({ experience, similarity }) => {
        let isDuplicate = false;
        
        // Check against already accepted experiences
        for (const existing of finalExperiences) {
          const existingExp = existing.experience;
          
          // Check for same company AND overlapping time period
          const sameCompany = experience.company?.toLowerCase().trim() === existingExp.company?.toLowerCase().trim();
          const overlappingTime = this.checkTimeOverlap(experience.startDate, experience.endDate, existingExp.startDate, existingExp.endDate);
          
          if (sameCompany && overlappingTime) {
            // Check for similar project/achievement keywords
            const currentKeywords = this.extractKeywords(experience.achievements);
            const existingKeywords = this.extractKeywords(existingExp.achievements);
            const similarity = this.calculateKeywordSimilarity(currentKeywords, existingKeywords);
            
            if (similarity > 0.6) { // 60% keyword similarity threshold
              logger.warn(`Filtered duplicate job: ${experience.title} at ${experience.company} (${Math.round(similarity * 100)}% similar to ${existingExp.title})`);
              isDuplicate = true;
              break;
            }
          }
        }
        
        if (!isDuplicate) {
          finalExperiences.push({ experience, similarity });
        }
      });
      
      const deduplicatedExperiences = finalExperiences;

      logger.success(`After deduplication: ${deduplicatedExperiences.length} unique experiences`);

      // 🔴 CRITICAL FIX: Sort experiences by date (most recent first)
      deduplicatedExperiences.sort((a, b) => {
        const dateA = new Date(a.experience.startDate).getTime();
        const dateB = new Date(b.experience.startDate).getTime();
        return dateB - dateA; // Descending (most recent first)
      });

      logger.info(`Experiences sorted by date (most recent first)`);

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
        deduplicatedExperiences,
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

    // Optimize achievements for ATS and enhance with stories
    const optimizedExperiences = await Promise.all(
      relevantExperiences.map(async ({ experience, similarity }) => {
        let optimizedAchievements = await this.optimizeAchievements(
          experience.achievements,
          job.requiredSkills,
          job.keywords,
        );

        // Enhance trades experience with tech relevance
        if (
          experience.title &&
          (experience.title.toLowerCase().includes("insulator") ||
            experience.title.toLowerCase().includes("electrical"))
        ) {
          optimizedAchievements = await this.enhanceTradesExperience(
            optimizedAchievements,
            job.requiredSkills,
          );
        }

        // Handle technologies array properly
        let technologies: string[] = [];
        if (Array.isArray(experience.technologies)) {
          technologies = experience.technologies
            .map((t: any) => (typeof t === "string" ? t : t.name || t))
            .filter(Boolean);
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
    const optimizedProjects = relevantProjects.map(
      ({ project, similarity }) => {
        // Handle technologies array properly
        let technologies: string[] = [];
        if (Array.isArray(project.technologies)) {
          technologies = project.technologies
            .map((t: any) => (typeof t === "string" ? t : t.name || t))
            .filter(Boolean);
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
      },
    );

    // Filter and order skills - check if skills exist
    let allSkills = [];
    if (masterResume.skills && Array.isArray(masterResume.skills)) {
      allSkills = masterResume.skills;
    }

    const skills = this.filterAndOrderSkills(
      allSkills,
      job.requiredSkills || [],
      job.preferredSkills || [],
    );

    return {
      personalInfo: {
        fullName: masterResume.fullName,
        email: masterResume.email,
        phone: masterResume.phone,
        location: masterResume.location,
        // 🔴 CRITICAL FIX: Validate URLs - only include if they're actual URLs
        linkedInUrl: masterResume.linkedInUrl?.includes('linkedin.com') 
          ? masterResume.linkedInUrl 
          : undefined,
        githubUrl: masterResume.githubUrl?.includes('github.com') 
          ? masterResume.githubUrl 
          : undefined,
        portfolioUrl: masterResume.portfolioUrl?.includes('http') 
          ? masterResume.portfolioUrl 
          : undefined,
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
   * Enhance trades experience with tech relevance
   */
  private async enhanceTradesExperience(
    achievements: any[],
    requiredSkills: string[],
  ): Promise<Array<{ description: string; metrics?: string; impact: string }>> {
    if (!achievements || achievements.length === 0) {
      return [];
    }

    const prompt = `You are enhancing trades experience for a tech resume. The candidate transitioned from electrical technician/insulator to software engineering.

Original Achievements:
${achievements
  .slice(0, 2)
  .map(
    (a, i) => `${i + 1}. ${a.description}${a.metrics ? ` (${a.metrics})` : ""}`,
  )
  .join("\n")}

Target Tech Skills: ${requiredSkills.slice(0, 5).join(", ")}

Reframe achievements to highlight transferable skills for tech roles:
- Systems analysis and troubleshooting
- Project management and leadership
- Technical documentation and precision
- Quality control and attention to detail
- Cross-functional collaboration

Return exactly 2 enhanced achievements in JSON format:
[
  {"description": "enhanced achievement", "metrics": "original metrics", "impact": "high/medium"}
]`;

    try {
      const response = await this.llm.complete(prompt, {
        temperature: 0.3,
        maxTokens: 250,
      });

      if (response.success && response.data) {
        let jsonStr = response.data.trim();
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        }

        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, index) => ({
            description:
              item.description || achievements[index]?.description || "",
            metrics: item.metrics || achievements[index]?.metrics || "",
            impact: item.impact || "medium",
          }));
        }
      }
    } catch (error) {
      logger.warn("Failed to enhance trades experience", error);
    }

    // Fallback to original achievements
    return achievements.slice(0, 2).map((a) => ({
      description: a.description || "",
      metrics: a.metrics || "",
      impact: a.impact || "medium",
    }));
  }

  /**
   * Load career transition story for context
   */
  private async loadCareerStory(): Promise<string> {
    try {
      const fs = await import("fs");
      const path = await import("path");

      const storyPath = path.join(
        process.cwd(),
        "data",
        "resumes",
        "career-transition-story.md",
      );
      if (fs.existsSync(storyPath)) {
        const content = fs.readFileSync(storyPath, "utf-8");
        // Extract key points from the story
        return (
            content.includes(
              "After 6+ years working as an Electrical Technician",
            )
          ) ?
            "Transitioned from electrical technician and heat & frost insulator to software engineering, bringing unique problem-solving perspective from both physical and digital systems."
          : "Made career transition to technology with strong background in technical problem-solving and project management.";
      }
    } catch (error) {
      logger.warn("Could not load career story", error);
    }
    return "Career transition to technology with strong technical background.";
  }

  /**
   * Generate a tailored professional summary
   */
  private async generateTailoredSummary(
    job: any,
    masterResume: any,
  ): Promise<string> {
    const calculatedYears = this.calculateYearsExperience(
      masterResume.experiences,
    );

    // Load career transition story
    const storyContext = await this.loadCareerStory();

    const prompt = `You are writing a POWERFUL resume summary for a career transition candidate. Make it compelling and memorable.

Job Title: ${job.title}
Company: ${job.company?.name || "Company"}
Required Skills: ${job.requiredSkills.slice(0, 10).join(", ")}
Experience Level: ${job.experienceLevel}

Candidate's EXTRAORDINARY Background:
Name: ${masterResume.fullName}
ACTUAL Years of Tech Experience: ${calculatedYears} years
Career Story: ${storyContext}
Top Skills: ${masterResume.skills
      .slice(0, 10)
      .map((s: any) => s.name)
      .join(", ")}

Write a POWERFUL, MEMORABLE professional summary (max 3 sentences) that:

1. **LEADS with the career transition** - "After 6+ years as an electrical technician and heat & frost insulator..." 
2. **Shows the WHY** - What drove the transition to tech
3. **Highlights the UNIQUE ADVANTAGE** - How trades background makes thFem a better developer
4. **Incorporates job-specific skills** - 2-3 keywords from required skills
5. **Uses strong, active language** - No passive or weak phrases

CAREER TRANSITION STORY TO INTEGRATE:
- Spent 6+ years in trades (electrical technician + heat & frost insulator)
- Discovered passion for solving problems through technology
- Troubleshooting complex electrical systems → Debugging code
- Reading schematics → Understanding system architecture
- Managing trade projects → Leading software development
- Methodical, safety-first approach → Quality code practices

POWER WORDS TO USE: "transitioned", "discovered", "leveraged", "bridged", "unique", "perspective", "methodical", "systematic"

Return ONLY the powerful summary text.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.5,
      maxTokens: 150,
    });

    if (response.success && response.data) {
      const summary = response.data.trim();
      // Validate that the summary doesn't contain fabricated experience
      if (
        !summary.includes("1.2 years") &&
        !summary.includes("years of full-stack")
      ) {
        return summary;
      }
    }

    // Fallback to original summary with minimal tailoring
    const originalSummary =
      masterResume.summaryShort || masterResume.summaryLong || "";
    if (originalSummary) {
      // Add 1-2 relevant keywords if they fit naturally
      const relevantKeywords = job.requiredSkills
        .filter(
          (skill: string) =>
            originalSummary.toLowerCase().includes(skill.toLowerCase()) ||
            masterResume.skills.some((s: any) =>
              s.name.toLowerCase().includes(skill.toLowerCase()),
            ),
        )
        .slice(0, 2);

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
${achievements
  .slice(0, 3)
  .map(
    (a, i) => `${i + 1}. ${a.description}${a.metrics ? ` (${a.metrics})` : ""}`,
  )
  .join("\n")}

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
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        } else if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/```\n?/g, "").replace(/```\n?$/g, "");
        }

        // Look for JSON array in the response
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item, index) => ({
            description:
              item.description || achievements[index]?.description || "",
            metrics: item.metrics || achievements[index]?.metrics || "",
            impact: item.impact || achievements[index]?.impact || "medium",
          }));
        }
      } catch (parseError: any) {
        logger.warn("Failed to parse optimized achievements", {
          error: parseError?.message || "Unknown error",
          response: response.data?.substring(0, 200) || "",
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
        return skills
          .map((s: any) => {
            if (typeof s === "string") return s;
            if (s && s.name) return s.name;
            return "";
          })
          .filter(Boolean);
      }

      if (typeof skills === "object") {
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

    experiences.forEach((exp) => {
      // Only count tech/software roles
      const title = (exp.title || "").toLowerCase();
      const company = (exp.company || "").toLowerCase();

      const isTechRole = techKeywords.some(
        (keyword) => title.includes(keyword) || company.includes(keyword),
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
   * Check if two time periods overlap
   */
  private checkTimeOverlap(start1: Date, end1: Date | null, start2: Date, end2: Date | null): boolean {
    const s1 = new Date(start1);
    const e1 = end1 ? new Date(end1) : new Date();
    const s2 = new Date(start2);
    const e2 = end2 ? new Date(end2) : new Date();
    
    return s1 <= e2 && s2 <= e1;
  }

  /**
   * Extract keywords from achievements
   */
  private extractKeywords(achievements: any[]): string[] {
    if (!achievements || achievements.length === 0) return [];
    
    const text = achievements
      .map((a: any) => a.description || '')
      .join(' ')
      .toLowerCase();
    
    // Extract important keywords (companies, technologies, project names)
    const keywords = [];
    
    // Company/project names (capitalized words)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    keywords.push(...capitalizedWords);
    
    // Tech keywords
    const techKeywords = ['ai', 'api', 'dashboard', 'platform', 'python', 'llm', 'rbac', 'backend', 'frontend', 'full stack'];
    techKeywords.forEach(keyword => {
      if (text.includes(keyword)) keywords.push(keyword);
    });
    
    return [...new Set(keywords)];
  }

  /**
   * Calculate keyword similarity between two sets
   */
  private calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2.map(k => k.toLowerCase()));
    
    const intersection = new Set([...set1].filter(k => set2.has(k)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
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
