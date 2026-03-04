// src/agents/resume-tailor.agent.ts
import { getLLMService } from "@/services/llm.service";
import { getEmbeddingsService } from "@/services/embeddings.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import storyLoader from "@/utils/story-loader";
import VoiceLoader from "@/utils/voice-loader";
import { HumannessChecker } from "@/utils/humanness-checker";
import chalk from "chalk";

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

  // Engineering skills (system design, architecture, etc.)
  engineeringSkills?: {
    systemDesign: string[];
    security: string[];
    performance: string[];
    architecture: string[];
    database: string[];
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

  private async resolveRootResumeId(resumeId?: string): Promise<string | undefined> {
    if (!resumeId) return undefined;

    let currentId = resumeId;
    const seen = new Set<string>();

    for (let depth = 0; depth < 12; depth += 1) {
      if (seen.has(currentId)) break;
      seen.add(currentId);

      const resume = await this.prisma.masterResume.findUnique({
        where: { id: currentId },
        select: { id: true, tailoredFromId: true },
      });

      if (!resume) break;
      if (!resume.tailoredFromId) return resume.id;
      currentId = resume.tailoredFromId;
    }

    return currentId;
  }

  /**
   * Generate a tailored resume for a specific job
   * @param jobId - The job ID to tailor for
   * @param options - Optional parameters including enhanced mode
   */
  async tailorResume(
    jobId: string,
    options?: { enhanced?: boolean; resumeId?: string },
  ): Promise<AgentResponse<TailoredResume>> {
    const enhanced = options?.enhanced || false;
    const requestedResumeId = options?.resumeId;

    try {
      const resumeId = await this.resolveRootResumeId(requestedResumeId);
      logger.header("Resume Tailor Agent");
      logger.info("Tailoring resume for job", { jobId, enhanced });

      // ENHANCED PIPELINE: Run all enhancements first
      if (enhanced) {
        await this.runEnhancedPipeline(jobId, resumeId);
      }

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
      const masterResume = resumeId
        ? await this.prisma.masterResume.findUnique({
            where: { id: resumeId },
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
          })
        : await this.prisma.masterResume.findFirst({
            where: {
              tailoredFromId: null,
            },
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
        throw new Error(resumeId ? "Resume not found" : "No master resume found");
      }

      logger.success(`Resume: ${masterResume.fullName}`);

      // Step 3: Find most relevant experiences using RAG
      logger.step(3, 5, "Selecting relevant experiences (RAG)...");
      let relevantExperiences;
      try {
        relevantExperiences = await this.embeddings.findRelevantExperiences(
          jobId,
          3, // Top 3 most relevant
        );
        logger.success(`Selected ${relevantExperiences.length} experiences`);
      } catch (error) {
        logger.warn("RAG selection failed, falling back to recent experiences");
        relevantExperiences = masterResume.experiences
          .slice(0, 3)
          .map((exp) => ({
            experience: exp,
            similarity: 1.0,
          }));
      }

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
        const dateA = new Date(a.experience.startDate).getTime() || 0;
        const dateB = new Date(b.experience.startDate).getTime() || 0;
        return dateB - dateA;
      });

      // Step 4: Find most relevant projects using RAG
      logger.step(4, 5, "Selecting relevant projects (RAG)...");
      let relevantProjects;
      try {
        relevantProjects = await this.embeddings.findRelevantProjects(
          jobId,
          2, // Top 2 most relevant
        );
        logger.success(`Selected ${relevantProjects.length} projects`);
      } catch (error) {
        logger.warn("RAG selection failed, falling back to recent projects");
        relevantProjects = masterResume.projects.slice(0, 2).map((proj) => ({
          project: proj,
          similarity: 1.0,
        }));
      }

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
   * Generate only the tailored summary for a job (public method)
   * Useful for passing to other agents for cohesive messaging
   */
  async generateSummaryOnly(jobId: string, resumeId?: string): Promise<AgentResponse<string>> {
    try {
      const resolvedResumeId = await this.resolveRootResumeId(resumeId);
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      const masterResume = resolvedResumeId
        ? await this.prisma.masterResume.findUnique({
            where: { id: resolvedResumeId },
            include: { skills: true, experiences: true },
          })
        : await this.prisma.masterResume.findFirst({
            where: {
              tailoredFromId: null,
            },
            include: { skills: true, experiences: true },
          });

      if (!masterResume) {
        throw new Error(resolvedResumeId ? "Resume not found" : "No master resume found");
      }

      const summary = await this.generateTailoredSummary(job, masterResume);

      return {
        success: true,
        data: summary,
      };
    } catch (error: any) {
      logger.error("Summary generation failed", error);
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
    // Try to use Harvard summary from DB first, otherwise generate new
    let summary: string;
    const { getHarvardSummaryAgent } = await import("./resume/harvard-summary.agent");
    const summaryAgent = getHarvardSummaryAgent();
    
    // Try job-specific first, then fall back to any summary for this resume
    let dbSummaries = await summaryAgent.getFromDatabase(masterResume.id, job.id);
    if (!dbSummaries || dbSummaries.length === 0) {
      dbSummaries = await summaryAgent.getFromDatabase(masterResume.id);
    }
    
    if (dbSummaries && dbSummaries.length > 0) {
      const recommended = dbSummaries.find(s => s.bestFor === "Recommended") || dbSummaries[0];
      summary = recommended.summary;
      console.log(chalk.gray("  → Using Harvard summary from database"));
    } else {
      summary = await this.generateTailoredSummary(job, masterResume);
    }

    // Try to use quantified achievements from DB first
    const { getAchievementQuantifierAgent } = await import("./resume/achievement-quantifier.agent");
    const quantifier = getAchievementQuantifierAgent();
    const dbQuantified = await quantifier.getQuantifiedFromDatabase(masterResume.id);
    const hasQuantifiedData = dbQuantified && dbQuantified.length > 0;
    const normalizeText = (value: string) =>
      `${value || ""}`
        .toLowerCase()
        .replace(/[^\w\s%$+#./-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const quantifiedPool = (dbQuantified || []).map((q, index) => ({
      index,
      experienceId: `${q.experienceId || ""}`.trim() || undefined,
      original: `${q.original || ""}`.trim(),
      originalNormalized: normalizeText(`${q.original || ""}`),
      rewritten: `${q.rewritten || ""}`.trim(),
      metrics: q.metrics,
    }));
    const consumedQuantifiedIndexes = new Set<number>();
    
    if (hasQuantifiedData) {
      logger.info(`Using ${dbQuantified.length} quantified achievements from database`);
    }

    // Distribute optimized achievements back to experiences
    const optimizedExperiences = await Promise.all(
      relevantExperiences.map(async ({ experience, similarity }) => {
        let currentAchievements = experience.achievements;
        let appliedQuantified = false;

        // If we have quantified achievements from DB, use them
        if (hasQuantifiedData) {
          const experienceId = `${experience?.id || ""}`.trim();
          const expAchievementTexts = Array.isArray(experience?.achievements)
            ? experience.achievements
                .map((achievement: any) => `${achievement?.description || ""}`.trim())
                .filter(Boolean)
            : [];
          const expAchievementNormalized = expAchievementTexts.map((value: string) =>
            normalizeText(value),
          );
          const directMatches = quantifiedPool.filter((item) => {
            if (consumedQuantifiedIndexes.has(item.index)) return false;
            if (experienceId && item.experienceId && item.experienceId === experienceId) {
              return true;
            }
            if (!item.originalNormalized) return false;
            return expAchievementNormalized.some(
              (value) =>
                Boolean(value) &&
                (value === item.originalNormalized ||
                  value.includes(item.originalNormalized) ||
                  item.originalNormalized.includes(value)),
            );
          });

          if (directMatches.length > 0) {
            const matchLimit = Math.max(
              1,
              Math.min(3, expAchievementTexts.length || directMatches.length),
            );
            const selectedMatches = directMatches.slice(0, matchLimit);
            selectedMatches.forEach((item) => consumedQuantifiedIndexes.add(item.index));

            currentAchievements = selectedMatches.map((item) => ({
              description: item.rewritten || item.original,
              metrics: item.metrics?.percentage
                ? `${item.metrics.percentage}%`
                : item.metrics?.scale || item.metrics?.revenue || "",
              impact: "high" as const,
            }));
            appliedQuantified = true;
          }
        }

        if (!appliedQuantified && (
          experience.title &&
          (experience.title.toLowerCase().includes("insulator") ||
            experience.title.toLowerCase().includes("electrical") ||
            experience.title.toLowerCase().includes("technician"))
        )) {
          // Enhance trades experience with tech relevance
          currentAchievements = await this.enhanceTradesExperience(
            experience.achievements,
            job.requiredSkills,
          );
        } else if (!appliedQuantified) {
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
    const seenAchievementSignatures = new Set<string>();
    const dedupedOptimizedExperiences = optimizedExperiences.map(
      (optimizedExperience, index) => {
        const signature = (optimizedExperience.achievements || [])
          .map((achievement: any) => normalizeText(`${achievement?.description || ""}`))
          .filter(Boolean)
          .join(" | ");
        if (!signature) return optimizedExperience;

        if (seenAchievementSignatures.has(signature)) {
          const sourceExperience = relevantExperiences[index]?.experience;
          const sourceAchievements = Array.isArray(sourceExperience?.achievements)
            ? sourceExperience.achievements.map((achievement: any) => ({
                description: `${achievement?.description || ""}`.trim(),
                metrics: `${achievement?.metrics || ""}`.trim(),
                impact: `${achievement?.impact || "medium"}`.trim() || "medium",
              }))
            : [];
          if (sourceAchievements.length > 0) {
            const sourceSignature = sourceAchievements
              .map((achievement: any) => normalizeText(`${achievement?.description || ""}`))
              .filter(Boolean)
              .join(" | ");
            if (sourceSignature && sourceSignature !== signature) {
              seenAchievementSignatures.add(sourceSignature);
              return {
                ...optimizedExperience,
                achievements: sourceAchievements,
              };
            }
          }
        } else {
          seenAchievementSignatures.add(signature);
        }

        return optimizedExperience;
      },
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

    // Use job skills if available, otherwise use master resume skills for matching
    const masterSkillNames = allSkills.map((s: any) => s.name).filter(Boolean);
    const effectiveJobSkills =
      (job.requiredSkills || []).length > 0 ?
        job.requiredSkills
      : masterSkillNames;

    const skills = this.filterAndOrderSkills(
      allSkills,
      effectiveJobSkills,
      job.preferredSkills || [],
    );

    // Extract engineering skills from achievement stories
    const engineeringSkills =
      await this.extractEngineeringSkills(relevantProjects);

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
      experiences: dedupedOptimizedExperiences,
      projects: optimizedProjects,
      skills,
      engineeringSkills, // Add engineering skills
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

    // Load voice guidance for authentic writing
    const voiceGuidance = await VoiceLoader.getVoiceGuidance();

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

    // Use job skills if available, otherwise use master resume skills
    const masterSkillNames = (masterResume.skills || [])
      .map((s: any) => s.name)
      .filter(Boolean);
    const effectiveSkills =
      (job.requiredSkills || []).length > 0 ?
        job.requiredSkills
      : masterSkillNames;

    const prompt = `${voiceGuidance}

---

You are writing a HIGHLY TAILORED resume summary for a candidate applying specifically to ${companyName}. This summary must demonstrate deep understanding of the company's needs, culture, and technical requirements. Use the candidate's ACTUAL story and experiences - do not use generic templates.

Job Details:
- Title: ${job.title}
- Company: ${companyName}
- Company Tech Stack: ${companyTech}
- Company Values: ${companyValues}
- Required Skills: ${effectiveSkills.slice(0, 10).join(", ")}
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

Write a NATURAL, AUTHENTIC resume summary that sounds like a real person introducing themselves. Read the candidate's actual career story (storyContext) and create a genuine introduction based on their real journey.

Paragraph 1: Your Actual Story
- Use the candidate's real career transition story from storyContext  
- Write naturally, like you would introduce yourself in conversation
- Avoid corporate buzzwords ("strategic," "results-oriented," "superpower")
- Focus on their genuine path from trades to software
- Keep it conversational and authentic

Paragraph 2: What You've Actually Built
- Use real achievements from the candidate's project database
- Reference their actual projects with specific details from their achievement stories
- Write in natural language, not resume-speak
- Focus on what they genuinely accomplished

Paragraph 3: What You Bring to ${companyName}
- Use the candidate's actual skills from their resume data
- Naturally weave in key ATS keywords from the job description
- Connect their real experience to the job requirements
- Show how their specific skills (JavaScript, React, Node.js, databases, etc.) solve ${companyName}'s problems
- Write conversationally but ensure keyword coverage for ATS systems

CRITICAL REQUIREMENTS:
- Write naturally like a real person introducing themselves
- IMPORTANT: Weave in ATS keywords naturally from: ${effectiveSkills.slice(0, 8).join(", ")}
- Include their actual story from storyContext
- Mention their real projects and technologies
- Sound conversational but include keywords naturally in sentences
- Avoid corporate buzzwords but ensure ATS compatibility
- Make it both human-readable and machine-scannable

Return ONLY the complete 3-paragraph summary. Do NOT include any formatting, explanations, or extra text.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.5,
      maxTokens: 1024, // Increased token limit for longer summaries
    });

    if (response.success && response.data) {
      let summary = response.data.trim();

      // Ensure paragraphs are separated by double newlines
      summary = summary
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .join("\n\n");

      // Validate humanness before returning
      const humannessResult = await HumannessChecker.checkText(summary);

      if (humannessResult.isHuman) {
        logger.debug(
          `Summary humanness check passed: ${humannessResult.score}/100`,
        );
      } else {
        logger.warn(
          `Summary humanness check failed: ${humannessResult.score}/100`,
          {
            issues: humannessResult.issues,
          },
        );
      }

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

    // Noise words to filter out - these are not real tech skills
    const noiseWords = new Set([
      "service",
      "workflow",
      "api",
      "data",
      "work",
      "application",
      "server",
      "public",
      "management",
      "implementation",
      "integration",
      "optimization",
      "requirements",
      "analysis",
      "documentation",
      "version",
      "control",
      "problem",
      "solving",
      "communication",
      "leadership",
      "team",
      "project",
      " SDLC",
    ]);

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

    // First filter out noise, then process
    let allSkillNames = extractSkillNames(allSkills);

    // Filter noise and deduplicate
    allSkillNames = allSkillNames
      .filter((name) => {
        const normalized = normalizeSkill(name);
        // Must be at least 2 chars
        if (normalized.length < 2) return false;
        // Filter out noise words
        if (noiseWords.has(normalized)) return false;
        // Filter out if it's just a common word
        return true;
      })
      .map((s) => s.trim());

    // Deduplicate after normalization
    allSkillNames = [...new Set(allSkillNames.map((s) => s.toLowerCase()))].map(
      (s) => allSkillNames.find((f) => f.toLowerCase() === s) || s,
    );

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
      matched: [...new Set(matched)].slice(0, 30), // Limit matched skills
      relevant: [...new Set(relevant)].slice(0, 20), // Limit relevant skills
      other: [...new Set(other)].slice(0, 20), // Limit other skills
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

    // Keyword matching - use requiredSkills (actual tech skills) instead of generic keywords
    // If job has no requiredSkills, use master resume skills
    const keywords =
      job.requiredSkills && job.requiredSkills.length > 0 ?
        job.requiredSkills
      : [...tailored.skills.matched, ...tailored.skills.relevant];

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

  /**
   * Extract engineering skills from GitHub READMEs
   */
  private async extractEngineeringSkills(relevantProjects: any[]): Promise<{
    systemDesign: string[];
    security: string[];
    performance: string[];
    architecture: string[];
    database: string[];
  }> {
    const engineeringSkills = {
      systemDesign: [] as string[],
      security: [] as string[],
      performance: [] as string[],
      architecture: [] as string[],
      database: [] as string[],
    };

    const projectToRepoMap: Record<string, string> = {
      "Chef BonBon": "bonny2long/ChefBonBon",
      ChefBonBon: "bonny2long/ChefBonBon",
      SyncUp: "bonny2long/SyncUp",
      syncup: "bonny2long/SyncUp",
      "United Airlines": "bonny2long/Metis",
      "Winning RFP": "bonny2long/Metis",
      Metis: "bonny2long/Metis",
    };

    const keywordMap: Record<string, string[]> = {
      systemDesign: [
        "system design",
        "scalable",
        "load balancing",
        "caching",
        "microservices",
        "distributed",
        "concurrency",
        "api gateway",
        "service discovery",
        "event-driven",
      ],
      security: [
        "authentication",
        "authorization",
        "security",
        "encryption",
        "jwt",
        "oauth",
        "ssl",
        "tls",
        "hashing",
        "salt",
        "pepper",
        "rbac",
        "role-based",
        "permission",
      ],
      performance: [
        "performance",
        "optimization",
        "lazy loading",
        "memoization",
        "caching",
        "cdn",
        "compression",
        "bundle",
        "optimize",
        "latency",
      ],
      architecture: [
        "architecture",
        "design pattern",
        "mvc",
        "clean code",
        "solid",
        "dry",
        "kiss",
        "microservice",
        "monolith",
        "serverless",
        "container",
        "docker",
      ],
      database: [
        "database",
        "sql",
        "postgresql",
        "mysql",
        "mongodb",
        "redis",
        "supabase",
        "query",
        "index",
        "schema",
        "migration",
        "orm",
        "prisma",
        "transaction",
      ],
    };

    for (const { project } of relevantProjects) {
      let repoName: string | undefined = projectToRepoMap[project.name];
      if (!repoName) {
        const keys = Object.keys(projectToRepoMap);
        const matchedKey = keys.find((k) =>
          project.name.toLowerCase().includes(k.toLowerCase()),
        );
        repoName = matchedKey ? projectToRepoMap[matchedKey] : undefined;
      }

      if (repoName) {
        const repo = await this.prisma.gitHubRepo.findUnique({
          where: { fullName: repoName },
          select: { readmeContent: true },
        });

        if (repo?.readmeContent) {
          const readme = repo.readmeContent.toLowerCase();
          for (const [category, keywords] of Object.entries(keywordMap)) {
            for (const keyword of keywords) {
              if (
                readme.includes(keyword) &&
                !engineeringSkills[
                  category as keyof typeof engineeringSkills
                ].includes(keyword)
              ) {
                engineeringSkills[
                  category as keyof typeof engineeringSkills
                ].push(keyword);
              }
            }
          }
        }
      }
    }

    for (const key of Object.keys(
      engineeringSkills,
    ) as (keyof typeof engineeringSkills)[]) {
      engineeringSkills[key] = [...new Set(engineeringSkills[key])].slice(0, 6);
    }

    return engineeringSkills;
  }

  /**
   * Enhanced Pipeline: Run all enhancement agents and save to database
   * Priority: A) Quantify Achievements → C) Harvard Summary → B) ATS Optimization
   */
  private async runEnhancedPipeline(jobId: string, resumeId?: string): Promise<void> {
    logger.info("Starting enhanced pipeline");
    const effectiveResumeId = await this.resolveRootResumeId(resumeId);

    // Get master resume
    const masterResume = effectiveResumeId
      ? await this.prisma.masterResume.findUnique({ where: { id: effectiveResumeId } })
      : await this.prisma.masterResume.findFirst({
          where: {
            tailoredFromId: null,
          },
        });
    if (!masterResume) {
      throw new Error(effectiveResumeId ? "Resume not found" : "No master resume found");
    }

    const targetResumeId = effectiveResumeId || masterResume.id;

    // STEP A: Quantify Achievements (McKinsey)
    logger.step(1, 5, "Quantifying achievements (McKinsey)...");
    const { getAchievementQuantifierAgent } = await import("./resume/achievement-quantifier.agent");
    const quantifier = getAchievementQuantifierAgent();
    const quantifyResult = await quantifier.quantifyResumeAchievements(targetResumeId);
    
    if (quantifyResult.success && quantifyResult.data) {
      await quantifier.saveToDatabase(masterResume.id, quantifyResult.data.achievements);
      logger.success(`Quantified ${quantifyResult.data.achievements.length} achievements`);
    }

    // STEP C: Harvard Summary
    logger.step(2, 5, "Generating Harvard summaries...");
    const { getHarvardSummaryAgent } = await import("./resume/harvard-summary.agent");
    const summaryAgent = getHarvardSummaryAgent();
    const summaryResult = await summaryAgent.generateSummaries(jobId, targetResumeId);

    if (summaryResult.success && summaryResult.data) {
      await summaryAgent.saveToDatabase(masterResume.id, jobId, summaryResult.data.versions);
      logger.success(`Generated ${summaryResult.data.versions.length} summary versions`);
    }

    // STEP B: ATS Optimization
    logger.step(3, 5, "Running ATS optimization (Google)...");
    const { getATSOptimizerAgent } = await import("./resume/ats-optimizer.agent");
    const atsAgent = getATSOptimizerAgent();
    const atsResult = await atsAgent.optimizeForATS(jobId, targetResumeId);

    if (atsResult.success && atsResult.data) {
      await atsAgent.saveToDatabase(masterResume.id, jobId, atsResult.data);
      logger.success(`ATS Score: ${atsResult.data.overallScore}/100`);
    }

    // STEP D: Cover Letter Generation (Bain Style)
    logger.step(4, 5, "Generating cover letter (Bain Style)...");
    const { getCoverLetterAgent } = await import("@/agents/cover-letter-generator");
    const coverLetterAgent = getCoverLetterAgent();
    const coverLetterResult = await coverLetterAgent.generateCoverLetter(jobId, {
      tone: "professional",
      includeCareerStory: true,
      maxParagraphs: 4,
      resumeId: targetResumeId,
    });

    if (coverLetterResult.success && coverLetterResult.data) {
      logger.success(`Cover letter generated for ${coverLetterResult.data.companyName}`);
    }

    // STEP E: Interview Prep (FAANG Style)
    logger.step(5, 5, "Generating interview prep (FAANG Style)...");
    const { getBehavioralCoachAgent } = await import("./interview/behavioral-coach.agent");
    const behavioralCoach = getBehavioralCoachAgent();
    const storyBankResult = await behavioralCoach.generateStoryBank(undefined, targetResumeId);

    if (storyBankResult.success && storyBankResult.data) {
      // Save STAR stories to database
      try {
        for (const story of storyBankResult.data.stories) {
          await this.prisma.sTARStory.create({
            data: {
              resumeId: masterResume.id,
              title: story.title,
              category: story.category,
              situation: story.situation,
              task: story.task,
              action: story.action,
              result: story.result,
              metrics: story.metrics || undefined,
              lessons: story.lessons || undefined,
            },
          });
        }
        logger.success(`Generated ${storyBankResult.data.stories.length} STAR stories`);
      } catch (error) {
        logger.warn("Failed to save STAR stories to database", error);
      }
    }

    logger.success("Enhanced pipeline complete - all data saved to database");
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
