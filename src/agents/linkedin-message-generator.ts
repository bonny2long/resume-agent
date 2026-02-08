// src/agents/linkedin-message.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import fs from "fs";
import path from "path";

export interface LinkedInMessageOptions {
  type: "connection_request" | "initial_message" | "follow_up";
  tone: "professional" | "enthusiastic" | "friendly";
  includeCareerStory: boolean;
}

export interface LinkedInMessageResult {
  type: string;
  subject?: string;
  message: string;
  characterCount: number;
  tone: string;
  tips: string[];
}

export class LinkedInMessageAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  /**
   * Generate LinkedIn message
   */
  async generateMessage(
    jobId: string,
    hiringManagerId: string,
    options: LinkedInMessageOptions,
  ): Promise<AgentResponse<LinkedInMessageResult>> {
    try {
      logger.header("LinkedIn Message Generator");
      logger.info("Generating LinkedIn message", {
        type: options.type,
        tone: options.tone,
      });

      // Step 1: Load job data
      logger.step(1, 4, "Loading job data...");
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // Step 2: Load hiring manager
      logger.step(2, 4, "Loading hiring manager data...");
      const hiringManager = await this.prisma.hiringManager.findUnique({
        where: { id: hiringManagerId },
      });

      if (!hiringManager) {
        throw new Error("Hiring manager not found");
      }

      // Step 3: Load your resume
      logger.step(3, 4, "Loading resume data...");
      const masterResume = await this.prisma.masterResume.findFirst();

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      // Step 4: Load career story (if requested)
      let careerStory = "";
      if (options.includeCareerStory) {
        careerStory = await this.loadCareerStory();
      }

      // Step 5: Generate message
      logger.step(4, 4, "Generating message with AI...");
      const result = await this.generateMessageContent(
        job,
        hiringManager,
        masterResume,
        careerStory,
        options,
      );

      logger.success("Message generated!");

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      logger.error("LinkedIn message generation failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Load career story
   */
  private async loadCareerStory(): Promise<string> {
    try {
      const storyPath = path.join(
        process.cwd(),
        "data",
        "resumes",
        "career-transition-story.md",
      );

      if (fs.existsSync(storyPath)) {
        const content = fs.readFileSync(storyPath, "utf-8");

        // Extract short version for LinkedIn
        if (
          content.includes("electrical technician") ||
          content.includes("trades")
        ) {
          return "After 6+ years in electrical trades, I transitioned to software engineering, bringing a unique systematic approach to development.";
        }
      }
    } catch (error) {
      logger.warn("Could not load career story", error);
    }

    return "";
  }

  /**
   * Generate message content
   */
  private async generateMessageContent(
    job: any,
    hiringManager: any,
    masterResume: any,
    careerStory: string,
    options: LinkedInMessageOptions,
  ): Promise<LinkedInMessageResult> {
    let message = "";
    let subject = "";
    const tips: string[] = [];

    switch (options.type) {
      case "connection_request":
        message = await this.generateConnectionRequest(
          job,
          hiringManager,
          masterResume,
          careerStory,
          options.tone,
        );
        tips.push("Keep it under 300 characters");
        tips.push("Mention the specific role or company");
        tips.push("Be genuine and specific");
        break;

      case "initial_message":
        const initialResult = await this.generateInitialMessage(
          job,
          hiringManager,
          masterResume,
          careerStory,
          options.tone,
        );
        message = initialResult.message;
        subject = initialResult.subject;
        tips.push("Personalize to their background");
        tips.push("Show you've done research");
        tips.push("Include a clear call to action");
        break;

      case "follow_up":
        message = await this.generateFollowUp(
          job,
          hiringManager,
          masterResume,
          options.tone,
        );
        subject = `Following up: ${job.title} at ${job.company?.name}`;
        tips.push("Be polite and brief");
        tips.push("Offer value or additional info");
        tips.push("Suggest next steps");
        break;
    }

    return {
      type: options.type,
      subject: subject || undefined,
      message,
      characterCount: message.length,
      tone: options.tone,
      tips,
    };
  }

  /**
   * Generate connection request (max 300 chars)
   */
  private async generateConnectionRequest(
    job: any,
    hiringManager: any,
    masterResume: any,
    careerStory: string,
    tone: string,
  ): Promise<string> {
    const toneGuidance = this.getToneGuidance(tone);

    const prompt = `Write a LinkedIn connection request (MAXIMUM 300 characters) for a job application.

CRITICAL: Response must be 300 characters or less. This is a hard LinkedIn limit.

Job: ${job.title} at ${job.company?.name}
Hiring Manager: ${hiringManager.fullName}
${hiringManager.title ? `Their Title: ${hiringManager.title}` : ""}
Your Name: ${masterResume.fullName}
${careerStory ? `Your Story: ${careerStory}` : ""}

${toneGuidance}

Requirements:
1. Under 300 characters (INCLUDING spaces)
2. Mention the specific role or company
3. Be genuine, not generic
4. ${
      tone === "professional"
        ? "Professional and direct"
        : tone === "enthusiastic"
          ? "Show excitement"
          : "Be friendly and approachable"
    }

Return ONLY the message text, no quotation marks, no preamble.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.7,
      maxTokens: 150,
    });

    if (response.success && response.data) {
      let message = response.data.trim();

      // Remove quotes if present
      message = message.replace(/^["']|["']$/g, "");

      // Truncate if too long
      if (message.length > 300) {
        message = message.substring(0, 297) + "...";
      }

      return message;
    }

    // Fallback
    return `Hi ${hiringManager.fullName.split(" ")[0]}, I'm interested in the ${job.title} role at ${job.company?.name}. I'd love to connect and learn more about the opportunity.`;
  }

  /**
   * Generate initial message (after connection accepted)
   */
  private async generateInitialMessage(
    job: any,
    hiringManager: any,
    masterResume: any,
    careerStory: string,
    tone: string,
  ): Promise<{ subject: string; message: string }> {
    const toneGuidance = this.getToneGuidance(tone);

    const prompt = `Write a LinkedIn message to send after your connection request is accepted.

Job: ${job.title} at ${job.company?.name}
Hiring Manager: ${hiringManager.fullName}
${hiringManager.title ? `Their Title: ${hiringManager.title}` : ""}
Your Name: ${masterResume.fullName}
${careerStory ? `Your Story: ${careerStory}` : ""}
Your Skills: ${masterResume.skills
      ?.slice(0, 5)
      .map((s: any) => s.name)
      .join(", ")}

${toneGuidance}

Write a message that:
1. Thanks them for connecting
2. ${careerStory ? "Briefly mentions your unique background" : "Mentions your relevant experience"}
3. Expresses specific interest in the role
4. Asks for 15-20 minutes to chat
5. Is 3-4 short paragraphs

Return a JSON object:
{
  "subject": "Re: ${job.title} at ${job.company?.name}",
  "message": "the message text"
}

Return ONLY valid JSON.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.7,
      maxTokens: 400,
    });

    if (response.success && response.data) {
      try {
        let jsonStr = response.data.trim();

        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        }

        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        if (parsed.subject && parsed.message) {
          return {
            subject: parsed.subject,
            message: parsed.message,
          };
        }
      } catch (error) {
        logger.warn("Failed to parse JSON, using fallback");
      }
    }

    // Fallback
    return {
      subject: `Re: ${job.title} at ${job.company?.name}`,
      message: `Hi ${hiringManager.fullName.split(" ")[0]},

Thank you for connecting! ${careerStory ? careerStory + " " : ""}I'm very interested in the ${job.title} position at ${job.company?.name}.

I have experience with ${masterResume.skills
        ?.slice(0, 3)
        .map((s: any) => s.name)
        .join(
          ", ",
        )}, which aligns well with the role requirements. I'd love to learn more about the team and how I might contribute.

Would you have 15-20 minutes for a brief conversation this week or next?

Best regards,
${masterResume.fullName}`,
    };
  }

  /**
   * Generate follow-up message
   */
  private async generateFollowUp(
    job: any,
    hiringManager: any,
    _masterResume: any,
    tone: string,
  ): Promise<string> {
    const toneGuidance = this.getToneGuidance(tone);

    const prompt = `Write a polite follow-up LinkedIn message.

Context: You sent a message about the ${job.title} role at ${job.company?.name} 
to ${hiringManager.fullName} but haven't heard back.

${toneGuidance}

Write a brief follow-up that:
1. Is polite and understanding (they're busy)
2. Reiterates your interest
3. Offers additional information or flexibility
4. Keeps the door open
5. Is 2-3 sentences max

Return ONLY the message text.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.7,
      maxTokens: 200,
    });

    if (response.success && response.data) {
      return response.data.trim().replace(/^["']|["']$/g, "");
    }

    // Fallback
    return `Hi ${hiringManager.fullName.split(" ")[0]}, I wanted to follow up on my previous message about the ${job.title} role. I understand you're busy, but I remain very interested in the opportunity. Please let me know if you'd like any additional information. Thank you!`;
  }

  /**
   * Get tone guidance
   */
  private getToneGuidance(tone: string): string {
    switch (tone) {
      case "enthusiastic":
        return `Tone: Enthusiastic and energetic
- Show genuine excitement
- Use words like "thrilled", "excited", "passionate"
- Maintain professionalism`;

      case "friendly":
        return `Tone: Friendly and approachable
- Be conversational
- Use contractions ("I'm", "I'd")
- Show personality`;

      case "professional":
      default:
        return `Tone: Professional and respectful
- Formal but not stiff
- Direct and clear
- Business-appropriate`;
    }
  }

  /**
   * Save message to database
   */
  async saveMessage(
    hiringManagerId: string,
    type: string,
    subject: string | undefined,
    message: string,
    tone: string,
  ): Promise<string> {
    const linkedInMessage = await this.prisma.linkedInMessage.create({
      data: {
        hiringManagerId: hiringManagerId,
        type,
        subject,
        body: message,
        tone,
        characterCount: message.length,
      },
    });

    return linkedInMessage.id;
  }
}

// Singleton
let linkedInMessageAgent: LinkedInMessageAgent | null = null;

export function getLinkedInMessageAgent(): LinkedInMessageAgent {
  if (!linkedInMessageAgent) {
    linkedInMessageAgent = new LinkedInMessageAgent();
  }
  return linkedInMessageAgent;
}

export default getLinkedInMessageAgent;
