export interface CoverLetter {
  yourName: string;
  yourAddress: string;
  yourEmail: string;
  yourPhone: string;
  recipientName: string;
  recipientTitle: string;
  companyName: string;
  companyAddress: string;
  date: string;
  greeting: string;
  opening: string;
  body: string[];
  closing: string;
  signature: string;
  hiringManager?: string;
  jobTitle?: string;
  tone?: string;
}

export interface CoverLetterOptions {
  tone?: "professional" | "enthusiastic" | "friendly";
  format?: "docx" | "pdf";
  template?: "modern" | "traditional" | "minimal";
  story?: boolean;
  includeCareerStory?: boolean;
  maxParagraphs?: number;
}

export class CoverLetterAgent {
  async generateCoverLetter(
    jobId: string,
    options: CoverLetterOptions = {},
  ): Promise<{ success: boolean; data?: CoverLetter; error?: string }> {
    try {
      // Get job details and master resume data
      const prisma = getPrismaClient();

      // Fetch job details
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        return { success: false, error: "Job not found" };
      }

      // Fetch master resume
      const masterResume = await prisma.masterResume.findFirst({
        include: {
          experiences: {
            include: {
              achievements: true,
              technologies: true,
            },
          },
        },
      });

      if (!masterResume) {
        return { success: false, error: "Master resume not found" };
      }

      // Generate cover letter content
      const currentDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const coverLetter: CoverLetter = {
        yourName: masterResume.fullName || "",
        yourAddress: masterResume.location || "",
        yourEmail: masterResume.email || "",
        yourPhone: masterResume.phone || "",
        recipientName: "Hiring Manager", // Default, could be enhanced
        recipientTitle: job.title,
        companyName: job.company?.name || "",
        companyAddress: job.company?.headquarters || "",
        date: currentDate,
        greeting: "Dear Hiring Manager,",
        opening: `I am writing to express my strong interest in the ${job.title} position at ${job.company?.name}.`,
        body: [
          `With my background and experience, I believe I would be a valuable addition to your team.`,
          `I am particularly drawn to this opportunity because it aligns perfectly with my skills and career goals.`,
          `I would welcome the opportunity to discuss how my qualifications match your needs.`,
        ],
        closing: "Sincerely,",
        signature: masterResume.fullName || "",
        hiringManager: "Hiring Manager",
        jobTitle: job.title,
        tone: options.tone || "professional",
      };

      return { success: true, data: coverLetter };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to generate cover letter",
      };
    }
  }
}

// Import Prisma client for database access
import getPrismaClient from "@/database/client";

export function getCoverLetterAgent(): CoverLetterAgent {
  return new CoverLetterAgent();
}
