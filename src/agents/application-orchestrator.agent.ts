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

  // Summary
  summary: string;
}

export class ApplicationOrchestratorAgent {
  private prisma = getPrismaClient();

  /**
   * Run complete application workflow
   */
  async applyToJob(jobUrl: string): Promise<AgentResponse<ApplicationPackage>> {
    try {
      logger.header("Complete Application Workflow");
      logger.info("Starting automated application process", { jobUrl });

      // Step 1: Analyze job
      logger.step(1, 6, "Analyzing job posting...");
      const jobAnalyzer = getJobAnalyzerAgent();
      const analysisResult = await jobAnalyzer.analyzeJobFromUrl(jobUrl);

      if (!analysisResult.success || !analysisResult.data) {
        throw new Error("Job analysis failed: " + analysisResult.error);
      }

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
            experienceLevel:
              analysisResult.data.experienceLevel ||
              existingJob.experienceLevel,
          },
        });

        return this.processWorkflowAfterJobCreated(
          updatedJob,
          analysisResult.data.company,
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
          experienceLevel: analysisResult.data.experienceLevel || "entry",
        },
      });

      return this.processWorkflowAfterJobCreated(
        job,
        analysisResult.data.company,
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
  ): Promise<AgentResponse<ApplicationPackage>> {
    try {
      const jobId = job.id;
      const jobTitle = job.title;
      const matchScore = 0; // Will calculate later if needed

      logger.success(
        `Job analyzed: ${jobTitle} at ${companyName} (${matchScore}% match)`,
      );

      // Step 2: Tailor resume
      logger.step(2, 6, "Tailoring resume with RAG...");
      const resumeTailor = getResumeTailorAgent();
      const tailorResult = await resumeTailor.tailorResume(jobId);

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
      const summaryResult = await resumeTailor.generateSummaryOnly(jobId);
      const tailoredSummary = summaryResult.success && summaryResult.data 
        ? summaryResult.data 
        : undefined;

      if (tailoredSummary) {
        logger.success("Tailored summary generated");
      }

      // Step 3: Generate resume DOCX
      logger.step(3, 6, "Generating resume document...");
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
      logger.step(4, 6, "Generating cover letter...");
      const coverLetterAgent = getCoverLetterAgent();
      const coverLetterResult = await coverLetterAgent.generateCoverLetter(
        jobId,
        {
          tone: "professional",
          includeCareerStory: true,
          maxParagraphs: 4,
          tailoredSummary: tailoredSummary,
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
      logger.step(5, 6, "Finding hiring manager...");
      const hiringManagerFinder = getHiringManagerFinderAgent();
      const hmResult = await hiringManagerFinder.findHiringManager(jobId);

      let hiringManagerId: string | undefined;
      let hiringManagerName: string | undefined;
      let hiringManagerLinkedIn: string | undefined;

      if (hmResult.success && hmResult.data?.topMatch) {
        const topMatch = hmResult.data.topMatch;

        // Update existing hiring manager if found, or create new
        const savedHM = await this.prisma.hiringManager.upsert({
          where: { id: topMatch.id || "" },
          update: {
            name: topMatch.name,
            title: topMatch.title,
            linkedInUrl: topMatch.linkedInUrl,
            email: topMatch.email,
            phone: topMatch.phone,
            confidence: topMatch.confidence,
            sources: [topMatch.source],
            verified: topMatch.verified,
          },
          create: {
            jobId: jobId,
            name: topMatch.name,
            title: topMatch.title,
            linkedInUrl: topMatch.linkedInUrl,
            email: topMatch.email,
            phone: topMatch.phone,
            confidence: topMatch.confidence,
            sources: [topMatch.source],
            verified: topMatch.verified,
          },
        });

        hiringManagerId = savedHM.id;
        hiringManagerName = topMatch.name;
        hiringManagerLinkedIn = topMatch.linkedInUrl;

        logger.success(
          `Hiring manager found: ${topMatch.name} (${topMatch.confidence}% confidence)`,
        );
      } else {
        logger.warn("No hiring manager found, continuing without");
      }

      // Step 6: Generate LinkedIn message (if hiring manager found)
      let linkedInMessage: string | undefined;

      if (hiringManagerId) {
        logger.step(6, 6, "Generating LinkedIn message...");
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
        logger.step(6, 6, "Skipping LinkedIn message (no hiring manager)");
      }

      // Step 7: Create application record
      const application = await this.prisma.application.create({
        data: {
          jobId: jobId,
          status: "prepared",
          resumePath: resumeResult.filepath,
          coverLetterPath: coverLetterDocResult.filepath,
          hiringManagerId: hiringManagerId,
          linkedInSent: false,
          notes: `Generated via apply command on ${new Date().toLocaleDateString()}`,
        },
      });

      logger.success("Application record created");

      // Build summary
      const summary = this.buildSummary(
        jobTitle,
        companyName,
        matchScore,
        resumeResult.filepath,
        coverLetterDocResult.filepath,
        hiringManagerName,
        linkedInMessage,
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
          hiringManagerLinkedIn: hiringManagerLinkedIn || "",
          linkedInMessage: linkedInMessage || "",
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
  ): string {
    const parts = [
      `Job: ${jobTitle} at ${companyName}`,
      `Match Score: ${matchScore}%`,
      ``,
      `✅ Resume: ${resumePath}`,
      `✅ Cover Letter: ${coverLetterPath}`,
    ];

    if (hiringManagerName) {
      parts.push(`✅ Hiring Manager: ${hiringManagerName}`);
    }

    if (linkedInMessage) {
      parts.push(`✅ LinkedIn Message: Ready to send`);
    }

    parts.push(``);
    parts.push(`Next Steps:`);
    parts.push(`1. Review both documents`);
    parts.push(`2. Customize if needed`);
    parts.push(`3. Submit application on company website`);

    if (linkedInMessage) {
      parts.push(`4. Send LinkedIn connection request`);
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
