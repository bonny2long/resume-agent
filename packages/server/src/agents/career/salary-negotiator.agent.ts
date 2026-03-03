// src/agents/career/salary-negotiator.agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";

export interface OfferDetails {
  baseSalary: number;
  bonus?: number;
  equity?: number;
  signingBonus?: number;
  benefits?: string[];
  remoteWork?: string;
  title?: string;
}

export interface NegotiationScript {
  scenario: string;
  script: string;
  timing: "initial" | "counter" | "closing";
  keyPoints: string[];
}

export interface SalaryNegotiationResult {
  marketAnalysis: {
    role: string;
    location: string;
    salaryRange: { low: number; mid: number; high: number };
    sources: string[];
  };
  totalCompensation: {
    base: number;
    bonus: number;
    equity: number;
    signing: number;
    benefits: number;
    total: number;
  };
  scripts: {
    initialResponse: NegotiationScript;
    counterOffer: NegotiationScript;
    objectionHandling: Array<{ objection: string; script: string }>;
    closing: NegotiationScript;
  };
  leveragePoints: string[];
  nonSalaryNegotiables: {
    item: string;
    priority: "high" | "medium" | "low";
    script: string;
  }[];
  walkAwayNumber: number;
  emailTemplates: {
    initial: string;
    counter: string;
    final: string;
  };
}

export class SalaryNegotiatorAgent {
  private llm = getLLMService();
  private prisma = getPrismaClient();

  async prepareNegotiation(
    jobId?: string,
    offerDetails?: OfferDetails,
  ): Promise<AgentResponse<SalaryNegotiationResult>> {
    try {
      logger.header("Salary Negotiation Strategist");
      logger.info("Preparing negotiation strategy");

      let targetRole = "Software Engineer";
      let location = "Remote";
      let companyName = "Target Company";

      if (jobId) {
        const job = await this.prisma.job.findUnique({
          where: { id: jobId },
          include: { company: true },
        });
        if (job) {
          targetRole = job.title;
          location = job.location || "Remote";
          companyName = job.company?.name || "Target Company";
        }
      }

      const masterResume = await this.prisma.masterResume.findFirst({
        include: { experiences: true, skills: true },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const result = await this.generateStrategy(
        targetRole,
        location,
        companyName,
        offerDetails,
        masterResume.experiences.length,
      );

      logger.success("Negotiation strategy prepared");

      return { success: true, data: result };
    } catch (error: any) {
      logger.error("Salary negotiation preparation failed", error);
      return { success: false, error: error.message };
    }
  }

  private async generateStrategy(
    targetRole: string,
    location: string,
    companyName: string,
    offerDetails: OfferDetails | undefined,
    experienceCount: number,
  ): Promise<SalaryNegotiationResult> {
    const prompt = `You are a senior compensation consultant at Robert Half with expertise in salary negotiations for tech professionals.

## Current Situation:
- Target Role: ${targetRole}
- Location: ${location}
- Company: ${companyName}
- Years of Experience: ${experienceCount} positions

${offerDetails ? `
## Offer Received:
- Base Salary: $${offerDetails.baseSalary}
- Bonus: $${offerDetails.bonus || 0}
- Equity: $${offerDetails.equity || 0}
- Signing Bonus: $${offerDetails.signingBonus || 0}
- Remote Work: ${offerDetails.remoteWork || "Not specified"}
` : "## No offer received yet - prepare for negotiation"}

## Your Task
Create a comprehensive salary negotiation strategy with:

1. **Market Analysis**: Research-based salary range for this role/location
2. **Total Compensation Analysis**: Calculate total compensation value
3. **Scripts**: Exact words to say for:
   - Initial response to offer
   - Counter-offer
   - Handling objections ("that's above our budget", "this is non-negotiable")
   - Closing
4. **Leverage Inventory**: List your negotiation leverage points
5. **Non-Salary Negotiables**: Remote work, extra PTO, title bump, etc.
6. **Walk-Away Number**: Your minimum acceptable
7. **Email Templates**: Written follow-ups for documentation

## Output Format (Strict JSON):
{
  "marketAnalysis": {
    "role": "string",
    "location": "string",
    "salaryRange": { "low": number, "mid": number, "high": number },
    "sources": ["source1", "source2"]
  },
  "totalCompensation": {
    "base": number,
    "bonus": number,
    "equity": number,
    "signing": number,
    "benefits": number,
    "total": number
  },
  "scripts": {
    "initialResponse": {
      "scenario": "when to use",
      "script": "exact words",
      "timing": "initial|counter|closing",
      "keyPoints": ["point1", "point2"]
    },
    "counterOffer": {
      "scenario": "when to use",
      "script": "exact words",
      "timing": "initial|counter|closing",
      "keyPoints": ["point1", "point2"]
    },
    "objectionHandling": [
      {
        "objection": "that's above our budget",
        "script": "exact response"
      },
      {
        "objection": "this is non-negotiable",
        "script": "exact response"
      }
    ],
    "closing": {
      "scenario": "when to use",
      "script": "exact words",
      "timing": "initial|counter|closing",
      "keyPoints": ["point1", "point2"]
    }
  },
  "leveragePoints": ["point1", "point2"],
  "nonSalaryNegotiables": [
    {
      "item": "remote work",
      "priority": "high|medium|low",
      "script": "how to ask"
    }
  ],
  "walkAwayNumber": number,
  "emailTemplates": {
    "initial": "email text",
    "counter": "email text",
    "final": "email text"
  }
}

Return ONLY valid JSON.`;

    const response = await this.llm.complete(prompt, {
      temperature: 0.3,
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
        logger.warn("Failed to parse negotiation strategy", parseError);
      }
    }

    return this.getDefaultStrategy(targetRole, location, offerDetails);
  }

  private getDefaultStrategy(
    role: string,
    location: string,
    offer?: OfferDetails,
  ): SalaryNegotiationResult {
    const baseSalary = offer?.baseSalary || 90000;
    const bonus = offer?.bonus || 0;
    const equity = offer?.equity || 0;
    const signing = offer?.signingBonus || 0;

    return {
      marketAnalysis: {
        role,
        location,
        salaryRange: { low: 80000, mid: 100000, high: 130000 },
        sources: ["Glassdoor", "Payscale", "Robert Half", "Levels.fyi"],
      },
      totalCompensation: {
        base: baseSalary,
        bonus,
        equity,
        signing,
        benefits: 15000,
        total: baseSalary + bonus + equity + signing + 15000,
      },
      scripts: {
        initialResponse: {
          scenario: "When you receive the initial offer",
          script: "Thank you for this offer. I'm excited about the opportunity to join ${companyName}. I'd like to take a few days to review the details and discuss with my family. Can we schedule a follow-up conversation?",
          timing: "initial",
          keyPoints: ["Express gratitude", "Show enthusiasm", "Ask for time to review"],
        },
        counterOffer: {
          scenario: "When making your counter",
          script: "After reviewing the offer, I'm very interested in joining your team. Based on my research and the value I bring, I'd like to discuss a base salary of $X. This reflects my experience and market rates for this role.",
          timing: "counter",
          keyPoints: ["State desired number", "Justify with market data", "Emphasize value"],
        },
        objectionHandling: [
          {
            objection: "that's above our budget",
            script: "I understand budget constraints. Perhaps we could explore other components of the package, such as signing bonus, equity, or additional PTO to bridge that gap.",
          },
          {
            objection: "this is non-negotiable",
            script: "I appreciate your transparency. If salary is fixed, I'd love to discuss other areas where we might find flexibility - particularly remote work arrangements or a performance-based signing bonus.",
          },
        ],
        closing: {
          scenario: "When reaching agreement",
          script: "I'm glad we could find common ground. I'm excited to officially accept and look forward to contributing to the team's success. What's the next step?",
          timing: "closing",
          keyPoints: ["Express excitement", "Confirm next steps", "Get agreement in writing"],
        },
      },
      leveragePoints: [
        "Multiple competing offers",
        "In-demand technical skills",
        "Unique experience from career transition",
        "Proven project delivery track record",
      ],
      nonSalaryNegotiables: [
        {
          item: "Remote Work",
          priority: "high",
          script: "Flexibility on remote work is important to me. What's the company's stance on remote or hybrid arrangements?",
        },
        {
          item: "Additional PTO",
          priority: "medium",
          script: "Beyond salary, additional PTO would be valuable. What's the company's policy on extra vacation days?",
        },
        {
          item: "Title",
          priority: "medium",
          script: "Would the title Senior Software Engineer better reflect the scope of this role?",
        },
      ],
      walkAwayNumber: baseSalary * 0.9,
      emailTemplates: {
        initial: `Dear [Hiring Manager],\n\nThank you for extending this offer. I'm excited about the opportunity to join [Company].\n\nI'd like to request a few days to review the details thoroughly. Can we schedule a follow-up conversation?\n\nBest regards`,
        counter: `Dear [Hiring Manager],\n\nThank you for the detailed offer. After careful consideration, I'm very interested in joining [Company].\n\nBased on my research and my experience, I'd like to discuss [specific adjustments]. I'm confident this reflects my value and the market rates.\n\nI look forward to our conversation.\n\nBest regards`,
        final: `Dear [Hiring Manager],\n\nI'm pleased to accept the offer. Thank you for working with me on this.\n\nI'm excited to contribute to the team and look forward to starting on [start date].\n\nBest regards`,
      },
    };
  }
}

let salaryNegotiatorAgent: SalaryNegotiatorAgent | null = null;

export function getSalaryNegotiatorAgent(): SalaryNegotiatorAgent {
  if (!salaryNegotiatorAgent) {
    salaryNegotiatorAgent = new SalaryNegotiatorAgent();
  }
  return salaryNegotiatorAgent;
}

export default getSalaryNegotiatorAgent;
