// src/services/document-generator.service.ts
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
} from "docx";
import fs from "fs";
import path from "path";
import { logger } from "@/utils/logger";
import { TailoredResume } from "@/agents/resume-tailor.agent";

export interface DocumentGenerationOptions {
  format: "docx" | "pdf";
  template?: "modern" | "traditional" | "minimal";
  includePhoto?: boolean;
  photoPath?: string;
}

export class DocumentGeneratorService {
  /**
   * Generate a resume document from tailored data
   */
  async generateResume(
    tailored: TailoredResume,
    options: DocumentGenerationOptions = { format: "docx", template: "modern" },
  ): Promise<{ success: boolean; filepath?: string; error?: string }> {
    try {
      logger.info("Generating resume document", {
        format: options.format,
        template: options.template,
      });

      // Generate DOCX
      const docxPath = await this.generateDOCX(tailored, options);

      if (options.format === "pdf") {
        // Convert DOCX to PDF
        const pdfPath = await this.convertToPDF(docxPath);
        return { success: true, filepath: pdfPath };
      }

      return { success: true, filepath: docxPath };
    } catch (error: any) {
      logger.error("Document generation failed", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate DOCX resume
   */
  private async generateDOCX(
    tailored: TailoredResume,
    options: DocumentGenerationOptions,
  ): Promise<string> {
    const template = options.template || "modern";

    let document: Document;
    switch (template) {
      case "traditional":
        document = this.createTraditionalTemplate(tailored);
        break;
      case "minimal":
        document = this.createMinimalTemplate(tailored);
        break;
      case "modern":
      default:
        document = this.createModernTemplate(tailored);
        break;
    }

    // Generate filename
    const timestamp = new Date().toISOString().split("T")[0];
    const sanitizedCompany = tailored.company
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    const filename = `resume_${sanitizedCompany}_${timestamp}.docx`;

    const outputDir = path.join(process.cwd(), "data", "outputs");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, filename);

    // Generate document
    const buffer = await Packer.toBuffer(document);
    fs.writeFileSync(filepath, buffer);

    logger.success(`DOCX generated: ${filename}`);
    return filepath;
  }

  /**
   * Modern template (recommended for tech roles)
   */
  private createModernTemplate(tailored: TailoredResume): Document {
    const sections: any[] = [];

    // Contact Header
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: tailored.personalInfo.fullName,
            bold: true,
            size: 32, // 16pt
            font: "Arial",
          }),
        ],
      }),
    );

    // Contact Info
    const contactParts: string[] = [];
    if (tailored.personalInfo.email)
      contactParts.push(tailored.personalInfo.email);
    if (tailored.personalInfo.phone)
      contactParts.push(tailored.personalInfo.phone);
    if (tailored.personalInfo.location)
      contactParts.push(tailored.personalInfo.location);

    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: contactParts.join(" • "),
            size: 22, // 11pt
            font: "Arial",
          }),
        ],
      }),
    );

    // Links
    if (
      tailored.personalInfo.linkedInUrl ||
      tailored.personalInfo.githubUrl ||
      tailored.personalInfo.portfolioUrl
    ) {
      const linkParts: string[] = [];
      if (tailored.personalInfo.linkedInUrl) linkParts.push("LinkedIn");
      if (tailored.personalInfo.githubUrl) linkParts.push("GitHub");
      if (tailored.personalInfo.portfolioUrl) linkParts.push("Portfolio");

      sections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: linkParts.join(" | "),
              size: 20,
              font: "Arial",
              color: "0563C1",
            }),
          ],
        }),
      );
    }

    // Professional Summary
    sections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: "PROFESSIONAL SUMMARY",
            bold: true,
            size: 26, // 13pt
            font: "Arial",
          }),
        ],
      }),
    );

    sections.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: tailored.summary,
            size: 22,
            font: "Arial",
          }),
        ],
      }),
    );

    // Technical Skills
    if (
      tailored.skills.matched.length > 0 ||
      tailored.skills.relevant.length > 0
    ) {
      sections.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: "TECHNICAL SKILLS",
              bold: true,
              size: 26,
              font: "Arial",
            }),
          ],
        }),
      );

      const allSkills = [
        ...tailored.skills.matched,
        ...tailored.skills.relevant,
      ].slice(0, 20); // Limit to top 20

      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: allSkills.join(" • "),
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );
    }

    // Experience
    if (tailored.experiences.length > 0) {
      sections.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: "PROFESSIONAL EXPERIENCE",
              bold: true,
              size: 26,
              font: "Arial",
            }),
          ],
        }),
      );

      tailored.experiences.forEach((exp, index) => {
        // Job Title & Company
        sections.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `${exp.title}`,
                bold: true,
                size: 24,
                font: "Arial",
              }),
              new TextRun({
                text: ` | ${exp.company}`,
                size: 24,
                font: "Arial",
              }),
            ],
          }),
        );

        // Location & Dates
        const startYear = exp.startDate.getFullYear();
        const startMonth = exp.startDate.toLocaleString("default", {
          month: "short",
        });
        const endDate =
          exp.current ? "Present" : (
            `${exp.endDate?.toLocaleString("default", { month: "short" })} ${exp.endDate?.getFullYear()}`
          );

        sections.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `${exp.location} | ${startMonth} ${startYear} - ${endDate}`,
                size: 22,
                font: "Arial",
                italics: true,
                color: "666666",
              }),
            ],
          }),
        );

        // Achievements (bullets)
        exp.achievements.forEach((achievement) => {
          sections.push(
            new Paragraph({
              numbering: {
                reference: "bullets",
                level: 0,
              },
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: achievement.description,
                  size: 22,
                  font: "Arial",
                }),
              ],
            }),
          );
        });

        // Add spacing between experiences
        if (index < tailored.experiences.length - 1) {
          sections.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [],
            }),
          );
        }
      });
    }

    // Projects
    if (tailored.projects.length > 0) {
      sections.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: "PROJECTS",
              bold: true,
              size: 26,
              font: "Arial",
            }),
          ],
        }),
      );

      tailored.projects.forEach((project, index) => {
        // Project Name
        sections.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: project.name,
                bold: true,
                size: 24,
                font: "Arial",
              }),
              new TextRun({
                text: project.role ? ` | ${project.role}` : "",
                size: 22,
                font: "Arial",
              }),
            ],
          }),
        );

        // Description
        sections.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: project.description,
                size: 22,
                font: "Arial",
              }),
            ],
          }),
        );

        // Technologies
        if (project.technologies.length > 0) {
          sections.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: "Technologies: ",
                  bold: true,
                  size: 22,
                  font: "Arial",
                }),
                new TextRun({
                  text: project.technologies.join(", "),
                  size: 22,
                  font: "Arial",
                  italics: true,
                }),
              ],
            }),
          );
        }

        // Add spacing between projects
        if (index < tailored.projects.length - 1) {
          sections.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [],
            }),
          );
        }
      });
    }

    // Education
    if (tailored.education.length > 0) {
      sections.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: "EDUCATION",
              bold: true,
              size: 26,
              font: "Arial",
            }),
          ],
        }),
      );

      tailored.education.forEach((edu) => {
        sections.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `${edu.degree} in ${edu.field}`,
                bold: true,
                size: 24,
                font: "Arial",
              }),
            ],
          }),
        );

        const endYear = edu.endDate ? edu.endDate.getFullYear() : "Present";

        sections.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `${edu.institution} | ${endYear}${edu.gpa ? ` | GPA: ${edu.gpa}` : ""}`,
                size: 22,
                font: "Arial",
                italics: true,
                color: "666666",
              }),
            ],
          }),
        );
      });
    }

    // Create document with bullet numbering
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: "bullets",
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: "•",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 360 },
                  },
                },
              },
            ],
          },
        ],
      },
      styles: {
        default: {
          document: {
            run: {
              font: "Arial",
              size: 24, // 12pt default
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 12240, // US Letter width (8.5")
                height: 15840, // US Letter height (11")
              },
              margin: {
                top: 1440, // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: sections,
        },
      ],
    });

    return doc;
  }

  /**
   * Traditional template (conservative, for corporate roles)
   */
  private createTraditionalTemplate(tailored: TailoredResume): Document {
    // Similar structure but with more conservative styling
    // Will implement if needed
    return this.createModernTemplate(tailored);
  }

  /**
   * Minimal template (clean, for design/creative roles)
   */
  private createMinimalTemplate(tailored: TailoredResume): Document {
    // Simplified version with minimal formatting
    // Will implement if needed
    return this.createModernTemplate(tailored);
  }

  /**
   * Convert DOCX to PDF using LibreOffice
   */
  private async convertToPDF(docxPath: string): Promise<string> {
    // For now, just return the docx path
    // PDF conversion requires LibreOffice which may not be available
    logger.warn("PDF conversion not yet implemented, returning DOCX");
    return docxPath;

    /* TODO: Implement when LibreOffice is available
    const { execSync } = require('child_process');
    const command = `python scripts/office/soffice.py --headless --convert-to pdf "${docxPath}"`;
    
    try {
      execSync(command, { cwd: process.cwd() });
      logger.success('Converted to PDF');
      return pdfPath;
    } catch (error) {
      logger.error('PDF conversion failed', error);
      return docxPath; // Fallback to DOCX
    }
    */
  }
}

// Singleton
let documentGenerator: DocumentGeneratorService | null = null;

export function getDocumentGenerator(): DocumentGeneratorService {
  if (!documentGenerator) {
    documentGenerator = new DocumentGeneratorService();
  }
  return documentGenerator;
}

export default getDocumentGenerator;
