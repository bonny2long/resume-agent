// src/orchestrator/workflow.ts
import { getResumeTailorAgent } from "@/agents/resume-tailor.agent";
import { getHarvardSummaryAgent } from "@/agents/resume/harvard-summary.agent";
import { getBehavioralCoachAgent } from "@/agents/interview/behavioral-coach.agent";
import { getCoverLetterAgent } from "@/agents/cover-letter-generator";
import { getInterviewExportService } from "@/services/interview-export.service";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";

export interface WorkflowResult {
  jobId: string;
  tailoredResume: any;
  summary: string;
  coverLetter: any;
  interviewStories: any;
  exports: string[];
}

export class ApplicationWorkflow {
  private prisma = getPrismaClient();

  /**
   * Complete application workflow: resume + summary + cover letter + interview prep
   */
  async runCompleteWorkflow(jobId: string): Promise<{ success: boolean; data?: WorkflowResult; error?: string }> {
    try {
      logger.header("Complete Application Workflow");
      logger.info("Starting complete workflow", { jobId });

      const exports: string[] = [];

      // Step 1: Get job details
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // Step 2: Generate tailored resume
      logger.step(1, 4, "Generating tailored resume...");
      const resumeAgent = getResumeTailorAgent();
      const resumeResult = await resumeAgent.tailorResume(jobId);

      if (!resumeResult.success) {
        throw new Error("Failed to generate tailored resume");
      }

      // Step 3: Generate Harvard-style summary
      logger.step(2, 4, "Generating summary...");
      const summaryAgent = getHarvardSummaryAgent();
      const summaryResult = await summaryAgent.generateSummaries(jobId);

      // Use recommended summary version
      const recommendedSummary = summaryResult.success && summaryResult.data?.versions && resumeResult.data
        ? summaryResult.data.versions[summaryResult.data.recommendation.suggestedVersion]?.summary
        : resumeResult.data?.summary || "";

      // Step 4: Generate cover letter using the tailored summary
      logger.step(3, 4, "Generating cover letter...");
      const coverLetterAgent = getCoverLetterAgent();
      const coverLetterResult = await coverLetterAgent.generateCoverLetter(jobId, {
        tone: "professional",
        includeCareerStory: true,
        maxParagraphs: 3,
        tailoredSummary: recommendedSummary,
      });

      // Step 5: Generate interview stories
      logger.step(4, 4, "Generating interview prep...");
      const interviewAgent = getBehavioralCoachAgent();
      const interviewResult = await interviewAgent.generateStoryBank(job.title);

      // Export interview stories
      const interviewExport = await getInterviewExportService().exportStoriesToPDF(job.title);
      if (interviewExport.success && interviewExport.filepath) {
        exports.push(interviewExport.filepath);
      }

      logger.success("Complete workflow finished!");

      return {
        success: true,
        data: {
          jobId,
          tailoredResume: resumeResult.data,
          summary: recommendedSummary,
          coverLetter: coverLetterResult.success ? coverLetterResult.data : null,
          interviewStories: interviewResult.success ? interviewResult.data : null,
          exports,
        },
      };
    } catch (error: any) {
      logger.error("Workflow failed", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Quick application package: resume + cover letter for a job
   */
  async quickApply(jobId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      logger.header("Quick Apply Workflow");

      // Get tailored resume
      const resumeAgent = getResumeTailorAgent();
      const resumeResult = await resumeAgent.tailorResume(jobId);

      if (!resumeResult.success) {
        throw new Error("Failed to tailor resume");
      }

      // Generate summary for cover letter
      const summaryAgent = getHarvardSummaryAgent();
      const summaryResult = await summaryAgent.generateSummaries(jobId);
      const summary = summaryResult.success && summaryResult.data?.versions && resumeResult.data
        ? summaryResult.data.versions[summaryResult.data.recommendation.suggestedVersion]?.summary
        : resumeResult.data?.summary || "";

      // Generate cover letter
      const coverLetterAgent = getCoverLetterAgent();
      const coverLetterResult = await coverLetterAgent.generateCoverLetter(jobId, {
        tone: "professional",
        includeCareerStory: true,
        maxParagraphs: 3,
        tailoredSummary: summary,
      });

      return {
        success: true,
        data: {
          resume: resumeResult.data,
          summary,
          coverLetter: coverLetterResult.success ? coverLetterResult.data : null,
        },
      };
    } catch (error: any) {
      logger.error("Quick apply failed", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Interview prep package for a specific job
   */
  async interviewPrep(jobId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      logger.header("Interview Prep Workflow");

      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // Generate STAR stories
      const interviewAgent = getBehavioralCoachAgent();
      const storiesResult = await interviewAgent.generateStoryBank(job.title);

      if (!storiesResult.success) {
        throw new Error("Failed to generate interview stories");
      }

      // Export to DOCX
      const exportResult = await getInterviewExportService().exportStoriesToPDF(job.title);

      return {
        success: true,
        data: {
          stories: storiesResult.data,
          exportedFile: exportResult.filepath,
        },
      };
    } catch (error: any) {
      logger.error("Interview prep failed", error);
      return { success: false, error: error.message };
    }
  }
}

let workflow: ApplicationWorkflow | null = null;

export function getApplicationWorkflow(): ApplicationWorkflow {
  if (!workflow) {
    workflow = new ApplicationWorkflow();
  }
  return workflow;
}

export default getApplicationWorkflow;
