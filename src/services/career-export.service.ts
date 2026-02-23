// src/services/career-export.service.ts
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from "docx";
import fs from "fs";
import path from "path";
import { logger } from "@/utils/logger";
import getPrismaClient from "@/database/client";

export class CareerExportService {
  private prisma = getPrismaClient();

  async exportSalaryNegotiation(): Promise<{ success: boolean; filepath?: string; error?: string }> {
    try {
      const masterResume = await this.prisma.masterResume.findFirst();
      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const job = await this.prisma.job.findFirst({
        include: { company: true },
        orderBy: { createdAt: "desc" },
      });

      const outputDir = path.join(process.cwd(), "data", "outputs");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `salary-negotiation_${timestamp}.docx`;
      const filepath = path.join(outputDir, filename);

      const children: any[] = [];

      children.push(
        new Paragraph({
          text: "Salary Negotiation Playbook",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: `Prepared for: ${masterResume.fullName}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      if (job) {
        children.push(
          new Paragraph({
            text: `Target Role: ${job.title}`,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          })
        );
      }

      children.push(
        new Paragraph({
          text: "Scripts & Conversation Starters",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: "Initial Response to Offer:",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "Thank you for this offer. I'm excited about the opportunity to join the team. I'd like to take a few days to review the details with my family. Can we schedule a follow-up conversation?",
          spacing: { after: 300 },
        })
      );

      children.push(
        new Paragraph({
          text: "Making a Counter Offer:",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "After reviewing the offer, I'm very interested in joining your team. Based on my research and the value I bring, I'd like to discuss a base salary of [your target]. This reflects my experience and market rates for this role.",
          spacing: { after: 300 },
        })
      );

      children.push(
        new Paragraph({
          text: "Handling Objections",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: "Objection: 'That's above our budget'",
          spacing: { after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "I understand budget constraints. Perhaps we could explore other components of the package, such as signing bonus, equity, or additional PTO to bridge that gap.",
          spacing: { after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: "Objection: 'This is non-negotiable'",
          spacing: { after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "I appreciate your transparency. If salary is fixed, I'd love to discuss other areas where we might find flexibility - particularly remote work arrangements or a performance-based signing bonus.",
          spacing: { after: 300 },
        })
      );

      children.push(
        new Paragraph({
          text: "Non-Salary Negotiables to Consider",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      const negotiables = [
        { item: "Remote Work", priority: "High", ask: "Is there flexibility on remote or hybrid arrangements?" },
        { item: "Additional PTO", priority: "Medium", ask: "What's the policy on extra vacation days?" },
        { item: "Title", priority: "Medium", ask: "Would [Senior] title better reflect the scope of this role?" },
        { item: "Signing Bonus", priority: "High", ask: "Would a signing bonus be possible?" },
        { item: "Start Date", priority: "Low", ask: "Is there flexibility on the start date?" },
      ];

      for (const neg of negotiables) {
        children.push(
          new Paragraph({
            text: `${neg.item} (${neg.priority} priority)`,
            spacing: { after: 50 },
          })
        );
        children.push(
          new Paragraph({
            text: neg.ask,
            spacing: { after: 200 },
          })
        );
      }

      children.push(
        new Paragraph({
          text: "Email Templates",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: "Initial Follow-up:",
          spacing: { after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "Dear [Hiring Manager],\n\nThank you for extending this offer. I'm excited about the opportunity to join [Company]. I'd like to request a few days to review the details thoroughly. Can we schedule a follow-up conversation?\n\nBest regards",
          spacing: { after: 300 },
        })
      );

      children.push(
        new Paragraph({
          text: "Counter Offer:",
          spacing: { after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: "Dear [Hiring Manager],\n\nThank you for the detailed offer. After careful consideration, I'm very interested in joining [Company]. Based on my research and my experience, I'd like to discuss [specific adjustments]. I'm confident this reflects my value and the market rates.\n\nI look forward to our conversation.\n\nBest regards",
          spacing: { after: 300 },
        })
      );

      const doc = new Document({
        sections: [{ children }],
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filepath, buffer);

      logger.success(`Salary negotiation exported to ${filepath}`);
      return { success: true, filepath };
    } catch (error: any) {
      logger.error("Failed to export salary negotiation", error);
      return { success: false, error: error.message };
    }
  }

  async exportCareerPivot(): Promise<{ success: boolean; filepath?: string; error?: string }> {
    try {
      const masterResume = await this.prisma.masterResume.findFirst({
        include: { experiences: true },
      });

      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const outputDir = path.join(process.cwd(), "data", "outputs");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `career-pivot-plan_${timestamp}.docx`;
      const filepath = path.join(outputDir, filename);

      const children: any[] = [];

      children.push(
        new Paragraph({
          text: "Career Pivot Strategy",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: `Prepared for: ${masterResume.fullName}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      children.push(
        new Paragraph({
          text: "Your Pivot Narrative",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: "Hook:",
          spacing: { after: 50 },
        })
      );
      children.push(
        new Paragraph({
          text: "I bring a builder's mindset from the trades to software engineering.",
          spacing: { after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: "Story:",
          spacing: { after: 50 },
        })
      );
      children.push(
        new Paragraph({
          text: "After 6 years as an electrical technician, I realized code could solve problems for thousands, not just one building at a time. Now I apply the same systematic, safety-first thinking to building software.",
          spacing: { after: 200 },
        })
      );

      children.push(
        new Paragraph({
          text: "Transferable Skills",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      const transferableSkills = [
        { skill: "Systematic Problem-Solving", relevance: "10/10", context: "Electrical troubleshooting → Software debugging" },
        { skill: "Project Management", relevance: "8/10", context: "$500K projects → Technical planning" },
        { skill: "Safety-First Thinking", relevance: "9/10", context: "Electrical safety → Code security" },
        { skill: "Technical Documentation", relevance: "8/10", context: "Schematics → Code docs" },
        { skill: "Team Leadership", relevance: "7/10", context: "Led crews → Mentor junior devs" },
      ];

      for (const s of transferableSkills) {
        children.push(
          new Paragraph({
            text: `${s.skill} (${s.relevance})`,
            spacing: { after: 50 },
          })
        );
        children.push(
          new Paragraph({
            text: s.context,
            spacing: { after: 150 },
          })
        );
      }

      children.push(
        new Paragraph({
          text: "90-Day Action Plan",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      const phases = [
        { phase: "Phase 1", weeks: "Weeks 1-4", goal: "Foundation", actions: ["Complete algorithm practice", "Build first portfolio project", "Update LinkedIn with pivot story"] },
        { phase: "Phase 2", weeks: "Weeks 5-12", goal: "Skill Building", actions: ["Complete 2 more portfolio projects", "Get AWS certification", "Start open source contributions"] },
        { phase: "Phase 3", weeks: "Weeks 13-24", goal: "Job Search", actions: ["Apply to 5+ jobs per week", "Network with 5+ people per week", "Practice technical interviews"] },
      ];

      for (const p of phases) {
        children.push(
          new Paragraph({
            text: `${p.phase}: ${p.goal} (${p.weeks})`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        for (const action of p.actions) {
          children.push(
            new Paragraph({
              text: `• ${action}`,
              spacing: { after: 50 },
            })
          );
        }
      }

      const doc = new Document({
        sections: [{ children }],
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filepath, buffer);

      logger.success(`Career pivot exported to ${filepath}`);
      return { success: true, filepath };
    } catch (error: any) {
      logger.error("Failed to export career pivot", error);
      return { success: false, error: error.message };
    }
  }
}

let careerExportService: CareerExportService | null = null;

export function getCareerExportService(): CareerExportService {
  if (!careerExportService) {
    careerExportService = new CareerExportService();
  }
  return careerExportService;
}

export default getCareerExportService;
