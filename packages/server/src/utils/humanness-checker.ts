import { VoiceLoader } from "./voice-loader";
import { logger } from "./logger";

export interface HumannessCheckResult {
  isHuman: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  passedChecks: string[];
}

export class HumannessChecker {
  private static forbiddenPhrases: string[] = [];

  private static aiTellPhrases = [
    "cutting-edge",
    "industry-leading",
    "best-in-class",
    "world-class",
    "groundbreaking",
    "revolutionary",
    "transformative",
    "game-changing",
    "paradigm shift",
    "synergy",
    "actionable insights",
    "core competencies",
    "value-added",
    "low-hanging fruit",
  ];

  private static vagueQuantifiers = [
    "numerous",
    "various",
    "multiple",
    "several",
    "many",
    "extensive",
    "significant",
  ];

  static async checkText(text: string): Promise<HumannessCheckResult> {
    if (this.forbiddenPhrases.length === 0) {
      this.forbiddenPhrases = await VoiceLoader.getForbiddenPhrases();
    }

    const issues: string[] = [];
    const passedChecks: string[] = [];
    let score = 100;

    const forbiddenFound = this.checkForbiddenPhrases(text);
    if (forbiddenFound.length > 0) {
      forbiddenFound.forEach((phrase) => {
        issues.push(`CRITICAL: Contains forbidden phrase "${phrase}"`);
        score -= 20;
      });
    } else {
      passedChecks.push("No forbidden phrases detected");
    }

    const aiTells = this.checkAITells(text);
    if (aiTells.length > 0) {
      aiTells.forEach((phrase) => {
        issues.push(`AI tell detected: "${phrase}"`);
        score -= 10;
      });
    } else {
      passedChecks.push("No AI tell phrases");
    }

    const vague = this.checkVagueQuantifiers(text);
    if (vague.count > 2) {
      issues.push(
        `Too many vague quantifiers (${vague.count}: ${vague.phrases.join(", ")})`,
      );
      score -= 15;
    } else if (vague.count === 0) {
      passedChecks.push("No vague quantifiers - uses specific numbers");
    }

    const metrics = this.checkForMetrics(text);
    if (metrics.count >= 2) {
      passedChecks.push(
        `Contains ${metrics.count} specific metrics (${metrics.examples.join(", ")})`,
      );
      score += 15;
    } else if (metrics.count === 0) {
      issues.push("No specific metrics found - should include numbers");
      score -= 10;
    }

    const passive = this.checkPassiveVoice(text);
    if (passive.count > 5) {
      issues.push(`Too much passive voice (${passive.count} instances)`);
      score -= 10;
    } else if (passive.count <= 2) {
      passedChecks.push("Minimal passive voice - mostly active");
    }

    const adjectives = this.checkAdjectiveOverload(text);
    if (adjectives.count > 4) {
      issues.push(
        `Too many intensifiers (${adjectives.count}: ${adjectives.examples.join(", ")})`,
      );
      score -= 10;
    } else {
      passedChecks.push("Appropriate use of intensifiers");
    }

    const projects = this.checkProjectMentions(text);
    if (projects.length > 0) {
      passedChecks.push(`Mentions specific projects: ${projects.join(", ")}`);
      score += 10;
    }

    const tradesAnalogies = this.checkTradesAnalogies(text);
    if (tradesAnalogies.found) {
      passedChecks.push("Uses trades analogy to explain concept");
      score += 10;
    }

    const sentences = this.checkSentenceVariety(text);
    if (sentences.varietyScore < 0.3) {
      issues.push("Sentences too similar in structure - sounds robotic");
      score -= 5;
    } else {
      passedChecks.push("Good sentence variety");
    }

    score = Math.max(0, Math.min(100, score));

    const suggestions = this.generateSuggestions(issues);

    return {
      isHuman: score >= 70,
      score,
      issues,
      suggestions,
      passedChecks,
    };
  }

  private static checkForbiddenPhrases(text: string): string[] {
    const found: string[] = [];
    const textLower = text.toLowerCase();

    this.forbiddenPhrases.forEach((phrase) => {
      if (textLower.includes(phrase.toLowerCase())) {
        found.push(phrase);
      }
    });

    return found;
  }

  private static checkAITells(text: string): string[] {
    const found: string[] = [];
    const textLower = text.toLowerCase();

    this.aiTellPhrases.forEach((phrase) => {
      if (textLower.includes(phrase.toLowerCase())) {
        found.push(phrase);
      }
    });

    return found;
  }

  private static checkVagueQuantifiers(text: string): {
    count: number;
    phrases: string[];
  } {
    const found: string[] = [];
    const textLower = text.toLowerCase();

    this.vagueQuantifiers.forEach((word) => {
      const matches = textLower.match(new RegExp(`\\b${word}\\b`, "g"));
      if (matches && matches.length > 0) {
        found.push(`${word} (${matches.length}x)`);
      }
    });

    return { count: found.length, phrases: found };
  }

  private static checkForMetrics(text: string): {
    count: number;
    examples: string[];
  } {
    const metricPatterns = [
      /\d+\+?\s*(users?|people|developers?|customers?)/gi,
      /\d+%/g,
      /\$\d+[KMB]?/g,
      /\d+x\s*(?:faster|slower|more|less)/gi,
      /\d+(?:\.\d+)?\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)/gi,
    ];

    const examples: string[] = [];

    metricPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        examples.push(...matches.slice(0, 3));
      }
    });

    return {
      count: examples.length,
      examples: [...new Set(examples)].slice(0, 5),
    };
  }

  private static checkPassiveVoice(text: string): {
    count: number;
    examples: string[];
  } {
    const passivePattern = /(was|were|been|being)\s+\w+ed/gi;
    const matches = text.match(passivePattern) || [];

    return {
      count: matches.length,
      examples: [...new Set(matches)].slice(0, 5),
    };
  }

  private static checkAdjectiveOverload(text: string): {
    count: number;
    examples: string[];
  } {
    const intensifiers = [
      "highly",
      "extremely",
      "very",
      "incredibly",
      "exceptionally",
      "significantly",
      "substantially",
      "considerably",
    ];

    const found: string[] = [];

    intensifiers.forEach((word) => {
      const pattern = new RegExp(`\\b${word}\\s+\\w+`, "gi");
      const matches = text.match(pattern);
      if (matches) {
        found.push(...matches);
      }
    });

    return {
      count: found.length,
      examples: [...new Set(found)].slice(0, 5),
    };
  }

  private static checkProjectMentions(text: string): string[] {
    const projects = [
      "SyncUp",
      "Chef BonBon",
      "United Airlines",
      "AI Insights",
    ];
    const found: string[] = [];

    projects.forEach((project) => {
      if (text.includes(project)) {
        found.push(project);
      }
    });

    return found;
  }

  private static checkTradesAnalogies(text: string): {
    found: boolean;
    examples: string[];
  } {
    const tradeKeywords = [
      "electrical",
      "building",
      "securing a building",
      "warehouse",
      "construction",
      "trades",
      "insulation",
      "wiring",
      "troubleshooting",
    ];

    const examples: string[] = [];
    const textLower = text.toLowerCase();

    tradeKeywords.forEach((keyword) => {
      if (textLower.includes(keyword.toLowerCase())) {
        examples.push(keyword);
      }
    });

    return { found: examples.length > 0, examples };
  }

  private static checkSentenceVariety(text: string): { varietyScore: number } {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    if (sentences.length < 3) return { varietyScore: 1 };

    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
      lengths.length;
    const stdDev = Math.sqrt(variance);

    const varietyScore = Math.min(1, stdDev / avgLength);

    return { varietyScore };
  }

  private static generateSuggestions(issues: string[]): string[] {
    const suggestions: string[] = [];

    if (issues.some((i) => i.includes("forbidden phrase"))) {
      suggestions.push(
        "CRITICAL: Remove all corporate buzzwords. Use specific examples instead.",
      );
    }

    if (issues.some((i) => i.includes("AI tell"))) {
      suggestions.push(
        "Replace AI-sounding phrases with concrete examples and metrics",
      );
    }

    if (issues.some((i) => i.includes("vague quantifiers"))) {
      suggestions.push(
        'Replace "multiple/various/several" with actual numbers',
      );
    }

    if (issues.some((i) => i.includes("No specific metrics"))) {
      suggestions.push(
        'Add specific metrics: "500+ users", "70% reduction", "$500K project"',
      );
    }

    if (issues.some((i) => i.includes("passive voice"))) {
      suggestions.push('Use active voice: "I built X" not "X was built"');
    }

    if (issues.some((i) => i.includes("intensifiers"))) {
      suggestions.push(
        'Remove intensifiers like "highly/extremely" - let facts speak for themselves',
      );
    }

    return suggestions;
  }

  static async quickValidate(text: string): Promise<boolean> {
    const result = await this.checkText(text);

    if (!result.isHuman) {
      logger.warn("Humanness check failed", {
        score: result.score,
        issues: result.issues,
      });
    }

    return result.isHuman;
  }

  static logResults(result: HumannessCheckResult): void {
    logger.header("Humanness Check Results");

    console.log(
      `\nScore: ${result.score}/100 ${result.isHuman ? "PASSED" : "FAILED"}`,
    );
    console.log(
      `Status: ${result.isHuman ? "PASSED (sounds human)" : "FAILED (sounds like AI)"}\n`,
    );

    if (result.passedChecks.length > 0) {
      console.log("Passed Checks:");
      result.passedChecks.forEach((check) => console.log(`  ${check}`));
      console.log();
    }

    if (result.issues.length > 0) {
      console.log("Issues Found:");
      result.issues.forEach((issue) => console.log(`  ${issue}`));
      console.log();
    }

    if (result.suggestions.length > 0) {
      console.log("Suggestions:");
      result.suggestions.forEach((suggestion) =>
        console.log(`  ${suggestion}`),
      );
      console.log();
    }
  }
}

export default HumannessChecker;
