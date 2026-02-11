// src/agents/linkedin-message.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import storyLoader from "@/utils/story-loader";

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
   * Load career transition story using shared loader
   */
  private async loadCareerStory(): Promise<string> {
    try {
      // Use concise story for LinkedIn
      return await storyLoader.getConciseCareerStory();
    } catch (error) {
      logger.warn("Could not load career story", error);
      return "Former electrician turned software engineer - I bring systematic problem-solving and hands-on technical expertise to modern software development.";
    }
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

    // Extract relevant job details for personalization
    const keySkills =
      job.requiredSkills
        ?.slice(0, 3)
        .map((s: any) => s.name)
        .join(", ") || "";
    const companyFocus =
      job.company?.industry || job.company?.values?.slice(0, 1)[0] || "";
    const yourUniqueValue =
      careerStory || "Software engineer with strong problem-solving skills";

    // Extract hiring manager insights if available
    let hmInsights = "";
    if (hiringManager.profileData) {
      try {
        const profile =
          typeof hiringManager.profileData === "string" ?
            JSON.parse(hiringManager.profileData)
          : hiringManager.profileData;

        if (profile.experience?.length) {
          const recentExp = profile.experience[0];
          hmInsights +=
            recentExp.company ? `Works at ${recentExp.company}` : "";
        }
        if (profile.skills?.length) {
          const topSkills = profile.skills.slice(0, 2).join(", ");
          hmInsights +=
            hmInsights ? `. Skills: ${topSkills}` : `Skills: ${topSkills}`;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    const prompt = `Write a LinkedIn connection request (MAXIMUM 300 characters) for a job application.

CRITICAL: Response must be 300 characters or less. This is a hard LinkedIn limit.

Context:
Job: ${job.title} at ${job.company?.name}
${keySkills ? `Key skills needed: ${keySkills}` : ""}
${companyFocus ? `Company focus: ${companyFocus}` : ""}
Hiring Manager: ${hiringManager.fullName}
${hiringManager.title ? `Their Title: ${hiringManager.title}` : ""}
${hmInsights ? `About them: ${hmInsights}` : ""}
Your Name: ${masterResume.fullName}
Your unique value: ${yourUniqueValue}

${toneGuidance}

Requirements:
1. Under 300 characters (INCLUDING spaces)
2. Reference something specific about the role, company, or their background
3. Show why you're a good fit beyond just "interested"
4. Be memorable and stand out from generic requests
5. ${
      tone === "professional" ? "Professional but engaging"
      : tone === "enthusiastic" ? "Show genuine excitement"
      : "Be friendly and authentic"
    }

Examples of good hooks:
- "Love what ${job.company?.name} is doing in [specific area]"
- "Your experience with [specific tech/field] caught my eye"
- "My background in [relevant area] aligns perfectly with your [role/company focus]"

Return ONLY the message text, no quotation marks, no preamble.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.8,
      maxTokens: 150,
    });

    if (response.success && response.data) {
      let message = response.data.trim();

      // Remove quotes if present
      message = message.replace(/^["']|["']$/g, "");

      // Smart truncate if too long - try to end at a word boundary
      if (message.length > 300) {
        let truncated = message.substring(0, 298);
        const lastSpace = truncated.lastIndexOf(" ");
        const lastPeriod = truncated.lastIndexOf(".");

        if (lastSpace > 250 && lastSpace > lastPeriod) {
          truncated = truncated.substring(0, lastSpace);
        } else if (lastPeriod > 250) {
          truncated = truncated.substring(0, lastPeriod + 1);
        } else {
          truncated = truncated.substring(0, 295) + "...";
        }
        message = truncated;
      }

      return message;
    }

    // Improved fallback
    const firstName = hiringManager.fullName.split(" ")[0];
    if (keySkills) {
      return `Hi ${firstName}! Impressed by ${job.company?.name}'s work in ${companyFocus}. My background in ${keySkills.split(",")[0]} aligns perfectly with the ${job.title} role. Would love to connect!`;
    }
    return `Hi ${firstName}! Your work at ${job.company?.name} caught my eye. I'd bring unique value to the ${job.title} role and would love to connect about the opportunity.`;
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

    // Extract more specific details for personalization
    const topSkills =
      masterResume.skills
        ?.slice(0, 5)
        .map((s: any) => s.name)
        .join(", ") || "";
    const jobHighlights = job.responsibilities?.slice(0, 2).join("; ") || "";
    const companyValues = job.company?.values?.slice(0, 2).join("; ") || "";

    const prompt = `Write a compelling LinkedIn message to send after your connection request is accepted.

Context:
Job: ${job.title} at ${job.company?.name}
${jobHighlights ? `Role highlights: ${jobHighlights}` : ""}
${companyValues ? `Company values: ${companyValues}` : ""}
${
  job.requiredSkills?.length ?
    `Key skills needed: ${job.requiredSkills
      .slice(0, 3)
      .map((s: any) => s.name)
      .join(", ")}`
  : ""
}
Hiring Manager: ${hiringManager.fullName}
${hiringManager.title ? `Their Title: ${hiringManager.title}` : ""}
${hiringManager.department ? `Their Department: ${hiringManager.department}` : ""}
Your Name: ${masterResume.fullName}
${careerStory ? `Your unique story: ${careerStory}` : ""}
${topSkills ? `Your top skills: ${topSkills}` : ""}

${toneGuidance}

Write a message that:
1. Thanks them warmly for connecting
2. Shows you've done your homework - mention something specific about their role, the company, or recent company news/achievements
3. ${careerStory ? "Briefly connect your unique background to their needs" : "Connect your relevant experience to their specific challenges"}
4. Be specific about why THIS role excites you (not just any job)
5. Ask for a brief conversation with a clear call-to-action
6. Keep it conversational and engaging, not robotic

Structure:
- Warm opening + gratitude
- 1 paragraph showing research and specific interest
- 1 paragraph connecting your background to their needs
- Clear, easy call-to-action

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

    const prompt = `Write a thoughtful follow-up LinkedIn message that adds value.

Context: You previously connected with ${hiringManager.fullName} about the ${job.title} role at ${job.company?.name} but haven't heard back about your message.

${toneGuidance}

Write a follow-up that:
1. Acknowledges they're busy (shows empathy)
2. Briefly reminds them of your specific interest in THIS role
3. Offers something NEW - a quick insight, question, or relevant observation
4. Makes it easy for them to respond (low friction)
5. Is concise but not generic

Examples of value-add:
- "I just saw [company news] and it reinforced my interest"
- "Quick question about [specific aspect of the role]"
- "I recently worked with [relevant tech] and thought of your team"

Return ONLY the message text, no quotation marks.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.8,
      maxTokens: 200,
    });

    if (response.success && response.data) {
      return response.data.trim().replace(/^["']|["']$/g, "");
    }

    // Improved fallback
    const firstName = hiringManager.fullName.split(" ")[0];
    return `Hi ${firstName}, following up on the ${job.title} role. I understand you're busy - just wanted to reiterate my excitement about ${job.company?.name}'s innovative approach. Would 10 minutes work for a quick chat about how my background could help the team?`;
  }

  /**
   * Get tone guidance
   */
  private getToneGuidance(tone: string): string {
    switch (tone) {
      case "enthusiastic":
        return `Tone: Enthusiastic and energetic
- Show genuine excitement about the specific role/company
- Use words like "excited", "impressed", "fascinated", "passionate"
- Be energetic but maintain professionalism
- Focus on what specifically excites you about this opportunity`;

      case "friendly":
        return `Tone: Friendly and approachable
- Be conversational and natural
- Use appropriate contractions ("I'm", "I'd", "you'll")
- Show personality while staying professional
- Write like you'd speak to a colleague`;

      case "professional":
      default:
        return `Tone: Professional and polished
- Clear, confident, and respectful
- Direct but not abrupt
- Focus on value and competence
- Use business-appropriate language that shows you're a peer`;
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
