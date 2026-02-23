// src/services/interview-export.service.ts
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from "docx";
import fs from "fs";
import path from "path";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";
import { STARStory } from "@/agents/interview/behavioral-coach.agent";

export class InterviewExportService {
  private prisma = getPrismaClient();

  async exportStoriesToPDF(targetRole?: string): Promise<{ success: boolean; filepath?: string; error?: string }> {
    try {
      const masterResume = await this.prisma.masterResume.findFirst();
      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const stories = await this.prisma.sTARStory.findMany({
        where: { resumeId: masterResume.id },
        orderBy: [{ category: "asc" }, { createdAt: "desc" }],
      });

      if (stories.length === 0) {
        // Generate new stories if none exist
        const { getBehavioralCoachAgent } = await import("@/agents/interview/behavioral-coach.agent");
        const agent = getBehavioralCoachAgent();
        const result = await agent.generateStoryBank(targetRole);

        if (!result.success || !result.data) {
          throw new Error("Failed to generate stories");
        }

        return this.createPDF(result.data.stories, masterResume.fullName, targetRole);
      }

      return this.createPDF(stories as unknown as STARStory[], masterResume.fullName, targetRole);
    } catch (error: any) {
      logger.error("Failed to export interview stories", error);
      return { success: false, error: error.message };
    }
  }

  private async createPDF(stories: STARStory[], candidateName: string, targetRole?: string): Promise<{ success: boolean; filepath?: string; error?: string }> {
    try {
      const outputDir = path.join(process.cwd(), "data", "outputs");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `interview-stories_${targetRole?.replace(/\s+/g, "-") || "general"}_${timestamp}.docx`;
      const filepath = path.join(outputDir, filename);

      // Group stories by category
      const categories = ["leadership", "conflict", "failure", "innovation", "collaboration", "pressure", "customer", "growth"];
      const storiesByCategory = categories.reduce((acc, cat) => {
        acc[cat] = stories.filter(s => s.category === cat);
        return acc;
      }, {} as Record<string, STARStory[]>);

      // Build document children
      const children: any[] = [];

      // Title
      children.push(
        new Paragraph({
          text: "Behavioral Interview Prep",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      // Candidate name and target role
      children.push(
        new Paragraph({
          text: candidateName,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        })
      );

      if (targetRole) {
        children.push(
          new Paragraph({
            text: `Target Role: ${targetRole}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          })
        );
      }

      // Delivery Tips
      children.push(
        new Paragraph({
          text: "Interview Tips",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: "• Keep stories to 2-3 minutes maximum",
          spacing: { after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "• Focus 60% on Action, 30% on Result, 10% on Situation/Task",
          spacing: { after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "• Use 'I' not 'we' to highlight your personal contribution",
          spacing: { after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "• Include specific metrics and quantifiable results",
          spacing: { after: 400 },
        })
      );

      // Stories by category
      for (const category of categories) {
        const categoryStories = storiesByCategory[category];
        if (!categoryStories || categoryStories.length === 0) continue;

        const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

        children.push(
          new Paragraph({
            text: `${categoryLabel} Stories`,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        for (const story of categoryStories) {
          // Story title
          children.push(
            new Paragraph({
              text: story.title,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            })
          );

          // STAR format
          children.push(
            new Paragraph({
              text: "Situation:",
              spacing: { after: 50 },
            })
          );
          children.push(
            new Paragraph({
              text: story.situation,
              spacing: { after: 150 },
            })
          );

          children.push(
            new Paragraph({
              text: "Task:",
              spacing: { after: 50 },
            })
          );
          children.push(
            new Paragraph({
              text: story.task,
              spacing: { after: 150 },
            })
          );

          children.push(
            new Paragraph({
              text: "Action:",
              spacing: { after: 50 },
            })
          );
          children.push(
            new Paragraph({
              text: story.action,
              spacing: { after: 150 },
            })
          );

          children.push(
            new Paragraph({
              text: "Result:",
              spacing: { after: 50 },
            })
          );
          children.push(
            new Paragraph({
              text: story.result,
              spacing: { after: 150 },
            })
          );

          if (story.metrics) {
            children.push(
              new Paragraph({
                text: `Metrics: ${story.metrics}`,
                spacing: { after: 150 },
              })
            );
          }

          if (story.lessons) {
            children.push(
              new Paragraph({
                text: `Lesson: ${story.lessons}`,
                spacing: { after: 300 },
              })
            );
          }
        }
      }

      // Create and save document
      const doc = new Document({
        sections: [{ children }],
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filepath, buffer);

      logger.success(`Interview stories exported to ${filepath}`);

      return { success: true, filepath };
    } catch (error: any) {
      logger.error("Failed to create PDF", error);
      return { success: false, error: error.message };
    }
  }
}

let interviewExportService: InterviewExportService | null = null;

export function getInterviewExportService(): InterviewExportService {
  if (!interviewExportService) {
    interviewExportService = new InterviewExportService();
  }
  return interviewExportService;
}

export default getInterviewExportService;
