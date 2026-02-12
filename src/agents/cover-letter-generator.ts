// src/agents/cover-letter-generator.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import storyLoader from "@/utils/story-loader";

export interface CoverLetterOptions {
  tone: "professional" | "enthusiastic" | "friendly";
  includeCareerStory: boolean;
  maxParagraphs: number;
  tailoredSummary?: string;
}

export interface CoverLetter {
  // Header
  yourName: string;
  yourAddress: string;
  yourEmail: string;
  yourPhone: string;
  date: string;

  // Recipient
  hiringManager?: string;
  recipientName: string;
  recipientTitle: string;
  companyName: string;
  companyAddress?: string;

  // Content
  greeting: string;
  opening: string;
  body: string[];
  closing: string;
  signature: string;

  // Metadata
  jobId: string;
  jobTitle: string;
  tone: string;
}

export class CoverLetterAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  /**
    * Generate a cover letter for a specific job
    */
   async generateCoverLetter(
     jobId: string,
     options: CoverLetterOptions = {
       tone: "professional",
       includeCareerStory: true,
       maxParagraphs: 3,
     },
   ): Promise<AgentResponse<CoverLetter>> {
     try {
       logger.header("Cover Letter Agent");
       logger.info("Generating cover letter", { jobId, tone: options.tone });

       // Step 1: Load job and company data
       logger.step(1, 4, "Loading job and company data...");
       const job = await this.prisma.job.findUnique({
         where: { id: jobId },
         include: { company: true },
       });

       if (!job) {
         throw new Error("Job not found");
       }

       logger.success(`Job: ${job.title} at ${job.company?.name}`);

       // Step 2: Load master resume
       logger.step(2, 4, "Loading resume data...");
       const masterResume = await this.prisma.masterResume.findFirst({
         include: {
           experiences: {
             include: { achievements: true },
             orderBy: { startDate: "desc" },
           },
           projects: true,
           skills: true,
         },
       });

       if (!masterResume) {
         throw new Error("No master resume found");
       }

       logger.success(`Resume: ${masterResume.fullName}`);

       // Step 3: Load career story (if requested)
       let careerStory = "";
       if (options.includeCareerStory) {
         logger.step(3, 4, "Loading career story...");
         careerStory = await this.loadCareerStory();
         logger.success("Career story loaded");
       }

       // Step 4: Generate cover letter content
       logger.step(4, 4, "Generating cover letter with AI...");
       const content = await this.generateContent(
         job,
         masterResume,
         careerStory,
         options,
       );

       logger.success("Cover letter generated!");

       // Build final cover letter
       const coverLetter: CoverLetter = {
         yourName: masterResume.fullName,
         yourAddress: masterResume.location,
         yourEmail: masterResume.email,
         yourPhone: masterResume.phone,
         date: new Date().toLocaleDateString("en-US", {
           month: "long",
           day: "numeric",
           year: "numeric",
         }),
         hiringManager: undefined, // Will be filled by hiring manager finder
         recipientName: "Hiring Manager",
         recipientTitle: job.title,
         companyName: job.company?.name || "Hiring Team",
         companyAddress: job.company?.headquarters || undefined,
         greeting: content.greeting,
         opening: content.opening,
         body: content.body,
         closing: content.closing,
         signature: masterResume.fullName,
         jobId: job.id,
         jobTitle: job.title,
         tone: options.tone,
       };

       return {
         success: true,
         data: coverLetter,
       };
     } catch (error: any) {
       logger.error("Cover letter generation failed", error);
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
      await storyLoader.loadTransitionStory();

      // Use detailed story for cover letters
      return await storyLoader.getDetailedCareerStory();
    } catch (error) {
      logger.warn("Could not load career story", error);
      return "Career transitioner bringing systematic problem-solving from trades to software engineering.";
    }
  }

  /**
   * Load achievement stories using shared loader
   */
  private async loadAchievementStories(): Promise<
    Array<{
      project: string;
      role: string;
      keyAchievement: string;
      metric: string;
    }>
  > {
    try {
      const stories = await storyLoader.getAllAchievementStories();

      return stories.map((achievement) => ({
        project: achievement.project,
        role: achievement.role,
        keyAchievement:
          achievement.keyImpact ||
          achievement.quantifiableAchievements[0]?.description ||
          "Technical excellence",
        metric: achievement.quantifiableAchievements[0]?.metric || "",
      }));
    } catch (error) {
      logger.warn("Could not load achievement stories", error);
      return [];
    }
  }

  /**
   * Generate cover letter content using AI
   */
  private async generateContent(
    job: any,
    masterResume: any,
    careerStory: string,
    options: CoverLetterOptions,
  ): Promise<{
    greeting: string;
    opening: string;
    body: string[];
    closing: string;
  }> {
    // Load achievement stories for better examples
    const achievementStories = await this.loadAchievementStories();

    // Select 2-3 most relevant achievements (combine database with stories)
    const dbAchievements = masterResume.experiences
      .flatMap((exp: any) =>
        exp.achievements.map((ach: any) => ({
          company: exp.company,
          title: exp.title,
          achievement: ach.description,
          metrics: ach.metrics,
        })),
      )
      .slice(0, 2);

    // Add specific project achievements from stories
    const storyAchievements = achievementStories.slice(0, 1).map((story) => ({
      company: story.project,
      title: story.role,
      achievement: story.keyAchievement,
      metrics: story.metric,
    }));

    const topAchievements = [...storyAchievements, ...dbAchievements].slice(
      0,
      3,
    );

    // Build prompt based on tone
    const toneGuidance = this.getToneGuidance(options.tone);

    // ATS keywords from job requirements
    const atsKeywords = job.requiredSkills?.slice(0, 8).join(", ") || "";

    const prompt = `You are writing a compelling cover letter for a job application. Write in a ${options.tone} tone.

JOB INFORMATION:
Title: ${job.title}
Company: ${job.company?.name || "the company"}
Required Skills: ${job.requiredSkills?.slice(0, 8).join(", ") || "not specified"}
Company Values: ${job.company?.values?.join(", ") || "not specified"}
Company Culture: ${job.company?.workStyle?.join(", ") || "not specified"}

CANDIDATE INFORMATION:
Name: ${masterResume.fullName}
${careerStory ? `Career Story: ${careerStory}` : ""}
${options.tailoredSummary ? `Tailored Summary (use as reference for consistency): ${options.tailoredSummary}` : ""}

Recent Achievements:
${topAchievements
  .map(
    (a: any, i: number) =>
      `${i + 1}. ${a.achievement}${a.metrics ? ` (${a.metrics})` : ""}`,
  )
  .join("\n")}

Top Skills: ${
      masterResume.skills
        ?.slice(0, 10)
        .map((s: any) => s.name)
        .join(", ") || ""
    }

${toneGuidance}

CRITICAL REQUIREMENTS:
1. ATS OPTIMIZATION: Naturally incorporate these keywords into your letter: ${atsKeywords}
   - Use skills keywords in context, not just listed
   - Include relevant job requirements naturally in achievements
2. Opening paragraph: ${careerStory ? "Lead with career transition story if provided" : "Express enthusiasm for the role"}
3. Body paragraphs (${options.maxParagraphs - 2}): Reference specific achievements and how they relate to job requirements
4. Closing paragraph: Express interest in discussing further, reference company values/mission
5. Keep it concise - total 3-4 paragraphs maximum
6. Use active voice and strong verbs
7. Reference specific job requirements
8. Show you've researched the company

Return a JSON object with this structure:
{
  "greeting": "Dear Hiring Manager," (or personalized if you have a name),
  "opening": "first paragraph text",
  "body": ["second paragraph", "third paragraph if needed"],
  "closing": "final paragraph text"
}

Return ONLY valid JSON, no markdown formatting.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.7, // Higher for more personality
      maxTokens: 800,
    });

    if (response.success && response.data) {
      try {
        // Clean up response
        let jsonStr = response.data.trim();

        // Remove markdown if present
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        } else if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/```\n?/g, "");
        }

        // Extract JSON
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        // Validate structure
        if (
          parsed.greeting &&
          parsed.opening &&
          parsed.body &&
          parsed.closing
        ) {
          return {
            greeting: parsed.greeting,
            opening: parsed.opening,
            body: Array.isArray(parsed.body) ? parsed.body : [parsed.body],
            closing: parsed.closing,
          };
        }
      } catch (parseError) {
        logger.warn("Failed to parse AI response, using fallback", parseError);
      }
    }

    // Fallback cover letter
    return this.createFallbackContent(job, masterResume, careerStory);
  }

  /**
   * Get tone-specific guidance for the AI
   */
  private getToneGuidance(tone: string): string {
    switch (tone) {
      case "enthusiastic":
        return `TONE GUIDANCE (Enthusiastic):
- Express genuine excitement about the role and company
- Use energetic language ("thrilled", "excited", "passionate")
- Show eagerness to contribute
- Maintain professionalism while being personable
- Example: "I'm thrilled to apply for..."`;

      case "friendly":
        return `TONE GUIDANCE (Friendly):
- Write conversationally but professionally
- Use "I'm" instead of "I am", contractions are OK
- Be personable and approachable
- Show personality while staying professional
- Example: "I'd love to bring my experience in..."`;

      case "professional":
      default:
        return `TONE GUIDANCE (Professional):
- Maintain formal, business-appropriate language
- Avoid contractions (use "I am" not "I'm")
- Be direct and concise
- Focus on qualifications and fit
- Example: "I am writing to express my interest in..."`;
    }
  }

  /**
   * Create fallback content if AI fails
   */
  private createFallbackContent(
    job: any,
    _masterResume: any,
    careerStory: string,
  ): {
    greeting: string;
    opening: string;
    body: string[];
    closing: string;
  } {
    const opening =
      careerStory ?
        careerStory +
        ` I am writing to express my strong interest in the ${job.title} position at ${job.company?.name}.`
      : `I am writing to express my interest in the ${job.title} position at ${job.company?.name}. With my background in full-stack development and passion for building scalable applications, I am confident I would be a strong addition to your team.`;

    const body = [
      `In my recent role, I have successfully delivered multiple projects using technologies aligned with your requirements, including ${job.requiredSkills?.slice(0, 3).join(", ")}. My experience has taught me the importance of writing clean, maintainable code and collaborating effectively with cross-functional teams.`,
    ];

    const closing = `I am excited about the opportunity to contribute to ${job.company?.name} and would welcome the chance to discuss how my background and skills align with your needs. Thank you for considering my application.`;

    return {
      greeting: "Dear Hiring Manager,",
      opening,
      body,
      closing,
    };
  }
}

// Singleton
let coverLetterAgent: CoverLetterAgent | null = null;

export function getCoverLetterAgent(): CoverLetterAgent {
  if (!coverLetterAgent) {
    coverLetterAgent = new CoverLetterAgent();
  }
  return coverLetterAgent;
}

export default getCoverLetterAgent;
