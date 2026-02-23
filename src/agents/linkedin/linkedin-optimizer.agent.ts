// src/agents/linkedin/linkedin-optimizer.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import VoiceLoader from "@/utils/voice-loader";

export interface LinkedInProfile {
  headline: string;
  about: string;
  experience: Array<{
    title: string;
    company: string;
    description: string;
  }>;
  skills: string[];
  featured: {
    items: Array<{
      type: "article" | "project" | "media";
      title: string;
      url: string;
    }>;
  };
  customUrl: string;
}

export interface LinkedInOptimizationResult {
  profile: LinkedInProfile;
  headline: {
    current: string;
    recommended: string;
    formula: string;
    characterCount: number;
  };
  about: {
    current: string;
    recommended: string;
    keywords: string[];
  };
  experience: Array<{
    company: string;
    title: string;
    current: string;
    recommended: string;
  }>;
  skills: {
    top50: string[];
    orderedForSearch: string[];
  };
  recommendations: {
    requested: number;
    suggestedPeople: string[];
    template: string;
  };
  profileOptimizationTips: {
    bannerImage: string;
    photo: string;
    customURL: string;
    contactInfo: string;
  };
  activityStrategy: {
    postingFrequency: string;
    contentTypes: string[];
    engagementTips: string[];
  };
}

export class LinkedInOptimizerAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  async optimizeProfile(targetRoles?: string[]): Promise<AgentResponse<LinkedInOptimizationResult>> {
    try {
      logger.header("LinkedIn Profile Optimizer");
      logger.info("Optimizing LinkedIn profile");

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

      const optimization = await this.generateOptimization(masterResume, targetRoles);

      logger.success("LinkedIn profile optimized");

      return {
        success: true,
        data: optimization,
      };
    } catch (error: any) {
      logger.error("LinkedIn optimization failed", error);
      return { success: false, error: error.message };
    }
  }

  private async generateOptimization(
    masterResume: any,
    targetRoles?: string[],
  ): Promise<LinkedInOptimizationResult> {
    const voiceGuidance = await VoiceLoader.getVoiceGuidance();

    const targetRoleStr = targetRoles?.join(", ") || "Full Stack Engineer";

    const prompt = `${voiceGuidance}

---

You are a senior partner at Spencer Stuart executive search who optimizes LinkedIn profiles for C-suite and senior executives. Generate a complete LinkedIn profile optimization.

## Current Profile Data:
- Name: ${masterResume.fullName}
- Title: Full Stack Software Engineer
- Current Summary: ${masterResume.summaryShort || "N/A"}
- Skills: ${masterResume.skills?.slice(0, 15).map((s: any) => s.name).join(", ") || "N/A"}

## Experience:
${masterResume.experiences?.slice(0, 3).map((exp: any, i: number) => `
${i + 1}. ${exp.title} at ${exp.company}
   ${exp.description || exp.achievements?.slice(0, 2).map((a: any) => a.description).join(" ") || ""}
`).join("\n")}

## Projects:
${masterResume.projects?.slice(0, 2).map((proj: any) => `
- ${proj.name}: ${proj.description}
`).join("\n")}

## Target Roles: ${targetRoleStr}

## Your Task
Optimize the LinkedIn profile for maximum recruiter visibility and engagement.

### 1. HEADLINE (220 characters max)
Create a headline using this formula:
[Role] at [Company] | [Key Skill] + [Key Skill] | [Value Proposition]

Example: "Full Stack Engineer at TechCo | React & Node.js | Building scalable apps that users love"

### 2. ABOUT SECTION (2600 chars max)
Write a compelling 3-paragraph story:
- Paragraph 1: Your unique story/background (trades to tech is compelling)
- Paragraph 2: What you build and your approach
- Paragraph 3: What you're looking for

Include keywords naturally for search: ${targetRoleStr}

### 3. EXPERIENCE SECTION
Rewrite each experience with achievement-driven bullets (not job duties). Use numbers and impact.

### 4. SKILLS SECTION
Order top 50 skills by:
1. Most relevant to target roles
2. Most impressive/recognized
3. Most frequently searched

### 5. FEATURED SECTION
Suggest 3 items to showcase: project, article, certification

### 6. ACTIVITY STRATEGY
Suggest posting frequency and content types that boost visibility

## Output Format (Strict JSON):
{
  "headline": {
    "current": "Full Stack Software Engineer",
    "recommended": "your optimized headline",
    "formula": "Role at Company | Skill + Skill | Value Prop",
    "characterCount": number
  },
  "about": {
    "current": "original summary",
    "recommended": "optimized about section",
    "keywords": ["keyword1", "keyword2"]
  },
  "experience": [
    {
      "company": "company name",
      "title": "job title",
      "current": "original description",
      "recommended": "optimized bullets"
    }
  ],
  "skills": {
    "top50": ["skill1", "skill2", ...],
    "orderedForSearch": ["most important first"]
  },
  "recommendations": {
    "requested": 5,
    "suggestedPeople": ["person1", "person2"],
    "template": "request template"
  },
  "profileOptimizationTips": {
    "bannerImage": "recommendation",
    "photo": "recommendation", 
    "customURL": "linkedin.com/in/yourname",
    "contactInfo": "what to include"
  },
  "activityStrategy": {
    "postingFrequency": "2-3x per week",
    "contentTypes": ["type1", "type2"],
    "engagementTips": ["tip1", "tip2"]
  }
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

        const parsed = JSON.parse(jsonStr);
        return this.buildResult(parsed, masterResume);
      } catch (parseError) {
        logger.warn("Failed to parse LinkedIn optimization", parseError);
      }
    }

    return this.getDefaultOptimization(masterResume);
  }

  private buildResult(parsed: any, masterResume: any): LinkedInOptimizationResult {
    return {
      profile: {
        headline: parsed.headline?.recommended || "Full Stack Software Engineer",
        about: parsed.about?.recommended || masterResume.summaryShort || "",
        experience: parsed.experience || [],
        skills: parsed.skills?.top50 || [],
        featured: {
          items: [],
        },
        customUrl: parsed.profileOptimizationTips?.customURL || "",
      },
      headline: {
        current: "Full Stack Software Engineer",
        recommended: parsed.headline?.recommended || "",
        formula: parsed.headline?.formula || "Role | Skill + Skill | Value",
        characterCount: (parsed.headline?.recommended || "").length,
      },
      about: {
        current: masterResume.summaryShort || "",
        recommended: parsed.about?.recommended || "",
        keywords: parsed.about?.keywords || [],
      },
      experience: parsed.experience || [],
      skills: {
        top50: parsed.skills?.top50 || [],
        orderedForSearch: parsed.skills?.orderedForSearch || [],
      },
      recommendations: parsed.recommendations || {
        requested: 5,
        suggestedPeople: [],
        template: "",
      },
      profileOptimizationTips: parsed.profileOptimizationTips || {
        bannerImage: "Use professional banner showing your work/industry",
        photo: "Professional headshot with good lighting",
        customURL: `linkedin.com/in/${masterResume.fullName.toLowerCase().replace(/ /g, "-")}`,
        contactInfo: "Email and preferred contact method",
      },
      activityStrategy: parsed.activityStrategy || {
        postingFrequency: "2-3x per week",
        contentTypes: ["Industry insights", "Project highlights", "Learning shares"],
        engagementTips: ["Comment on others' posts", "Share relevant articles"],
      },
    };
  }

  private getDefaultOptimization(masterResume: any): LinkedInOptimizationResult {
    const defaultHeadline = `Full Stack Engineer | ${masterResume.skills?.slice(0, 3).map((s: any) => s.name).join(" & ") || "React & Node.js"} | Building scalable applications`;

    return {
      profile: {
        headline: defaultHeadline,
        about: masterResume.summaryShort || "",
        experience: [],
        skills: masterResume.skills?.slice(0, 50).map((s: any) => s.name) || [],
        featured: { items: [] },
        customUrl: "",
      },
      headline: {
        current: "Full Stack Software Engineer",
        recommended: defaultHeadline,
        formula: "Role | Key Skill + Key Skill | Value Proposition",
        characterCount: defaultHeadline.length,
      },
      about: {
        current: masterResume.summaryShort || "",
        recommended: masterResume.summaryShort || "",
        keywords: masterResume.skills?.slice(0, 10).map((s: any) => s.name) || [],
      },
      experience: [],
      skills: {
        top50: masterResume.skills?.slice(0, 50).map((s: any) => s.name) || [],
        orderedForSearch: masterResume.skills?.slice(0, 50).map((s: any) => s.name) || [],
      },
      recommendations: {
        requested: 5,
        suggestedPeople: [],
        template: "",
      },
      profileOptimizationTips: {
        bannerImage: "Use professional banner showing your work/industry",
        photo: "Professional headshot with good lighting",
        customURL: `linkedin.com/in/${masterResume.fullName.toLowerCase().replace(/ /g, "-")}`,
        contactInfo: "Email and preferred contact method",
      },
      activityStrategy: {
        postingFrequency: "2-3x per week",
        contentTypes: ["Industry insights", "Project highlights", "Learning shares"],
        engagementTips: ["Comment on others' posts", "Share relevant articles"],
      },
    };
  }
}

let linkedInOptimizerAgent: LinkedInOptimizerAgent | null = null;

export function getLinkedInOptimizerAgent(): LinkedInOptimizerAgent {
  if (!linkedInOptimizerAgent) {
    linkedInOptimizerAgent = new LinkedInOptimizerAgent();
  }
  return linkedInOptimizerAgent;
}

export default getLinkedInOptimizerAgent;
