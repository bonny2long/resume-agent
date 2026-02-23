// src/agents/career/personal-brand.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";

export interface ContentPlan {
  platform: string;
  contentType: string;
  frequency: string;
  topic: string;
  hook: string;
}

export interface PersonalBrandResult {
  positioning: {
    oneLiner: string;
    uniqueExpertise: string;
    differentiator: string;
  };
  thoughtLeadership: {
    topics: Array<{
      topic: string;
      angle: string;
      credibility: string;
    }>;
  };
  contentStrategy: {
    platforms: Array<{
      name: string;
      priority: "high" | "medium" | "low";
      contentTypes: string[];
      frequency: string;
    }>;
    contentCalendar: ContentPlan[];
  };
  speakingStrategy: {
    targetConferences: string[];
    topicsToPitch: string[];
    tips: string[];
  };
  networkingStrategy: {
    targetConnections: string[];
    valueProposition: string;
    outreachTemplates: string[];
  };
  onlinePresence: {
    audit: string[];
    recommendations: string[];
  };
  actionPlan90Days: Array<{
    week: number;
    actions: string[];
    milestone: string;
  }>;
}

export class PersonalBrandAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  async buildBrand(targetRole?: string): Promise<AgentResponse<PersonalBrandResult>> {
    try {
      logger.header("Personal Brand Strategist");
      logger.info("Building personal brand strategy");

      const masterResume = await this.prisma.masterResume.findFirst({
        include: { experiences: true, skills: true, projects: true },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const result = await this.generateStrategy(masterResume, targetRole);

      logger.success("Personal brand strategy created");

      return { success: true, data: result };
    } catch (error: any) {
      logger.error("Personal brand strategy failed", error);
      return { success: false, error: error.message };
    }
  }

  private async generateStrategy(
    masterResume: any,
    targetRole?: string,
  ): Promise<PersonalBrandResult> {
    const prompt = `You are a senior partner at Heidrick & Struggles who builds personal brands for executives transitioning into new roles.

## Candidate Background:
- Name: ${masterResume.fullName}
- Current Role: Full Stack Software Engineer
- Target Role: ${targetRole || "Senior Engineer / Tech Lead"}
- Skills: ${masterResume.skills?.slice(0, 10).map((s: any) => s.name).join(", ") || "N/A"}
- Unique Background: Career transition from trades (electrical technician, heat & frost insulator) to software engineering

## Projects:
${masterResume.projects?.slice(0, 2).map((p: any) => `- ${p.name}: ${p.description}`).join("\n") || "N/A"}

## Your Task
Create a comprehensive personal brand strategy:

1. **Brand Positioning Statement**: One sentence capturing who you are professionally + unique expertise + differentiator

2. **Thought Leadership Topics**: 5 subjects you can credibly own and speak about

3. **Content Strategy**: Where to publish, how often, what formats work best

4. **Speaking Strategy**: How to get invited to conferences and events

5. **Networking Strategy**: Who to connect with, how to add value, how to stay top of mind

6. **Online Presence Audit**: What shows up when someone Googles you + recommendations

7. **90-Day Action Plan**: Weekly milestones with measurable goals

## Output Format (Strict JSON):
{
  "positioning": {
    "oneLiner": "I am a [role] who specializes in [expertise]",
    "uniqueExpertise": "specific intersection of skills only you have",
    "differentiator": "what makes you different from others"
  },
  "thoughtLeadership": {
    "topics": [
      {
        "topic": "topic name",
        "angle": "unique angle",
        "credibility": "why you're qualified to speak on this"
      }
    ]
  },
  "contentStrategy": {
    "platforms": [
      {
        "name": "LinkedIn",
        "priority": "high|medium|low",
        "contentTypes": ["posts", "articles"],
        "frequency": "2-3x per week"
      }
    ],
    "contentCalendar": [
      {
        "platform": "LinkedIn",
        "contentType": "post",
        "frequency": "weekly",
        "topic": "topic",
        "hook": "attention-grabbing opening"
      }
    ]
  },
  "speakingStrategy": {
    "targetConferences": ["conference1", "conference2"],
    "topicsToPitch": ["topic1", "topic2"],
    "tips": ["tip1", "tip2"]
  },
  "networkingStrategy": {
    "targetConnections": ["role1", "role2"],
    "valueProposition": "what you offer",
    "outreachTemplates": ["template1", "template2"]
  },
  "onlinePresence": {
    "audit": ["what shows up now"],
    "recommendations": ["what to improve"]
  },
  "actionPlan90Days": [
    {
      "week": 1,
      "actions": ["action1"],
      "milestone": "what you achieve"
    }
  ]
}

Return ONLY valid JSON.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.5,
      maxTokens: 2000,
    });

    if (response.success && response.data) {
      try {
        let jsonStr = response.data.trim();
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        }
        return JSON.parse(jsonStr);
      } catch (parseError) {
        logger.warn("Failed to parse brand strategy", parseError);
      }
    }

    return this.getDefaultStrategy(masterResume.fullName, targetRole);
  }

  private getDefaultStrategy(_name: string, targetRole?: string): PersonalBrandResult {
    return {
      positioning: {
        oneLiner: `I am a ${targetRole || "Full Stack Engineer"} who bridges practical problem-solving from trades with modern software development.`,
        uniqueExpertise: "Applying systematic, hands-on engineering thinking from electrical/trades to software - understanding how code impacts real-world physical systems.",
        differentiator: "Unique perspective: Most developers only know software. I understand both physical infrastructure AND digital systems, bringing a builder's mindset to code.",
      },
      thoughtLeadership: {
        topics: [
          {
            topic: "Career Transitions to Tech",
            angle: "From trades to software - practical guide",
            credibility: "Lived experience transitioning from electrical technician to software engineer",
          },
          {
            topic: "Building Secure Applications",
            angle: "Security as a system, not a feature",
            credibility: "Experience designing RBAC systems with building-block thinking",
          },
          {
            topic: "Full-Stack Development",
            angle: "Practical, maintainable code over complexity",
            credibility: "Built production apps with React, Node.js, PostgreSQL",
          },
          {
            topic: "AI/ML Integration",
            angle: "Practical AI applications for real problems",
            credibility: "Built Chef BonBon and United Airlines AI project",
          },
          {
            topic: "Project Management for Developers",
            angle: "Lessons from construction project management",
            credibility: "Managed $500K+ insulation projects before software",
          },
        ],
      },
      contentStrategy: {
        platforms: [
          {
            name: "LinkedIn",
            priority: "high",
            contentTypes: ["posts", "articles"],
            frequency: "3-5x per week",
          },
          {
            name: "GitHub",
            priority: "high",
            contentTypes: ["projects", "READMEs"],
            frequency: "Ongoing",
          },
          {
            name: "DEV.to",
            priority: "medium",
            contentTypes: ["articles"],
            frequency: "1-2x per week",
          },
        ],
        contentCalendar: [
          {
            platform: "LinkedIn",
            contentType: "post",
            frequency: "weekly",
            topic: "Career insights",
            hook: "Something I wish I knew before my career change...",
          },
          {
            platform: "LinkedIn",
            contentType: "post",
            frequency: "weekly",
            topic: "Technical learning",
            hook: "Here's what actually worked learning to code...",
          },
        ],
      },
      speakingStrategy: {
        targetConferences: ["React Summit", "NodeConf", "Local meetups"],
        topicsToPitch: ["Career transition stories", "Building secure full-stack apps"],
        tips: [
          "Start with local meetups",
          "Share your career story - it's compelling",
          "Document your learning journey publicly",
        ],
      },
      networkingStrategy: {
        targetConnections: [
          "Senior Engineers",
          "Engineering Managers",
          "Tech Recruiters",
          "Startup Founders",
        ],
        valueProposition: "Unique perspective combining trades experience with modern tech skills",
        outreachTemplates: [
          "Hi [Name], I'm a software engineer who transitioned from electrical work. I'd love to connect and learn about your journey.",
        ],
      },
      onlinePresence: {
        audit: ["LinkedIn profile", "GitHub profile", "Google search results"],
        recommendations: [
          "Update LinkedIn with career transition story",
          "Ensure GitHub has well-documented projects",
          "Create a personal website/portfolio",
        ],
      },
      actionPlan90Days: [
        {
          week: 1,
          actions: ["Finalize LinkedIn profile", "Clean up GitHub"],
          milestone: "Professional online presence ready",
        },
        {
          week: 2,
          actions: ["Post first LinkedIn article", "Connect with 5 people"],
          milestone: "Content strategy launched",
        },
        {
          week: 3,
          actions: ["Start GitHub project", "Attend virtual meetup"],
          milestone: "Community engagement started",
        },
        {
          week: 4,
          actions: ["Pitch talk to local meetup", "Write 2 articles"],
          milestone: "Thought leadership begun",
        },
      ],
    };
  }
}

let personalBrandAgent: PersonalBrandAgent | null = null;

export function getPersonalBrandAgent(): PersonalBrandAgent {
  if (!personalBrandAgent) {
    personalBrandAgent = new PersonalBrandAgent();
  }
  return personalBrandAgent;
}

export default getPersonalBrandAgent;
