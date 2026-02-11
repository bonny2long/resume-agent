// src/agents/resume-tailor.agent.ts
import { getLLMService } from "@/services/llm.service";
import { getEmbeddingsService } from "@/services/embeddings.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import storyLoader from "@/utils/story-loader";

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
  atsScore?: number;
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

      logger.success(
        `Job: ${job.title} at ${job.company?.name || "Unknown Company"}`,
      );

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

      // Deduplicate experiences by company + title
      const experienceMap = new Map<string, any>();

      // Group similar experiences together
      relevantExperiences.forEach(({ experience, similarity }) => {
        const key = `${experience.company?.toLowerCase().trim()}_${experience.title?.toLowerCase().trim()}`;

        if (!experienceMap.has(key)) {
          experienceMap.set(key, { experience, similarity });
        } else {
          // Keep the one with higher similarity score
          const existing = experienceMap.get(key);
          if (similarity > existing.similarity) {
            experienceMap.set(key, { experience, similarity });
          }
        }
      });

      // Filter by time overlap
      const deduplicatedList = Array.from(experienceMap.values());
      const finalExperiences: any[] = [];

      deduplicatedList.forEach(({ experience, similarity }) => {
        let isDuplicate = false;

        for (const existing of finalExperiences) {
          const existingExp = existing.experience;

          const sameCompany =
            experience.company?.toLowerCase().trim() ===
            existingExp.company?.toLowerCase().trim();
          const overlappingTime = this.checkTimeOverlap(
            experience.startDate,
            experience.endDate,
            existingExp.startDate,
            existingExp.endDate,
          );

          if (sameCompany && overlappingTime) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          finalExperiences.push({ experience, similarity });
        }
      });

      const deduplicatedExperiences = finalExperiences;
      logger.success(
        `After deduplication: ${deduplicatedExperiences.length} unique experiences`,
      );

      // Sort experiences by date (most recent first)
      deduplicatedExperiences.sort((a, b) => {
        const dateA = new Date(a.experience.startDate).getTime();
        const dateB = new Date(b.experience.startDate).getTime();
        return dateB - dateA;
      });

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

    // Distribute optimized achievements back to experiences
    const optimizedExperiences = await Promise.all(
      relevantExperiences.map(async ({ experience, similarity }) => {
        let currentAchievements = experience.achievements;

        // Enhance trades experience with tech relevance
        if (
          experience.title &&
          (experience.title.toLowerCase().includes("insulator") ||
            experience.title.toLowerCase().includes("electrical") ||
            experience.title.toLowerCase().includes("technician"))
        ) {
          currentAchievements = await this.enhanceTradesExperience(
            experience.achievements,
            job.requiredSkills,
          );
        } else {
          // For non-trade roles, attempt normal optimization
          currentAchievements = await this.optimizeAchievements(
            experience.achievements,
            job.requiredSkills || [],
            job.keywords || [],
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
          achievements: currentAchievements,
          technologies,
          relevanceScore: Math.round(similarity * 100),
        };
      }),
    );

    // Optimize projects with detailed achievement stories
    const optimizedProjects = await Promise.all(
      relevantProjects.map(async ({ project, similarity }) => {
        let technologies: string[] = [];
        if (Array.isArray(project.technologies)) {
          technologies = project.technologies
            .map((t: any) => (typeof t === "string" ? t : t.name || t))
            .filter(Boolean);
        }

        // Load detailed achievement story
        const achievementStory = await this.loadAchievementStory(project.name);
        let enhancedDescription = project.description;
        let enhancedAchievements = project.achievements || [];

        if (achievementStory) {
          // Extract specific metrics and achievements from the detailed story
          const lines = achievementStory.split("\n");
          const metrics: string[] = [];
          const achievements: string[] = [];

          lines.forEach((line) => {
            const cleanLine = line.replace(/^[-•]\s*/, "").trim();
            if (
              cleanLine.includes("%") ||
              cleanLine.includes("+") ||
              cleanLine.includes("users")
            ) {
              metrics.push(cleanLine);
            } else if (cleanLine.length > 10 && !cleanLine.startsWith("#")) {
              achievements.push(cleanLine);
            }
          });

          // Prioritize metrics in achievements
          enhancedAchievements = [
            ...metrics.slice(0, 3),
            ...enhancedAchievements,
            ...achievements.slice(0, 2),
          ];
        }

        return {
          id: project.id,
          name: project.name,
          description: enhancedDescription,
          role: project.role,
          technologies,
          achievements: enhancedAchievements,
          githubUrl: project.githubUrl,
          liveUrl: project.liveUrl,
          relevanceScore: Math.round(similarity * 100),
        };
      }),
    );

    // Filter and order skills
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
        linkedInUrl: masterResume.linkedInUrl || undefined,
        githubUrl: masterResume.githubUrl || undefined,
        portfolioUrl: masterResume.portfolioUrl || undefined,
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
   * Load career transition story using shared loader
   */
  private async loadCareerStory(): Promise<string> {
    try {
      const story = await storyLoader.loadTransitionStory();

      // Combine elements for a comprehensive story
      const storyElements = [story.motivation, story.uniqueValue]
        .filter(Boolean)
        .join(" ");

      return (
        storyElements ||
        "Career transitioner bringing systematic problem-solving from trades to software engineering"
      );
    } catch (error) {
      logger.warn("Could not load transition story", error);
      return "Career transition to technology with strong technical background and systematic problem-solving approach.";
    }
  }

  /**
   * Load achievement story using shared loader
   */
  private async loadAchievementStory(projectName: string): Promise<string> {
    try {
      const story = await storyLoader.loadAchievementStory(projectName);

      if (!story) return "";

      // Combine quantifiable and technical achievements
      const quantifiable = story.quantifiableAchievements
        .map((ach) =>
          ach.metric ? `${ach.description} (${ach.metric})` : ach.description,
        )
        .slice(0, 3);

      const technical = story.technicalAchievements
        .map((ach) => ach.description)
        .slice(0, 2);

      return [...quantifiable, ...technical].join("\n");
    } catch (error) {
      logger.warn(`Could not load achievement story for ${projectName}`, error);
      return "";
    }
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

    // Extract company-specific details for tailored summary
    const companyName = job.company?.name || "this innovative company";
    const companyTech =
      job.company?.techStack ?
        job.company.techStack.join(", ")
      : "modern tech stack";
    const companyValues =
      job.company?.values ?
        job.company.values.slice(0, 3).join(", ")
      : "innovation and excellence";
    const jobResponsibilities =
      job.responsibilities ?
        job.responsibilities.slice(0, 5).join("; ")
      : "developing innovative solutions";
    const jobKeywords =
      job.keywords ?
        job.keywords.slice(0, 8).join(", ")
      : "software development, full-stack";

    const prompt = `You are writing a HIGHLY TAILORED resume summary for a candidate applying specifically to ${companyName}. This summary must demonstrate deep understanding of the company's needs, culture, and technical requirements. Use the candidate's ACTUAL story and experiences - do not use generic templates.

Job Details:
- Title: ${job.title}
- Company: ${companyName}
- Company Tech Stack: ${companyTech}
- Company Values: ${companyValues}
- Required Skills: ${job.requiredSkills.slice(0, 10).join(", ")}
- Experience Level: ${job.experienceLevel}
- Key Responsibilities: ${jobResponsibilities}
- Key Focus Areas: ${jobKeywords}

Candidate Background:
Name: ${masterResume.fullName}
Years of Tech Experience: ${calculatedYears} years
Career Story: ${storyContext}
Core Skills: ${masterResume.skills
      .slice(0, 10)
      .map((s: any) => s.name)
      .join(", ")}

Write a POWERFUL, COMPELLING resume summary with EXACTLY 3 DISTINCT PARAGRAPHS following this specific structure:

Paragraph 1: The "Who You Are" (Identity & Expertise)
- Define professional identity immediately - your "elevator pitch"
- Include your current title/role, years of experience, and your "superpower"
- Focus on professional title, core industry, and high-level overview of expertise
- Use strong adjectives: "Strategic," "Results-oriented," "Data-driven," "Systematic"
- For career transition: Use the actual career story from the storyContext to create authentic, personalized introduction

Paragraph 2: The "What You've Done" (Evidence & Achievements)
- Back up claims with hard data and quantifiable achievements
- Focus on major projects, leadership experience, or specific problems solved
- Use Context-Action-Result format: "Managed X (Context), implemented Y (Action), achieved Z (Result)"
- Include specific achievements from your actual projects using the achievement stories and quantifiable metrics
- Reference the candidate's real project experiences from their portfolio

Paragraph 3: The "What You Offer" (Skills & Future Value)
- Bridge gap between your past and ${companyName}'s future
- Highlight most relevant technical skills and soft skills that align with job description
- Include specialized tools, certifications, and how you'll help ${companyName} reach goals
- Mirror keywords from job posting to help pass ATS systems
- Specific technical skills: Use the candidate's actual skills list from their resume data

CRITICAL REQUIREMENTS:
- MUST be exactly 3 paragraphs (not 1 huge paragraph)
- Each paragraph should be 3-5 sentences
- Must be company-specific to ${companyName}
- Include 2-3 keywords from: ${jobKeywords}
- Focus on professional identity, quantifiable achievements, and future value
- Show genuine interest in ${companyName}'s mission and work

Return ONLY the complete 3-paragraph summary. Do NOT include any formatting, explanations, or extra text.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.5,
      maxTokens: 1024, // Increased token limit for longer summaries
    });

    if (response.success && response.data) {
      let summary = response.data.trim();

      // 🛠️ CRITICAL FIX: Ensure paragraphs are separated by double newlines
      // This splits the text by any number of newlines and rejoins them with distinct double breaks
      summary = summary
        .split(/\n+/) // Split by single or multiple newlines
        .map((p) => p.trim()) // Clean up whitespace
        .filter((p) => p.length > 0) // Remove empty lines
        .join("\n\n"); // Rejoin with EXPLICIT double newlines

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
   * Optimize achievements for ATS keywords (Used in enhancement logic)
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

Relevant Keywords (use ONLY if they naturally apply): ${[
      ...requiredSkills,
      ...keywords,
    ]
      .slice(0, 8)
      .join(", ")}

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
    const resumeText = this.buildResumeText(tailored);
    const jobSkills = [
      ...(job.requiredSkills || []),
      ...(job.preferredSkills || []),
    ];

    // Keyword matching
    const keywords = job.keywords || [];
    const keywordMatches = keywords.filter((keyword: string) =>
      resumeText.toLowerCase().includes(keyword.toLowerCase()),
    ).length;
    const keywordMatch =
      keywords.length > 0 ? (keywordMatches / keywords.length) * 100 : 50;

    // Skill matching
    const resumeSkills = [
      ...tailored.skills.matched,
      ...tailored.skills.relevant,
    ];
    const skillMatches = jobSkills.filter((skill: string) =>
      resumeSkills.some(
        (resumeSkill) =>
          resumeSkill.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(resumeSkill.toLowerCase()),
      ),
    ).length;
    const skillMatch =
      jobSkills.length > 0 ? (skillMatches / jobSkills.length) * 100 : 50;

    // Experience relevance
    const experienceMatch =
      tailored.experiences.reduce((sum, exp) => sum + exp.relevanceScore, 0) /
      tailored.experiences.length;

    // Format score
    const formatScore = this.calculateFormatScore(tailored);

    const overallScore =
      keywordMatch * 0.3 +
      skillMatch * 0.3 +
      experienceMatch * 0.25 +
      formatScore * 0.15;

    return {
      score: Math.round(overallScore),
      breakdown: {
        keywordMatch: Math.round(keywordMatch),
        skillMatch: Math.round(skillMatch),
        experienceMatch: Math.round(experienceMatch),
        formatScore: Math.round(formatScore),
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
  private checkTimeOverlap(
    start1: Date,
    end1: Date | null,
    start2: Date,
    end2: Date | null,
  ): boolean {
    const s1 = new Date(start1);
    const e1 = end1 ? new Date(end1) : new Date();
    const s2 = new Date(start2);
    const e2 = end2 ? new Date(end2) : new Date();

    return s1 <= e2 && s2 <= e1;
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
