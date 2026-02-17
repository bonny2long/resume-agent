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

    return `CRITICAL: Write in Bonny's authentic voice - MATCH THIS EXACT STYLE from their actual resume:

"PROFESSIONAL SUMMARY
I spent over six years in the trades, first as an Electrical Technician and then as a Heat & Frost Insulator. I was good at it – troubleshooting complex electrical systems, managing insulation projects worth millions, and leading crews. But I kept hitting a wall, thinking about how much more I could do if I could solve problems for thousands of people, not just one building at a time. That's what pushed me into software.
I've been building things that work. Right now, I'm working on SyncUp, a collaboration platform where I'm developing the role-based access control from the ground up, making sure it's as secure as any physical system I've ever worked on, with clear access points and audit trails. Before that, I built Chef BonBon, which is now used by over 100 people, and I delivered the United Airlines AI project, cutting their analysis time by 70%.
What I bring to [COMPANY] is a hands-on approach to building scalable, secure web applications. I'm proficient in JavaScript, React, and Node.js, and I've designed and developed RESTful APIs, including work with API design patterns. My experience with databases like Supabase and PostgreSQL, and my understanding of how to integrate AI/LLMs, means I can jump into developing fullstack AI-driven applications, ensuring seamless data flow and privacy-first architectures, much like I'd ensure a system was built right the first time."

FORBIDDEN PHRASES (NEVER USE):
${profile.forbiddenPhrases.join(", ")}

WRITING STYLE:
- Direct and specific (never vague) - use actual numbers and project names
- Start with "I" - first person, personal voice
- Reference real projects: SyncUp (IN PROGRESS), Chef BonBon (100+ users), United Airlines AI (70% reduction)
- Use trades analogies when explaining technical concepts
- Confident but factual - if you can't prove it, don't say it
- Keep it to 3 short paragraphs, not wall-of-text
- Sentences should be varied in length - mix short punchy with longer explanatory

PROJECT STATUS (CRITICAL):
- SyncUp: IN PROGRESS - Currently building, NOT complete. Use phrases like "building", "developing", "working on"
- Chef BonBon: COMPLETE (100+ active users) - Can use "built", "created"
- United Airlines AI: COMPLETE (70% reduction in analysis time) - Can use "built", "created", "delivered"`;
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
