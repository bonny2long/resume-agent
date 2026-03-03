// src/utils/story-loader.ts
import fs from "fs";
import path from "path";
import { logger } from "./logger";

export interface AchievementStory {
  project: string;
  role: string;
  timeline: string;
  status: string;
  quantifiableAchievements: Array<{description: string, metric?: string}>;
  technicalAchievements: Array<{description: string}>;
  keyImpact: string;
}

export interface TransitionStory {
  motivation: string;
  turningPoint: string;
  uniqueValue: string;
  transferableSkills: Array<{trade: string, tech: string}>;
}

export class StoryLoader {
  private static instance: StoryLoader;
  private storyCache = new Map<string, any>();

  static getInstance(): StoryLoader {
    if (!StoryLoader.instance) {
      StoryLoader.instance = new StoryLoader();
    }
    return StoryLoader.instance;
  }

  /**
   * Load career transition story
   */
  async loadTransitionStory(): Promise<TransitionStory> {
    const cacheKey = "transition-story";
    if (this.storyCache.has(cacheKey)) {
      return this.storyCache.get(cacheKey);
    }

    try {
      const stories: TransitionStory = {
        motivation: "",
        turningPoint: "",
        uniqueValue: "",
        transferableSkills: []
      };

      // Load why I switched
      const whyPath = path.join(process.cwd(), "data", "resumes", "transition-highlights", "why-i-switched.md");
      if (fs.existsSync(whyPath)) {
        const content = fs.readFileSync(whyPath, "utf-8");
        
        const realization = content.match(/## The Realization\s*\n([\s\S]*?)(?=\n##|$)/);
        if (realization) {
          stories.motivation = this.cleanText(realization[1]);
        }

        const turningPoint = content.match(/## The Turning Point\s*\n([\s\S]*?)(?=\n##|$)/);
        if (turningPoint) {
          stories.turningPoint = this.cleanText(turningPoint[1]);
        }
      }

      // Load unique value proposition
      const valuePath = path.join(process.cwd(), "data", "resumes", "transition-highlights", "unique-value-prop.md");
      if (fs.existsSync(valuePath)) {
        const content = fs.readFileSync(valuePath, "utf-8");
        
        const competitive = content.match(/## What I Offer That Others Don't\s*\n([\s\S]*?)(?=\n##|$)/);
        if (competitive) {
          stories.uniqueValue = this.cleanText(competitive[1]);
        }
      }

      // Load transferable skills
      const skillsPath = path.join(process.cwd(), "data", "resumes", "transition-highlights", "transferable-skills.md");
      if (fs.existsSync(skillsPath)) {
        const content = fs.readFileSync(skillsPath, "utf-8");
        
        const skillsTable = content.match(/\|[\s\S]*?\|/g);
        if (skillsTable) {
          stories.transferableSkills = skillsTable.slice(1).map(row => {
            const cols = row.split('|').map(col => col.trim());
            return {
              trade: cols[1] || "",
              tech: cols[2] || ""
            };
          }).filter(skill => skill.trade && skill.tech);
        }
      }

      this.storyCache.set(cacheKey, stories);
      return stories;
    } catch (error) {
      logger.warn("Could not load transition story", error);
      return {
        motivation: "Career transitioner with systematic problem-solving background",
        turningPoint: "Discovered passion for solving problems at scale through technology",
        uniqueValue: "Unique perspective combining physical and digital systems understanding",
        transferableSkills: []
      };
    }
  }

  /**
   * Load specific achievement story by project name
   */
  async loadAchievementStory(projectName: string): Promise<AchievementStory | null> {
    const cacheKey = `achievement-${projectName}`;
    if (this.storyCache.has(cacheKey)) {
      return this.storyCache.get(cacheKey);
    }

    try {
      const projectFileMap: { [key: string]: string } = {
        'united-airlines': 'united-airlines-ai-insights.md',
        'syncup': 'syncup-platform.md',
        'chef-bonbon': 'chef-bonbon.md',
        'chefbonbon': 'chef-bonbon.md',
      };

      const fileName = projectFileMap[projectName.toLowerCase()];
      if (!fileName) return null;

      const filePath = path.join(process.cwd(), "data", "resumes", "achievement-stories", fileName);
      if (!fs.existsSync(filePath)) return null;

      const content = fs.readFileSync(filePath, "utf-8");
      
      const story: AchievementStory = {
        project: this.extractField(content, "Project Name") || projectName,
        role: this.extractField(content, "Role") || "Developer",
        timeline: this.extractField(content, "Timeline") || "",
        status: this.extractField(content, "Status") || "Completed",
        quantifiableAchievements: [],
        technicalAchievements: [],
        keyImpact: ""
      };

      // Extract quantifiable achievements
      const quantSection = content.match(/## Quantifiable Achievements\s*\n([\s\S]*?)(?=\n##|$)/);
      if (quantSection) {
        const lines = quantSection[1].split('\n').filter(line => line.trim());
        story.quantifiableAchievements = lines.map(line => {
          const clean = line.replace(/^[-•]\s*/, '').trim();
          // Extract metrics (numbers, percentages)
          const metricMatch = clean.match(/\d+%|\d+ users|\d+ reduction|\d+ improvement|\d+ seconds|\d+ minutes/i);
          return {
            description: clean,
            metric: metricMatch ? metricMatch[0] : undefined
          };
        });
      }

      // Extract technical achievements
      const techSection = content.match(/## Technical Achievements\s*\n([\s\S]*?)(?=\n##|$)/);
      if (techSection) {
        const lines = techSection[1].split('\n').filter(line => line.trim());
        story.technicalAchievements = lines.map(line => ({
          description: line.replace(/^[-•]\s*/, '').trim()
        }));
      }

      // Extract key impact
      const impactSection = content.match(/## Impact on Career\s*\n([\s\S]*?)(?=\n##|$)/);
      if (impactSection) {
        story.keyImpact = this.cleanText(impactSection[1]);
      }

      this.storyCache.set(cacheKey, story);
      return story;
    } catch (error) {
      logger.warn(`Could not load achievement story for ${projectName}`, error);
      return null;
    }
  }

  /**
   * Get all achievement stories
   */
  async getAllAchievementStories(): Promise<AchievementStory[]> {
    const projects = ['united-airlines', 'chef-bonbon', 'syncup'];
    const stories: AchievementStory[] = [];
    
    for (const project of projects) {
      const story = await this.loadAchievementStory(project);
      if (story) {
        stories.push(story);
      }
    }
    
    return stories;
  }

  /**
   * Get concise career story for LinkedIn/short formats
   */
  async getConciseCareerStory(): Promise<string> {
    const story = await this.loadTransitionStory();
    return story.motivation || story.uniqueValue || 
      "Career transitioner bringing systematic problem-solving from trades to software engineering";
  }

  /**
   * Get detailed career story for cover letters
   */
  async getDetailedCareerStory(): Promise<string> {
    const story = await this.loadTransitionStory();
    return `${story.motivation} ${story.turningPoint} ${story.uniqueValue}`.trim();
  }

  /**
   * Get unified story context - consistent data for all agents
   * Returns all story elements in a structured format
   */
  async getUnifiedStoryContext(): Promise<{
    motivation: string;
    turningPoint: string;
    uniqueValue: string;
    skills: Array<{ trade: string; tech: string }>;
    conciseStory: string;
    detailedStory: string;
  }> {
    const story = await this.loadTransitionStory();
    
    return {
      motivation: story.motivation,
      turningPoint: story.turningPoint,
      uniqueValue: story.uniqueValue,
      skills: story.transferableSkills,
      conciseStory: story.motivation || story.uniqueValue || 
        "Career transitioner bringing systematic problem-solving from trades to software engineering",
      detailedStory: `${story.motivation} ${story.turningPoint} ${story.uniqueValue}`.trim(),
    };
  }

  /**
   * Extract field from markdown content
   */
  private extractField(content: string, fieldName: string): string | null {
    const regex = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*([^\n]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Clean text by removing markdown and extra whitespace
   */
  private cleanText(text: string): string {
    return text
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-'))
      .map(line => line.replace(/^[-•]\s*/, '').trim())
      .join(' ')
      .substring(0, 500);
  }

  /**
   * Clear cache (useful for development)
   */
  clearCache(): void {
    this.storyCache.clear();
  }
}

export default StoryLoader.getInstance();