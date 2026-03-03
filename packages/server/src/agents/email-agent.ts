import { LLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";
import storyLoader from "@/utils/story-loader";

export interface EmailOptions {
  type: "initial_followup" | "post_interview" | "check_in";
  tone: "professional" | "enthusiastic" | "friendly";
  includeCareerStory?: boolean;
}

export class EmailAgent {
  private llm: LLMService;
  private prisma = getPrismaClient();

  constructor() {
    this.llm = new LLMService();
  }

  async generateEmail(applicationId: string, options: EmailOptions) {
    try {
      const app = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: { include: { company: true } },
          hiringManager: true,
        },
      });

      if (!app) {
        return { success: false, error: "Application not found" };
      }

      // Fetch master resume for candidate details
      const masterResume = await this.prisma.masterResume.findFirst();
      if (!masterResume) {
        return {
          success: false,
          error: "Master resume not found. Please run 'init' first.",
        };
      }

      // Load career story if requested
      let careerStory = "";
      if (options.includeCareerStory) {
        try {
          careerStory = await storyLoader.getConciseCareerStory();
        } catch (e) {
          logger.warn("Failed to load career story", e);
        }
      }

      const prompt = `
        You are an expert career coach helping a candidate write a job application email.
        
        TASK:
        Write a ${options.tone} email of type "${options.type.replace("_", " ")}".
        
        CANDIDATE INFO:
        - Name: ${masterResume.fullName}
        - Email: ${masterResume.email}
        - Phone: ${masterResume.phone}
        - LinkedIn: ${masterResume.linkedInUrl || ""}
        ${careerStory ? `- Career Story: ${careerStory}` : ""}

        CONTEXT:
        - Job: ${app.job.title} at ${app.job.company.name}
        - Hiring Manager: ${app.hiringManager?.name || "Hiring Manager"}
        - Hiring Manager Email: ${app.hiringManager?.email || ""}
        - Application Status: ${app.status}
        - Applied: ${app.appliedAt ? app.appliedAt.toDateString() : "Recently"}
        
        INSTRUCTIONS:
        - Use the candidate's real name, phone, and LinkedIn in the signature.
        - If the hiring manager has a name, address them directly (e.g., "Dear [Name]").
        - If the hiring manager has an email, use it in the "to" field.
        ${options.includeCareerStory ? "- Weave the career story naturally into the email body." : ""}
        - Do NOT use placeholders like "[Your Name]" or "[Phone Number]". Use the provided CANDIDATE INFO.
        
        OUTPUT FORMAT:
        Return ONLY a JSON object with these fields:
        {
          "to": "${app.hiringManager?.email || ""}",
          "subject": "The email subject line",
          "body": "The email body text (use \\n for newlines)",
          "tone": "${options.tone}",
          "type": "${options.type}"
        }
      `;

      const response = await this.llm.complete(prompt);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || "Failed to generate email",
        };
      }

      // Robust JSON parsing
      let data;
      try {
        const jsonMatch = response.data.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        } else {
          data = JSON.parse(response.data);
        }
      } catch (e) {
        logger.error("Failed to parse LLM response", {
          response: response.data,
        });
        return {
          success: false,
          error: "Failed to generate valid email format",
        };
      }

      return { success: true, data };
    } catch (error: any) {
      logger.error("Email generation error", error);
      return { success: false, error: error.message };
    }
  }

  async saveEmail(
    applicationId: string,
    type: string,
    to: string,
    subject: string,
    body: string,
    tone: string,
    hiringManagerId?: string,
  ) {
    return this.prisma.emailMessage.create({
      data: {
        applicationId,
        type,
        to,
        subject,
        body,
        tone,
        hiringManagerId,
        status: "draft",
      },
    });
  }
}

export const getEmailAgent = () => new EmailAgent();
