// src/agents/career/career-pivot.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";

export interface SkillGap {
  skill: string;
  importance: "required" | "preferred";
  currentLevel: "expert" | "proficient" | "basic" | "none";
  gapClosing: string;
}

export interface BridgeRole {
  title: string;
  relevance: number;
  whyItWorks: string;
  nextSteps: string;
}

export interface NetworkingContact {
  role: string;
  value: string;
  template: string;
}

export interface CareerPivotResult {
  pivotNarrative: {
    hook: string;
    story: string;
    valueProp: string;
  };
  transferableSkills: {
    skill: string;
    fromContext: string;
    toContext: string;
    relevance: number;
  }[];
  gapAnalysis: {
    missing: SkillGap[];
    howToClose: string[];
  };
  bridgeRoles: BridgeRole[];
  resumeTranslation: {
    before: string;
    after: string;
    keywords: string[];
  };
  networkingPlan: {
    targets: NetworkingContact[];
    weeklyGoal: number;
    templates: string[];
  };
  learningPlan: {
    courses: Array<{ name: string; provider: string; priority: string }>;
    certifications: string[];
    projects: string[];
  };
  timeline: {
    phase1: { weeks: string; goal: string; actions: string[] };
    phase2: { weeks: string; goal: string; actions: string[] };
    phase3: { weeks: string; goal: string; actions: string[] };
  };
}

export class CareerPivotAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  async planPivot(
    targetRole?: string,
    targetIndustry?: string,
  ): Promise<AgentResponse<CareerPivotResult>> {
    try {
      logger.header("Career Pivot Strategist");
      logger.info("Planning career pivot");

      const masterResume = await this.prisma.masterResume.findFirst({
        include: { experiences: true, skills: true, projects: true },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const result = await this.generatePlan(
        masterResume,
        targetRole,
        targetIndustry,
      );

      logger.success("Career pivot plan created");

      return { success: true, data: result };
    } catch (error: any) {
      logger.error("Career pivot planning failed", error);
      return { success: false, error: error.message };
    }
  }

  private async generatePlan(
    masterResume: any,
    targetRole: string | undefined,
    targetIndustry?: string,
  ): Promise<CareerPivotResult> {
    const effectiveTargetRole = targetRole || "Senior Software Engineer";
    const prompt = `You are a senior career transition consultant at Korn Ferry who guides professionals through successful career pivots.

## Current Background:
- Name: ${masterResume.fullName}
- Current Skills: ${masterResume.skills?.slice(0, 12).map((s: any) => s.name).join(", ") || "N/A"}
- Previous Experience: ${masterResume.experiences?.slice(0, 2).map((e: any) => `${e.title} at ${e.company}`).join(", ") || "Trades (Electrical Technician, Heat & Frost Insulator)"}

## Target:
- Role: ${effectiveTargetRole || "Senior Software Engineer"}
- Industry: ${targetIndustry || "Tech"}

## Your Task
Create a comprehensive career pivot strategy:

1. **Pivot Narrative**: How to tell your career change story - strategic, not desperate
2. **Transferable Skills Audit**: Which current skills transfer to target role
3. **Gap Analysis**: What skills are missing and how to close each gap
4. **Bridge Roles**: Intermediate roles that get you closer without starting over
5. **Resume Translation**: How to reframe experience using target industry's language
6. **Networking Plan**: 20 specific people to connect with + conversation starters
7. **Learning Plan**: Courses, certifications, projects that build credibility fast
8. **Timeline**: Realistic 6-month pivot plan with weekly actions

## Output Format (Strict JSON):
{
  "pivotNarrative": {
    "hook": "attention-grabbing opening (1 sentence)",
    "story": "2-3 sentence strategic story",
    "valueProp": "what you bring that others don't"
  },
  "transferableSkills": [
    {
      "skill": "systematic problem-solving",
      "fromContext": "electrical troubleshooting",
      "toContext": "debugging software",
      "relevance": 9
    }
  ],
  "gapAnalysis": {
    "missing": [
      {
        "skill": "skill name",
        "importance": "required|preferred",
        "currentLevel": "expert|proficient|basic|none",
        "gapClosing": "how to learn"
      }
    ],
    "howToClose": ["action1", "action2"]
  },
  "bridgeRoles": [
    {
      "title": "Junior Developer",
      "relevance": 7,
      "whyItWorks": "uses some existing skills while building new ones",
      "nextSteps": "apply to entry roles"
    }
  ],
  "resumeTranslation": {
    "before": "original phrasing",
    "after": "industry language version",
    "keywords": ["keyword1", "keyword2"]
  },
  "networkingPlan": {
    "targets": [
      {
        "role": "target role people",
        "value": "what they offer",
        "template": "outreach template"
      }
    ],
    "weeklyGoal": 5,
    "templates": ["template1", "template2"]
  },
  "learningPlan": {
    "courses": [
      { "name": "course name", "provider": "platform", "priority": "high|medium|low" }
    ],
    "certifications": ["cert1", "cert2"],
    "projects": ["project1", "project2"]
  },
  "timeline": {
    "phase1": {
      "weeks": "1-4",
      "goal": "Foundation",
      "actions": ["action1", "action2"]
    },
    "phase2": {
      "weeks": "5-12",
      "goal": "Skill Building",
      "actions": ["action1", "action2"]
    },
    "phase3": {
      "weeks": "13-24",
      "goal": "Job Search",
      "actions": ["action1", "action2"]
    }
  }
}

Return ONLY valid JSON.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.4,
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
        logger.warn("Failed to parse career pivot plan", parseError);
      }
    }

    return this.getDefaultPlan(effectiveTargetRole);
  }

  private getDefaultPlan(_targetRole?: string): CareerPivotResult {
    return {
      pivotNarrative: {
        hook: "I bring a builder's mindset from the trades to software engineering.",
        story: "After 6 years as an electrical technician, I realized code could solve problems for thousands, not just one building at a time. Now I apply the same systematic, safety-first thinking to building software.",
        valueProp: "Unique perspective: I understand both physical infrastructure and digital systems, bringing reliability engineering thinking to every project.",
      },
      transferableSkills: [
        {
          skill: "Systematic Problem-Solving",
          fromContext: "Electrical troubleshooting, diagnosing complex systems",
          toContext: "Debugging, root cause analysis in software",
          relevance: 10,
        },
        {
          skill: "Project Management",
          fromContext: "Managed $500K+ construction projects",
          toContext: "Technical project planning, sprint management",
          relevance: 8,
        },
        {
          skill: "Safety-First Thinking",
          fromContext: "Electrical safety protocols, building codes",
          toContext: "Security best practices, data protection",
          relevance: 9,
        },
        {
          skill: "Technical Documentation",
          fromContext: "Reading and creating schematics, specs",
          toContext: "Code documentation, API specs",
          relevance: 8,
        },
        {
          skill: "Team Leadership",
          fromContext: "Led crews of 4-5 on construction sites",
          toContext: "Mentoring junior devs, tech lead roles",
          relevance: 7,
        },
      ],
      gapAnalysis: {
        missing: [
          {
            skill: "Advanced system design",
            importance: "preferred",
            currentLevel: "basic",
            gapClosing: "Take system design courses, build complex projects",
          },
          {
            skill: "Cloud infrastructure",
            importance: "preferred",
            currentLevel: "basic",
            gapClosing: "Get AWS/Azure certification",
          },
        ],
        howToClose: [
          "Complete 2-3 portfolio projects demonstrating full-stack skills",
          "Obtain AWS Solutions Architect certification",
          "Contribute to open source projects",
        ],
      },
      bridgeRoles: [
        {
          title: "Junior/Entry Full-Stack Developer",
          relevance: 8,
          whyItWorks: "Allows learning while contributing",
          nextSteps: "Apply to entry-level positions, emphasize transferable skills",
        },
        {
          title: "Technical Support Engineer",
          relevance: 7,
          whyItWorks: "Uses troubleshooting skills, lower barrier to entry",
          nextSteps: "Highlight customer service and problem-solving background",
        },
        {
          title: "DevOps/Platform Engineer",
          relevance: 6,
          whyItWorks: "Growing field, values practical problem-solvers",
          nextSteps: "Learn CI/CD, get cloud certification",
        },
      ],
      resumeTranslation: {
        before: "Insulated commercial buildings to specification",
        after: "Implemented technical specifications with precision, ensuring quality and safety compliance across all installations",
        keywords: ["specifications", "compliance", "quality assurance", "safety"],
      },
      networkingPlan: {
        targets: [
          {
            role: "Hiring Managers",
            value: "Direct job opportunities",
            template: "Hi, I'm transitioning from trades to tech and would love to learn about your team's needs.",
          },
          {
            role: "Tech Leads",
            value: "Technical guidance, referrals",
            template: "I'd love to learn about your journey and get your advice on breaking into software.",
          },
          {
            role: "Recruiters",
            value: "Job matching, market insights",
            template: "I'm a career changer with strong problem-solving skills. What roles might fit my background?",
          },
        ],
        weeklyGoal: 5,
        templates: [
          "Connection request with short intro",
          "Informational interview request",
          "Follow-up after meetups",
        ],
      },
      learningPlan: {
        courses: [
          { name: "Full-Stack Open", provider: "FreeCodeCamp", priority: "high" },
          { name: "AWS Solutions Architect", provider: "AWS", priority: "medium" },
        ],
        certifications: ["AWS Certified Developer", "React Certification"],
        projects: [
          "Full-stack application with authentication",
          "API integration project",
          "Real-time collaboration feature",
        ],
      },
      timeline: {
        phase1: {
          weeks: "1-4",
          goal: "Foundation",
          actions: [
            "Complete algorithm practice (LeetCode easy)",
            "Build first portfolio project",
            "Update LinkedIn with pivot story",
          ],
        },
        phase2: {
          weeks: "5-12",
          goal: "Skill Building",
          actions: [
            "Complete 2 more portfolio projects",
            "Get first AWS certification",
            "Start contributing to open source",
          ],
        },
        phase3: {
          weeks: "13-24",
          goal: "Job Search",
          actions: [
            "Apply to 5+ jobs per week",
            "Network with 5+ people per week",
            "Practice technical interviews",
          ],
        },
      },
    };
  }
}

let careerPivotAgent: CareerPivotAgent | null = null;

export function getCareerPivotAgent(): CareerPivotAgent {
  if (!careerPivotAgent) {
    careerPivotAgent = new CareerPivotAgent();
  }
  return careerPivotAgent;
}

export default getCareerPivotAgent;
