// src/agents/interview/behavioral-coach.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import VoiceLoader from "@/utils/voice-loader";

export interface STARStory {
  id: string;
  title: string;
  category: "leadership" | "conflict" | "failure" | "innovation" | "collaboration" | "pressure" | "customer" | "growth";
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics?: string;
  lessons?: string;
}

export interface QuestionMapping {
  question: string;
  category: string;
  suggestedStoryIds: string[];
  alternativeApproach?: string;
}

export interface BehavioralCoachResult {
  stories: STARStory[];
  questionMapping: QuestionMapping[];
  commonQuestions: string[];
  deliveryTips: {
    pacing: string;
    detailLevel: string;
    whatInterviewersListenFor: string[];
  };
}

export class BehavioralCoachAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  async generateStoryBank(targetRole?: string): Promise<AgentResponse<BehavioralCoachResult>> {
    try {
      logger.header("Behavioral Interview Coach");
      logger.info("Generating STAR story bank");

      const masterResume = await this.prisma.masterResume.findFirst({
        include: {
          experiences: {
            include: { achievements: true },
            orderBy: { startDate: "desc" },
          },
          projects: true,
        },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const stories = await this.generateSTARStories(masterResume, targetRole);
      const questionMapping = this.mapStoriesToQuestions(stories);
      const commonQuestions = this.getCommonQuestions();

      // Save stories to database
      await this.saveStoriesToDatabase(masterResume.id, stories, targetRole);

      logger.success(`Generated ${stories.length} STAR stories`);

      return {
        success: true,
        data: {
          stories,
          questionMapping,
          commonQuestions,
          deliveryTips: {
            pacing: "2-3 minutes per story maximum. Pause after the result to let it land.",
            detailLevel: "Focus 60% on Action, 30% on Result, 10% on Situation/Task",
            whatInterviewersListenFor: [
              "Specific metrics and quantifiable results",
              "Your personal contribution (use 'I' not 'we')",
              "What you learned or how you grew",
              "Problem-solving process, not just the outcome",
            ],
          },
        },
      };
    } catch (error: any) {
      logger.error("Story bank generation failed", error);
      return { success: false, error: error.message };
    }
  }

  private async saveStoriesToDatabase(resumeId: string, stories: STARStory[], targetRole?: string): Promise<void> {
    try {
      // Delete old stories for this resume
      await this.prisma.sTARStory.deleteMany({
        where: { resumeId },
      });

      // Save new stories
      await this.prisma.sTARStory.createMany({
        data: stories.map((story) => ({
          resumeId,
          title: story.title,
          category: story.category,
          situation: story.situation,
          task: story.task,
          action: story.action,
          result: story.result,
          metrics: story.metrics || null,
          lessons: story.lessons || null,
          targetRole: targetRole || null,
        })),
      });

      logger.debug(`Saved ${stories.length} STAR stories to database`);
    } catch (error) {
      logger.warn("Failed to save STAR stories to database", error);
    }
  }

  async getStoredStories(): Promise<AgentResponse<STARStory[]>> {
    try {
      const masterResume = await this.prisma.masterResume.findFirst();
      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const stories = await this.prisma.sTARStory.findMany({
        where: { resumeId: masterResume.id },
        orderBy: { createdAt: "desc" },
      });

      return { success: true, data: stories as unknown as STARStory[] };
    } catch (error: any) {
      logger.error("Failed to get stored stories", error);
      return { success: false, error: error.message };
    }
  }

  private async generateSTARStories(masterResume: any, targetRole?: string): Promise<STARStory[]> {
    const voiceGuidance = await VoiceLoader.getVoiceGuidance();

    const experiences = masterResume.experiences.slice(0, 3);
    const projects = masterResume.experiences.slice(0, 2);

    const prompt = `${voiceGuidance}

---

You are a senior engineering manager at Meta who has conducted 1,000+ behavioral interviews. Generate 8-10 STAR-format stories from the candidate's background.

## Candidate Background:
- Name: ${masterResume.fullName}
- Target Role: ${targetRole || "software engineer"}
- Career Story: ${masterResume.summaryShort || "Career transition from trades to software"}

## Experiences (for story material):
${experiences.map((exp: any, i: number) => `
${i + 1}. ${exp.title} at ${exp.company}
   Achievements:
   ${exp.achievements?.slice(0, 2).map((a: any) => `- ${a.description}`).join("\n   ") || "N/A"}
`).join("\n")}

## Projects:
${projects.map((proj: any, i: number) => `
${i + 1}. ${proj.name}: ${proj.description}
`).join("\n")}

## Your Task
Create 8-10 STAR stories covering these competency areas:

1. **LEADERSHIP** - Times you led teams, drove vision, made tough calls
2. **CONFLICT** - Times you navigated disagreement, politics, found solutions
3. **FAILURE** - Times you failed, what you learned, how you grew (frame as growth)
4. **INNOVATION** - Times you proposed new ideas, challenged status quo, drove change
5. **COLLABORATION** - Times you influenced without authority, built partnerships
6. **PRESSURE** - Times you delivered under tight deadlines, ambiguity, constraints
7. **CUSTOMER** - Times you went above and beyond for users/stakeholders
8. **GROWTH** - Times you learned quickly, adapted, self-taught

Each story must:
- Be genuinely from the candidate's real experience
- Include specific details (names, numbers, dates)
- Have a clear RESULT with metrics when possible
- Include what you learned or would do differently
- Sound natural when spoken aloud

## Output Format (Strict JSON):
{
  "stories": [
    {
      "id": "leadership-1",
      "title": "Short descriptive title",
      "category": "leadership|conflict|failure|innovation|collaboration|pressure|customer growth",
      "situation": "Context and background (1-2 sentences)",
      "task": "What you needed to accomplish (1 sentence)",
      "action": "What YOU specifically did (most detailed section)",
      "result": "Outcome with metrics (1-2 sentences)",
      "metrics": "Specific numbers if applicable",
      "lessons": "What you learned or would do differently"
    }
  ]
}

Return ONLY valid JSON.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.4,
      maxTokens: 2500,
    });

    if (response.success && response.data) {
      try {
        let jsonStr = response.data.trim();
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        }

        const parsed = JSON.parse(jsonStr);
        if (parsed.stories && Array.isArray(parsed.stories)) {
          return parsed.stories;
        }
      } catch (parseError) {
        logger.warn("Failed to parse STAR stories", parseError);
      }
    }

    return this.getDefaultStories();
  }

  private mapStoriesToQuestions(stories: STARStory[]): QuestionMapping[] {
    const questionBank = [
      {
        question: "Tell me about a time you led a team through a difficult project.",
        category: "leadership",
        storyTypes: ["leadership"],
      },
      {
        question: "Describe a time you had a conflict with a coworker or manager.",
        category: "conflict",
        storyTypes: ["conflict"],
      },
      {
        question: "Tell me about a time you failed. What did you learn?",
        category: "failure",
        storyTypes: ["failure", "growth"],
      },
      {
        question: "Give an example of a time you proposed a new idea or innovation.",
        category: "innovation",
        storyTypes: ["innovation"],
      },
      {
        question: "Describe a time you had to work with someone difficult.",
        category: "collaboration",
        storyTypes: ["collaboration", "conflict"],
      },
      {
        question: "Tell me about a time you had to meet a tight deadline.",
        category: "pressure",
        storyTypes: ["pressure"],
      },
      {
        question: "Give an example of a time you went above and beyond for a customer.",
        category: "customer",
        storyTypes: ["customer"],
      },
      {
        question: "Tell me about a time you had to learn something quickly.",
        category: "growth",
        storyTypes: ["growth"],
      },
      {
        question: "Describe a time you had to make a tough decision with limited information.",
        category: "leadership",
        storyTypes: ["leadership", "pressure"],
      },
      {
        question: "Tell me about a time you improved a process or system.",
        category: "innovation",
        storyTypes: ["innovation", "leadership"],
      },
    ];

    return questionBank.map((q) => ({
      ...q,
      suggestedStoryIds: stories
        .filter((s) => q.storyTypes.includes(s.category))
        .slice(0, 2)
        .map((s) => s.id),
      alternativeApproach: `If you don't have a ${q.category} story, focus on ${q.storyTypes[0]} from a different angle.`,
    }));
  }

  private getCommonQuestions(): string[] {
    return [
      "Tell me about yourself.",
      "Why do you want to work here?",
      "What is your greatest strength?",
      "What is your greatest weakness?",
      "Where do you see yourself in 5 years?",
      "Why should we hire you?",
      "Tell me about a challenging technical problem you solved.",
      "Describe your experience with [specific technology from resume].",
    ];
  }

  private getDefaultStories(): STARStory[] {
    return [
      {
        id: "leadership-1",
        title: "Led insulation project team",
        category: "leadership",
        situation: "As a Heat & Frost Insulator, I was assigned a large commercial building project worth $500K.",
        task: "Complete the project on time with a crew of 4 while maintaining quality standards.",
        action: "I organized daily stand-ups, delegated tasks based on crew strengths, and implemented a quality checklist system. When material delays occurred, I negotiated with suppliers and adjusted the work schedule.",
        result: "Completed the project 3 days ahead of schedule with zero quality defects and under budget by $15K.",
        metrics: "$500K project, 4-person crew, $15K under budget, 3 days early",
        lessons: "Early communication and flexibility are key to successful project management.",
      },
      {
        id: "innovation-1",
        title: "Built AI recipe platform",
        category: "innovation",
        situation: "I wanted to solve the problem of food waste and meal planning for people with dietary restrictions.",
        task: "Create an application that generates personalized recipes based on available ingredients and dietary needs.",
        action: "I designed and built Chef BonBon using React, Node.js, and OpenAI's API. I developed structured prompt templates to ensure consistent recipe quality and implemented user authentication with role-based access.",
        result: "The platform now serves 100+ active users with 85% improvement in recipe quality scores.",
        metrics: "100+ users, 85% quality improvement",
        lessons: "Iterative testing with real users is essential for AI-powered features.",
      },
    ];
  }
}

let behavioralCoachAgent: BehavioralCoachAgent | null = null;

export function getBehavioralCoachAgent(): BehavioralCoachAgent {
  if (!behavioralCoachAgent) {
    behavioralCoachAgent = new BehavioralCoachAgent();
  }
  return behavioralCoachAgent;
}

export default getBehavioralCoachAgent;
