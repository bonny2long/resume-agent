import fs from "fs";
import path from "path";
import { logger } from "./logger";

export interface VoiceProfile {
  fullProfile: string;
  forbiddenPhrases: string[];
  writingExamples: {
    resumeSummary: string;
    projectDescription: string;
    achievement: string;
  };
  uniqueValueProps: string[];
}

export class VoiceLoader {
  private static voiceProfile: VoiceProfile | null = null;
  private static basePath = path.join(process.cwd(), "data", "resumes");

  static async loadVoiceProfile(): Promise<VoiceProfile> {
    if (this.voiceProfile) return this.voiceProfile;

    try {
      const profilePath = path.join(this.basePath, "voice-profile.md");

      if (!fs.existsSync(profilePath)) {
        logger.warn("Voice profile not found, using defaults");
        return this.getDefaultProfile();
      }

      const content = fs.readFileSync(profilePath, "utf-8");

      this.voiceProfile = {
        fullProfile: content,
        forbiddenPhrases: this.extractForbiddenPhrases(content),
        writingExamples: this.extractWritingExamples(content),
        uniqueValueProps: this.extractUniqueValueProps(content),
      };

      logger.debug("Voice profile loaded successfully");
      return this.voiceProfile;
    } catch (error: any) {
      logger.error("Failed to load voice profile", error);
      return this.getDefaultProfile();
    }
  }

  static async getVoiceGuidance(): Promise<string> {
    const profile = await this.loadVoiceProfile();

    return `CRITICAL: Write in Bonny's authentic voice.

${profile.fullProfile.substring(0, 2000)}

FORBIDDEN PHRASES (NEVER USE):
${profile.forbiddenPhrases.join(", ")}

WRITING STYLE:
- Direct and specific (never vague)
- Use actual numbers, not "multiple" or "various"
- Start with action verbs in achievements
- Reference real projects: SyncUp, Chef BonBon, United Airlines AI
- Use trades analogies when explaining technical concepts
- Confident but factual - if you can't prove it, don't say it

PROJECT STATUS (CRITICAL - Never describe in-progress projects as complete!):
- SyncUp: IN PROGRESS - Currently building, NOT complete. Use phrases like "building", "developing", "working on" - NEVER "built", "created", "developed"
- Chef BonBon: COMPLETE (100+ active users) - Can use "built", "created"
- United Airlines AI: COMPLETE (70% reduction in analysis time) - Can use "built", "created", "delivered"
`;
  }

  static async getForbiddenPhrases(): Promise<string[]> {
    const profile = await this.loadVoiceProfile();
    return profile.forbiddenPhrases;
  }

  static async getProjectDescriptions(): Promise<{
    syncup: string;
    chefBonbon: string;
    unitedAirlines: string;
  }> {
    return {
      syncup:
        "SyncUp (in progress): Collaboration platform with React, Node.js, PostgreSQL. Handles 500+ concurrent users with role-based access control.",
      chefBonbon:
        "Chef BonBon (complete): AI recipe platform serving 100+ active users. 85% improvement in recipe quality through structured prompt templates.",
      unitedAirlines:
        "United Airlines AI Insights (complete): 70% reduction in analysis time (2 hours → 30 minutes). Processed 10,000+ reviews through custom LLM pipelines.",
    };
  }

  private static extractForbiddenPhrases(content: string): string[] {
    const forbiddenSection = content.match(
      /## Forbidden Corporate Speak\s+([\s\S]*?)(?=##|$)/,
    );

    if (forbiddenSection) {
      const phrases: string[] = [];
      const lines = forbiddenSection[1].split("\n");

      lines.forEach((line) => {
        const match = line.match(/^[-*]\s*["']?(.*?)["']?\s*$/);
        if (match && match[1].trim()) {
          phrases.push(match[1].trim().toLowerCase());
        }
      });

      return phrases;
    }

    return [
      "proven track record",
      "results-oriented",
      "strategic thinker",
      "extensive experience",
      "dynamic professional",
      "leverage",
      "synergize",
      "spearhead",
      "revolutionize",
    ];
  }

  private static extractWritingExamples(_content: string): {
    resumeSummary: string;
    projectDescription: string;
    achievement: string;
  } {
    return {
      resumeSummary:
        "I spent 6 years troubleshooting electrical systems and managing $500K+ insulation projects. That taught me systematic problem-solving and attention to detail - skills that translate directly to debugging complex software systems.",
      projectDescription:
        "Built SyncUp using React and Node.js - a collaboration platform that handles 500+ concurrent users. Designed role-based access control from scratch, thinking about security the same way I'd secure a building: multiple layers, clear access points, audit trails.",
      achievement:
        "Created an AI-powered feedback analysis platform that cut analysis time from 2 hours to 30 minutes - a 70% reduction. Processed 10,000+ customer reviews through custom LLM pipelines.",
    };
  }

  private static extractUniqueValueProps(_content: string): string[] {
    return [
      "Bridges physical and digital systems - understands how software impacts real-world operations",
      "Thinks about failure points and builds in safeguards (electrical work background)",
      "Optimizes for real-world constraints: cost, resources, human workflow",
      "Brings project management experience from $500K+ construction projects",
      "Systematic troubleshooting approach from 6+ years in trades",
    ];
  }

  private static getDefaultProfile(): VoiceProfile {
    return {
      fullProfile:
        "Write naturally and conversationally. Avoid corporate buzzwords. Be specific with numbers.",
      forbiddenPhrases: [
        "proven track record",
        "results-oriented",
        "extensive experience",
        "leverage",
        "synergize",
      ],
      writingExamples: {
        resumeSummary:
          "Direct, specific, with actual metrics and project names.",
        projectDescription:
          "Built X using Y technology that achieved Z result with specific numbers.",
        achievement: "Action verb, specific result, measurable metric.",
      },
      uniqueValueProps: [
        "Trades background brings different perspective to software",
        "Systematic problem-solving from electrical work",
      ],
    };
  }
}

export default VoiceLoader;
