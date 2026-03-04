// src/agents/application-orchestrator.agent.ts
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import { getJobAnalyzerAgent } from "@/agents/job-analyzer";
import { getResumeTailorAgent } from "@/agents/resume-tailor.agent";
import { getDocumentGenerator } from "@/services/document-generator.service";
import { getCoverLetterAgent } from "@/agents/cover-letter-generator";
import { getHiringManagerFinderAgent } from "@/agents/hiring-manager-finder";
import { getLinkedInMessageAgent } from "@/agents/linkedin-message-generator";
import { getEmailAgent } from "@/agents/email-agent";
import fs from "fs/promises";
import path from "path";

export interface FollowUpEmailDraft {
  to: string;
  subject: string;
  body: string;
  tone: string;
  type: string;
}

export interface ApplicationPackage {
  jobId: string;
  applicationId: string;

  // Job details
  jobTitle: string;
  companyName: string;
  matchScore: number;

  // Generated files
  resumePath: string;
  coverLetterPath: string;

  // Hiring manager
  hiringManagerName?: string;
  hiringManagerLinkedIn?: string;
  linkedInMessage?: string;
  followUpEmail?: FollowUpEmailDraft;
  skillsSnapshotPath?: string;

  // Summary
  summary: string;
}

export class ApplicationOrchestratorAgent {
  private prisma = getPrismaClient();

  private async resolveRootResumeId(
    resumeId?: string,
    userId?: string,
  ): Promise<string | undefined> {
    if (!resumeId) return undefined;

    let currentId = resumeId;
    const seen = new Set<string>();

    for (let depth = 0; depth < 12; depth += 1) {
      if (seen.has(currentId)) break;
      seen.add(currentId);

      const resume = await this.prisma.masterResume.findFirst({
        where: {
          id: currentId,
          ...(userId ? { userId } : {}),
        },
        select: {
          id: true,
          tailoredFromId: true,
        },
      });

      if (!resume) break;
      if (!resume.tailoredFromId) return resume.id;
      currentId = resume.tailoredFromId;
    }

    return currentId;
  }

  /**
   * Run complete application workflow
   * @param jobUrl - The job posting URL
   * @param options - Options including enhanced flag
   */
  async applyToJob(
    jobUrl: string,
    options?: { enhanced?: boolean; resumeId?: string; userId?: string },
  ): Promise<AgentResponse<ApplicationPackage>> {
    const enhanced = options?.enhanced || false;
    const requestedResumeId = options?.resumeId;
    const userId = options?.userId;
    const totalSteps = enhanced ? 8 : 7;
    
    try {
      const resumeId = await this.resolveRootResumeId(requestedResumeId, userId);
      logger.header("Complete Application Workflow");
      logger.info("Starting automated application process", {
        jobUrl,
        enhanced,
        resumeId: resumeId || requestedResumeId || undefined,
      });

      // Step 1: Analyze job
      logger.step(1, totalSteps, "Analyzing job posting...");
      const jobAnalyzer = getJobAnalyzerAgent();
      const analysisResult = await jobAnalyzer.analyzeJobFromUrl(jobUrl);

      if (!analysisResult.success || !analysisResult.data) {
        throw new Error("Job analysis failed: " + analysisResult.error);
      }

      const candidateSkills = await this.buildCandidateSkills(resumeId, userId);
      const matchResult = jobAnalyzer.calculateMatchScore(
        candidateSkills,
        analysisResult.data,
      );
      const matchScore = matchResult.score;
      const skillsSnapshotPath = await this.persistSkillsMatchSnapshot({
        companyName: analysisResult.data.company,
        jobTitle: analysisResult.data.title,
        jobUrl,
        requiredSkills: analysisResult.data.requiredSkills || [],
        preferredSkills: analysisResult.data.preferredSkills || [],
        candidateSkills,
        matchResult,
      });

      logger.info("Calculated skills match score", {
        matchScore,
        requiredSkills: analysisResult.data.requiredSkills?.length || 0,
        candidateSkills: candidateSkills.length,
        skillsSnapshotPath,
      });

      // Check if job already exists — update it with fresh analysis data
      const existingJob = await this.prisma.job.findFirst({
        where: { url: jobUrl },
      });

      if (existingJob) {
        logger.info(
          "Job already exists in database, updating with fresh analysis",
          { jobId: existingJob.id },
        );

        // Update existing job with fresh analysis
        const updatedJob = await this.prisma.job.update({
          where: { id: existingJob.id },
          data: {
            title: analysisResult.data.title || existingJob.title,
            location: analysisResult.data.location || existingJob.location,
            salary:
              analysisResult.data.salary || existingJob.salary || undefined,
            requiredSkills: analysisResult.data.requiredSkills || [],
            preferredSkills: analysisResult.data.preferredSkills || [],
            responsibilities: analysisResult.data.responsibilities || [],
            qualifications: analysisResult.data.qualifications || [],
            keywords: analysisResult.data.keywords || [],
            skillsMatch: matchScore,
            experienceLevel:
              analysisResult.data.experienceLevel ||
              existingJob.experienceLevel,
          },
        });

        return this.processWorkflowAfterJobCreated(
          updatedJob,
          analysisResult.data.company,
          enhanced,
          totalSteps,
          resumeId,
          userId,
          skillsSnapshotPath,
        );
      }

      // Save job to database first
      const company = await this.prisma.company.upsert({
        where: { name: analysisResult.data.company },
        update: {
          name: analysisResult.data.company,
          lastResearched: new Date(),
        },
        create: {
          name: analysisResult.data.company,
          domain: this.extractDomainFromUrl(jobUrl),
        },
      });

      const job = await this.prisma.job.create({
        data: {
          companyId: company.id,
          title: analysisResult.data.title || "Unknown Position",
          url: jobUrl,
          location: analysisResult.data.location || "Remote",
          salary: analysisResult.data.salary || undefined,
          rawDescription: jobUrl, // Store URL since we don't have raw description
          requiredSkills: analysisResult.data.requiredSkills || [],
          preferredSkills: analysisResult.data.preferredSkills || [],
          responsibilities: analysisResult.data.responsibilities || [],
          qualifications: analysisResult.data.qualifications || [],
          keywords: analysisResult.data.keywords || [],
          skillsMatch: matchScore,
          experienceLevel: analysisResult.data.experienceLevel || "entry",
        },
      });

      return this.processWorkflowAfterJobCreated(
        job,
        analysisResult.data.company,
        enhanced,
        totalSteps,
        resumeId,
        userId,
        skillsSnapshotPath,
      );
    } catch (error: any) {
      logger.error("Application workflow failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Continue workflow after job is created/loaded
   */
  private async processWorkflowAfterJobCreated(
    job: any,
    companyName: string,
    enhanced: boolean = false,
    totalSteps: number = 6,
    resumeId?: string,
    userId?: string,
    skillsSnapshotPath?: string,
  ): Promise<AgentResponse<ApplicationPackage>> {
    try {
      const jobId = job.id;
      const jobTitle = job.title;
      const matchScore = typeof job.skillsMatch === "number" ? job.skillsMatch : 0;

      logger.success(
        `Job analyzed: ${jobTitle} at ${companyName} (${matchScore}% match)`,
      );

      // Step 2: Tailor resume (with enhanced pipeline if requested)
      logger.step(2, totalSteps, enhanced ? "Running enhanced pipeline (quantify + Harvard + ATS + cover letter + interview)..." : "Tailoring resume with RAG...");
      const resumeTailor = getResumeTailorAgent();
      const tailorResult = await resumeTailor.tailorResume(jobId, {
        enhanced,
        resumeId,
        userId,
      });

      if (!tailorResult.success || !tailorResult.data) {
        // If tailoring fails, suggest running with embeddings
        throw new Error(
          "Resume tailoring failed. Try running: npm run dev -- tailor " +
            jobId +
            " --generate-embeddings",
        );
      }

      logger.success("Resume tailored successfully");

      // Generate tailored summary for other agents
      logger.info("Generating tailored summary for cohesive messaging...");
      const summaryResult = await resumeTailor.generateSummaryOnly(
        jobId,
        resumeId,
      );
      const tailoredSummary = summaryResult.success && summaryResult.data 
        ? summaryResult.data 
        : undefined;

      if (tailoredSummary) {
        logger.success("Tailored summary generated");
      }

      // Step 3: Generate resume DOCX
      logger.step(3, totalSteps, "Generating resume document...");
      const docGenerator = getDocumentGenerator();
      const resumeResult = await docGenerator.generateResume(
        tailorResult.data,
        {
          format: "docx",
          template: "modern",
        },
      );

      if (!resumeResult.success || !resumeResult.filepath) {
        throw new Error("Resume generation failed: " + resumeResult.error);
      }

      logger.success(`Resume created: ${resumeResult.filepath}`);

      // Step 4: Generate cover letter
      logger.step(4, totalSteps, "Generating cover letter...");
      const coverLetterAgent = getCoverLetterAgent();
      const coverLetterResult = await coverLetterAgent.generateCoverLetter(
        jobId,
        {
          tone: "professional",
          includeCareerStory: true,
          maxParagraphs: 4,
          tailoredSummary: tailoredSummary,
          resumeId,
        },
      );

      if (!coverLetterResult.success || !coverLetterResult.data) {
        throw new Error(
          "Cover letter generation failed: " + coverLetterResult.error,
        );
      }

      // Generate cover letter DOCX
      const coverLetterDocResult = await docGenerator.generateCoverLetter(
        coverLetterResult.data,
        { format: "docx" },
      );

      if (!coverLetterDocResult.success || !coverLetterDocResult.filepath) {
        throw new Error("Cover letter document generation failed");
      }

      logger.success(`Cover letter created: ${coverLetterDocResult.filepath}`);

      // Step 5: Find hiring manager
      logger.step(5, totalSteps, "Finding hiring manager...");
      const hiringManagerFinder = getHiringManagerFinderAgent();
      const hmResult = await hiringManagerFinder.findHiringManager(jobId);

      let hiringManagerId: string | undefined;
      let hiringManagerName: string | undefined;
      let hiringManagerLinkedIn: string | undefined;

      if (hmResult.success && hmResult.data?.topMatch) {
        const topMatch = hmResult.data.topMatch;
        const normalizedName = `${topMatch.name || ""}`.trim();

        if (!normalizedName) {
          logger.warn("Hiring manager match returned empty name; skipping save");
        } else {
          const topSource = `${topMatch.source || ""}`.trim();
          const sourceList = topSource ? [topSource] : [];
          const managerData = {
            name: normalizedName,
            title: `${topMatch.title || ""}`.trim() || "Hiring Manager",
            linkedInUrl: `${topMatch.linkedInUrl || ""}`.trim() || null,
            email: `${topMatch.email || ""}`.trim() || null,
            phone: `${topMatch.phone || ""}`.trim() || null,
            confidence:
              typeof topMatch.confidence === "number" ? topMatch.confidence : 0,
            verified: Boolean(topMatch.verified),
          };

          const existingHM = await this.prisma.hiringManager.findFirst({
            where: { jobId, name: normalizedName },
          });

          let savedHM: any;
          if (existingHM) {
            const mergedSources = Array.from(
              new Set([...(existingHM.sources || []), ...sourceList]),
            );
            savedHM = await this.prisma.hiringManager.update({
              where: { id: existingHM.id },
              data: {
                ...managerData,
                sources: mergedSources,
              },
            });
          } else {
            try {
              savedHM = await this.prisma.hiringManager.create({
                data: {
                  jobId,
                  ...managerData,
                  sources: sourceList,
                },
              });
            } catch (error: any) {
              if (error?.code === "P2002") {
                const deduped = await this.prisma.hiringManager.findFirst({
                  where: { jobId, name: normalizedName },
                });
                if (deduped) {
                  const mergedSources = Array.from(
                    new Set([...(deduped.sources || []), ...sourceList]),
                  );
                  savedHM = await this.prisma.hiringManager.update({
                    where: { id: deduped.id },
                    data: {
                      ...managerData,
                      sources: mergedSources,
                    },
                  });
                } else {
                  throw error;
                }
              } else {
                throw error;
              }
            }
          }

          hiringManagerId = savedHM.id;
          hiringManagerName = savedHM.name;
          hiringManagerLinkedIn = savedHM.linkedInUrl || undefined;

          logger.success(
            `Hiring manager found: ${hiringManagerName} (${managerData.confidence}% confidence)`,
          );
        }
      } else {
        logger.warn("No hiring manager found, continuing without");
      }

      // Step 6: Generate LinkedIn message (if hiring manager found)
      let linkedInMessage: string | undefined;

      if (hiringManagerId) {
        logger.step(6, totalSteps, "Generating LinkedIn message...");
        const linkedInAgent = getLinkedInMessageAgent();
        const messageResult = await linkedInAgent.generateMessage(
          jobId,
          hiringManagerId,
          {
            type: "connection_request",
            tone: "professional",
            includeCareerStory: true,
            tailoredSummary: tailoredSummary,
          },
        );

        if (messageResult.success && messageResult.data) {
          linkedInMessage = messageResult.data.message;

          // Save message to database
          await this.prisma.linkedInMessage.create({
            data: {
              hiringManagerId: hiringManagerId,
              type: "connection_request",
              body: linkedInMessage,
              characterCount: linkedInMessage.length,
              tone: "professional",
              status: "draft",
            },
          });

          logger.success("LinkedIn message generated");
        } else {
          logger.warn("LinkedIn message generation failed, continuing");
        }
      } else {
        logger.step(6, totalSteps, "Skipping LinkedIn message (no hiring manager)");
      }

      // Step 7: Persist tailored resume snapshot for dashboard/application tracking
      const tailoredResumeId = await this.persistTailoredResumeFromWorkflow(
        tailorResult.data,
        job,
        companyName,
        resumeId,
        userId,
        {
          resumePath: resumeResult.filepath,
          coverLetterPath: coverLetterDocResult.filepath,
          skillsSnapshotPath,
        },
      );

      // Step 7: Create application record
      const application = await this.prisma.application.create({
        data: {
          jobId: jobId,
          status: "prepared",
          resumePath: resumeResult.filepath,
          coverLetterPath: coverLetterDocResult.filepath,
          hiringManagerId: hiringManagerId,
          linkedInSent: false,
          notes: [
            `Generated via apply command on ${new Date().toLocaleDateString()}`,
            tailoredResumeId ? `Tailored Resume ID: ${tailoredResumeId}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });

      logger.success("Application record created");

      // Step 8: Generate follow-up email draft
      let followUpEmail: FollowUpEmailDraft | undefined;
      logger.step(totalSteps, totalSteps, "Generating follow-up email draft...");
      try {
        const emailAgent = getEmailAgent();
        const emailResult = await emailAgent.generateEmail(application.id, {
          type: "initial_followup",
          tone: "professional",
          includeCareerStory: true,
        });

        if (emailResult.success && emailResult.data) {
          followUpEmail = {
            to: emailResult.data.to || "",
            subject: emailResult.data.subject || "",
            body: emailResult.data.body || "",
            tone: emailResult.data.tone || "professional",
            type: emailResult.data.type || "initial_followup",
          };

          await emailAgent.saveEmail(
            application.id,
            followUpEmail.type,
            followUpEmail.to,
            followUpEmail.subject,
            followUpEmail.body,
            followUpEmail.tone,
            hiringManagerId,
          );
          logger.success("Follow-up email draft generated");
        } else {
          logger.warn("Follow-up email generation failed", emailResult.error);
        }
      } catch (emailError: any) {
        logger.warn("Failed to generate follow-up email draft", emailError);
      }

      // Build summary
      const summary = this.buildSummary(
        jobTitle,
        companyName,
        matchScore,
        resumeResult.filepath,
        coverLetterDocResult.filepath,
        hiringManagerName,
        linkedInMessage,
        followUpEmail,
        skillsSnapshotPath,
      );

      return {
        success: true,
        data: {
          jobId,
          applicationId: application.id,
          jobTitle: jobTitle,
          companyName: companyName,
          matchScore,
          resumePath: resumeResult.filepath,
          coverLetterPath: coverLetterDocResult.filepath,
          hiringManagerName: hiringManagerName || "",
          hiringManagerLinkedIn: hiringManagerLinkedIn || "",
          linkedInMessage: linkedInMessage || "",
          followUpEmail,
          skillsSnapshotPath,
          summary,
        },
      };
    } catch (error: any) {
      logger.error("Application workflow failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build summary message
   */
  private buildSummary(
    jobTitle: string,
    companyName: string,
    matchScore: number,
    resumePath: string,
    coverLetterPath: string,
    hiringManagerName?: string,
    linkedInMessage?: string,
    followUpEmail?: FollowUpEmailDraft,
    skillsSnapshotPath?: string,
  ): string {
    const parts = [
      `Job: ${jobTitle} at ${companyName}`,
      `Match Score: ${matchScore}%`,
      ``,
      `[OK] Resume: ${resumePath}`,
      `[OK] Cover Letter: ${coverLetterPath}`,
    ];

    if (hiringManagerName) {
      parts.push(`[OK] Hiring Manager: ${hiringManagerName}`);
    }

    if (linkedInMessage) {
      parts.push(`[OK] LinkedIn Message: Ready to send`);
    }

    if (followUpEmail) {
      parts.push(`[OK] Follow-up Email: Draft ready`);
    }
    if (skillsSnapshotPath) {
      parts.push(`[OK] Skills Snapshot: ${skillsSnapshotPath}`);
    }

    parts.push(``);
    parts.push(`Next Steps:`);
    parts.push(`1. Review both documents`);
    parts.push(`2. Customize if needed`);
    parts.push(`3. Submit application on company website`);

    if (linkedInMessage) {
      parts.push(`4. Send LinkedIn connection request`);
    }

    if (followUpEmail) {
      parts.push(`5. Send follow-up email`);
    }

    return parts.join("\n");
  }

  /**
   * Extract domain from URL
   */
  private extractDomainFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  private async buildCandidateSkills(
    resumeId?: string,
    userId?: string,
  ): Promise<string[]> {
    const normalize = (value: string) => value.trim().toLowerCase();
    const isLikelySkill = (value: string) => {
      const clean = value.trim();
      if (!clean) return false;
      if (clean.length < 2 || clean.length > 50) return false;
      if (/^\d+$/.test(clean)) return false;
      if (/^[^\w+#./-]+$/.test(clean)) return false;
      return true;
    };
    const addSkills = (target: Set<string>, source: string[]) => {
      for (const value of source) {
        const normalized = normalize(value);
        if (isLikelySkill(normalized)) {
          target.add(normalized);
        }
      }
    };

    const resume = resumeId
      ? await this.prisma.masterResume.findUnique({
          where: { id: resumeId },
          include: { skills: true },
        })
      : await this.prisma.masterResume.findFirst({
          where: {
            ...(userId ? { userId } : {}),
            tailoredFromId: null,
          },
          include: { skills: true },
          orderBy: { updatedAt: "desc" },
        });

    const collected = new Set<string>();
    addSkills(
      collected,
      (resume?.skills || [])
        .map((skill: any) => `${skill?.name || ""}`.trim())
        .filter(Boolean),
    );

    const repos = await this.prisma.gitHubRepo.findMany({
      select: {
        languages: true,
        topics: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 120,
    });

    for (const repo of repos) {
      addSkills(collected, Array.isArray(repo.languages) ? repo.languages : []);
      addSkills(
        collected,
        (Array.isArray(repo.topics) ? repo.topics : []).map((topic: string) =>
          `${topic}`.replace(/[-_]/g, " "),
        ),
      );
    }

    return Array.from(collected).sort();
  }

  private async persistSkillsMatchSnapshot(input: {
    companyName: string;
    jobTitle: string;
    jobUrl: string;
    requiredSkills: string[];
    preferredSkills: string[];
    candidateSkills: string[];
    matchResult: {
      score: number;
      matched: string[];
      missing: string[];
      extras: string[];
    };
  }): Promise<string> {
    const outputsDir = path.join(process.cwd(), "data", "outputs");
    await fs.mkdir(outputsDir, { recursive: true });

    const timestamp = Date.now();
    const safeJob = `${input.jobTitle || "job"}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60);
    const filePath = path.join(
      outputsDir,
      `skills_match_${safeJob || "job"}_${timestamp}.json`,
    );

    const payload = {
      generatedAt: new Date().toISOString(),
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      jobUrl: input.jobUrl,
      requiredSkills: input.requiredSkills,
      preferredSkills: input.preferredSkills,
      candidateSkills: input.candidateSkills,
      match: input.matchResult,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
    return filePath;
  }

  private async persistTailoredResumeFromWorkflow(
    tailored: any,
    job: any,
    companyName: string,
    resumeId?: string,
    userId?: string,
    workflowOutputs?: {
      resumePath?: string;
      coverLetterPath?: string;
      skillsSnapshotPath?: string;
    },
  ): Promise<string | null> {
    try {
      const rootResumeId = await this.resolveRootResumeId(resumeId, userId);
      const sourceResume = rootResumeId
        ? await this.prisma.masterResume.findUnique({
            where: { id: rootResumeId },
            include: {
              skills: true,
              education: { orderBy: { startDate: "desc" } },
              experiences: { orderBy: { startDate: "desc" } },
            },
          })
        : await this.prisma.masterResume.findFirst({
            where: {
              ...(userId ? { userId } : {}),
              tailoredFromId: null,
            },
            include: {
              skills: true,
              education: { orderBy: { startDate: "desc" } },
              experiences: { orderBy: { startDate: "desc" } },
            },
            orderBy: { updatedAt: "desc" },
          });

      if (!sourceResume) return null;

      const summaryText = `${tailored?.summary || ""}`.trim();
      const summaryShort =
        summaryText.length > 520 ? `${summaryText.slice(0, 517)}...` : summaryText;
      const summaryLong = summaryText || sourceResume.summaryLong;
      const sourceResumeData =
        sourceResume.resumeData &&
        typeof sourceResume.resumeData === "object" &&
        !Array.isArray(sourceResume.resumeData)
          ? (sourceResume.resumeData as Record<string, unknown>)
          : {};

      const created = await this.prisma.masterResume.create({
        data: {
          userId: userId || sourceResume.userId || undefined,
          fullName: sourceResume.fullName,
          email: sourceResume.email,
          phone: sourceResume.phone,
          location: sourceResume.location,
          linkedInUrl: sourceResume.linkedInUrl,
          githubUrl: sourceResume.githubUrl,
          portfolioUrl: sourceResume.portfolioUrl,
          summaryShort: summaryShort || sourceResume.summaryShort,
          summaryLong: summaryLong || sourceResume.summaryLong,
          jobDescription: `${job?.title || "Role"} at ${companyName}`.slice(0, 1000),
          tailoredFromId: sourceResume.id,
          resumeData: {
            ...sourceResumeData,
            tailoredFor: {
              jobId: job?.id,
              jobTitle: job?.title,
              companyName,
              tailoredAt: new Date().toISOString(),
              source: "application-orchestrator",
            },
            workflowOutputs: {
              resumePath: workflowOutputs?.resumePath || "",
              coverLetterPath: workflowOutputs?.coverLetterPath || "",
              skillsSnapshotPath: workflowOutputs?.skillsSnapshotPath || "",
            },
          },
        },
      });

      const experiences = Array.isArray(tailored?.experiences)
        ? tailored.experiences
        : [];
      const sourceExperiences = Array.isArray(sourceResume.experiences)
        ? sourceResume.experiences
        : [];
      const normalizeText = (value: string) =>
        `${value || ""}`
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      const sourceDescriptionFor = (exp: any, index: number): string => {
        const expTitle = normalizeText(`${exp?.title || ""}`);
        const expCompany = normalizeText(`${exp?.company || ""}`);

        if (expTitle || expCompany) {
          const matched = sourceExperiences.find((sourceExp: any) => {
            const sourceTitle = normalizeText(`${sourceExp?.title || ""}`);
            const sourceCompany = normalizeText(`${sourceExp?.company || ""}`);
            if (expTitle && expCompany) {
              return sourceTitle === expTitle && sourceCompany === expCompany;
            }
            if (expTitle) return sourceTitle === expTitle;
            if (expCompany) return sourceCompany === expCompany;
            return false;
          });
          if (matched?.description) return `${matched.description}`.trim();
        }

        const byIndex = sourceExperiences[index];
        return byIndex?.description ? `${byIndex.description}`.trim() : "";
      };

      for (const [index, exp] of experiences.entries()) {
        const achievementLines = Array.isArray(exp?.achievements)
          ? exp.achievements
              .map((a: any) => `${a?.description || ""}`.trim())
              .filter(Boolean)
          : [];
        const description =
          achievementLines.join(" ").trim() ||
          `${exp?.description || ""}`.trim() ||
          sourceDescriptionFor(exp, index);

        try {
          await this.prisma.experience.create({
            data: {
              resumeId: created.id,
              company: `${exp?.company || ""}`.trim() || "Company",
              title: `${exp?.title || ""}`.trim() || "Role",
              location: `${exp?.location || ""}`.trim(),
              startDate: exp?.startDate ? new Date(exp.startDate) : new Date(),
              endDate: exp?.endDate ? new Date(exp.endDate) : null,
              current: Boolean(exp?.current),
              description,
              embedding: [],
            },
          });
        } catch (error: any) {
          logger.warn("Skipped invalid tailored experience row", {
            error: error?.message || String(error),
            title: `${exp?.title || ""}`.trim(),
            company: `${exp?.company || ""}`.trim(),
          });
        }
      }

      const projects = Array.isArray(tailored?.projects) ? tailored.projects : [];
      for (const project of projects) {
        const projectAchievements = Array.isArray(project?.achievements)
          ? project.achievements
              .map((value: any) => `${value || ""}`.trim())
              .filter(Boolean)
          : [];
        try {
          await this.prisma.project.create({
            data: {
              resumeId: created.id,
              name: `${project?.name || ""}`.trim() || "Project",
              description: `${project?.description || ""}`.trim(),
              role: `${project?.role || ""}`.trim(),
              githubUrl: `${project?.githubUrl || ""}`.trim() || null,
              liveUrl: `${project?.liveUrl || ""}`.trim() || null,
              startDate: new Date(),
              endDate: new Date(),
              achievements: projectAchievements,
              embedding: [],
            },
          });
        } catch (error: any) {
          logger.warn("Skipped invalid tailored project row", {
            error: error?.message || String(error),
            name: `${project?.name || ""}`.trim(),
          });
        }
      }

      const skillBuckets = [
        ...(Array.isArray(tailored?.skills?.matched) ? tailored.skills.matched : []),
        ...(Array.isArray(tailored?.skills?.relevant) ? tailored.skills.relevant : []),
        ...(Array.isArray(tailored?.skills?.other) ? tailored.skills.other : []),
      ];
      const uniqueSkillNames = Array.from(
        new Set(
          skillBuckets
            .map((value: any) => `${value || ""}`.trim())
            .filter(Boolean),
        ),
      );

      for (const skillName of uniqueSkillNames) {
        try {
          await this.prisma.skill.create({
            data: {
              resumeId: created.id,
              name: skillName,
              category: "technical",
            },
          });
        } catch (error: any) {
          logger.warn("Skipped duplicate/invalid tailored skill", {
            error: error?.message || String(error),
            name: skillName,
          });
        }
      }

      if (Array.isArray(sourceResume.education) && sourceResume.education.length > 0) {
        for (const edu of sourceResume.education) {
          try {
            await this.prisma.education.create({
              data: {
                resumeId: created.id,
                institution: `${edu?.institution || ""}`.trim() || "Institution",
                degree: `${edu?.degree || ""}`.trim(),
                field: `${edu?.field || ""}`.trim(),
                startDate: edu?.startDate || new Date(),
                endDate: edu?.endDate ?? null,
              },
            });
          } catch (error: any) {
            logger.warn("Skipped invalid tailored education row", {
              error: error?.message || String(error),
              institution: `${edu?.institution || ""}`.trim(),
            });
          }
        }
      }

      return created.id;
    } catch (error: any) {
      logger.warn("Failed to persist tailored resume from workflow", {
        error: error?.message || String(error),
      });
      return null;
    }
  }
}

// Singleton
let applicationOrchestrator: ApplicationOrchestratorAgent | null = null;

export function getApplicationOrchestrator(): ApplicationOrchestratorAgent {
  if (!applicationOrchestrator) {
    applicationOrchestrator = new ApplicationOrchestratorAgent();
  }
  return applicationOrchestrator;
}

export default getApplicationOrchestrator;

