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
import { CoverLetter } from "@/agents/cover-letter-generator";

export interface DocumentGenerationOptions {
  format: "docx" | "pdf";
  template?: "modern" | "traditional" | "minimal";
  includePhoto?: boolean;
  photoPath?: string;
}

export class DocumentGeneratorService {
  /**
   * Remove duplicate experiences based on company and title similarity
   */
  private deduplicateExperiences(experiences: any[]): any[] {
    const seen = new Set();
    const deduplicated = [];

    for (const exp of experiences) {
      // Create a unique key based on company and title (case-insensitive)
      const key = `${exp.company?.toLowerCase().trim()}_${exp.title?.toLowerCase().trim()}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(exp);
      } else {
        // Log warning about duplicate found
        logger.warn(
          `Duplicate experience removed: ${exp.title} at ${exp.company}`,
        );
      }
    }

    return deduplicated;
  }

  /**
   * Group skills by category for modern template
   * Filters out noise and properly categorizes tech skills
   */
  private groupSkillsByCategory(skills: string[]): {
    [category: string]: string[];
  } {
    // Expanded noise words list
    const noiseWords = new Set([
      "service",
      "workflow",
      "api",
      "data",
      "work",
      "application",
      "server",
      "public",
      "management",
      "development",
      "design",
      "testing",
      "security",
      "performance",
      "implementation",
      "integration",
      "optimization",
      "architecture",
      "requirements",
      "analysis",
      "documentation",
      "deployment",
      "monitoring",
      "version",
      "control",
      "type",
      "action",
      "engineering",
      "engineering",
      "config",
      "github-config",
      "client",
      "roadmap",
      "should",
      "tagging",
      "social",
      "collaboration",
      "docs",
      "bridge",
      "buddy",
      "hooks",
      "continuous",
      "code",
      "command",
      "proxy",
      "web",
      "style",
      "error",
      "per",
      "out",
      "handle",
      "delivery",
      "subscribe",
      "edge",
      "modeling",
      "ci",
      "database",
      "railway",
      "ssl",
      "business",
      "programming",
      "antigravity",
      "postcss",
      "autoprefixer",
      "postman",
      "parcel",
      "dockerfile",
      "eslint",
      "prettier",
      "webpack",
      "next.js",
      "tailwind",
      "azure",
      "google cloud",
      "digitalocean",
      "heroku",
      "aws",
      "react 19",
      "react query",
      "tanstack query",
      "full-stack software engineering",
      "application architecture",
      "scalable engineering",
      "responsive ui development",
      "git/github",
      "rest api development",
      "data-driven decision-making",
      "role-based access control",
      "authentication & authorization",
      "continuous deployment",
      "ai/llm integration",
      "power bi",
      "ag charts",
      "vs code",
      "builder's mindset",
      "node.js",
      "github",
      "sql",
      "typescript",
      "github-config",
      "various ides",
      "full-stack web development",
      "microsoft power bi",
    ]);

    // Valid tech skills to KEEP (whitelist approach)
    const validTechSkills = new Set([
      // Languages
      "javascript",
      "python",
      "java",
      "c++",
      "c#",
      "php",
      "ruby",
      "go",
      "rust",
      "swift",
      "kotlin",
      "scala",
      "r",
      "perl",
      "shell",
      "bash",
      "typescript",
      // Frontend
      "react",
      "vue",
      "angular",
      "next",
      "nuxt",
      "svelte",
      "html",
      "css",
      "tailwind",
      "bootstrap",
      "jquery",
      "redux",
      "react query",
      "tanstack query",
      // Backend
      "node",
      "node.js",
      "express",
      "django",
      "flask",
      "spring",
      "rails",
      "laravel",
      "fastapi",
      "nestjs",
      "asp.net",
      "graphql",
      "rest",
      // Databases
      "sql",
      "mysql",
      "postgresql",
      "mongodb",
      "redis",
      "elasticsearch",
      "firebase",
      "supabase",
      "dynamodb",
      "cassandra",
      "sqlite",
      "oracle",
      "tsql",
      // Cloud & DevOps
      "docker",
      "kubernetes",
      "terraform",
      "jenkins",
      "github actions",
      "ci/cd",
      "linux",
      "nginx",
      // Tools
      "git",
      "github",
      "vscode",
      "vim",
      "bash",
      "powershell",
      "npm",
      "yarn",
      "pnpm",
      "webpack",
      "babel",
      "postman",
      "playwright",
      // Other
      "prisma",
      "websocket",
      "vite",
      "rest api",
      "restful",
      "oauth",
      "jwt",
      "rbac",
      "llm",
      "ai",
    ]);

    // Filter skills - must be in validTechSkills OR not in noiseWords
    const validSkills = skills.filter((skill) => {
      const lower = skill.toLowerCase().trim();
      // Keep if in whitelist
      if (validTechSkills.has(lower)) return true;
      // Keep if not in noise words and has at least 3 chars
      if (lower.length >= 3 && !noiseWords.has(lower)) return true;
      return false;
    });

    // Deduplicate after normalization
    const uniqueSkills = [...new Set(validSkills.map((s) => s.toLowerCase()))];

    const categories: { [key: string]: string[] } = {
      Languages: [],
      Frameworks: [],
      Libraries: [],
      Databases: [],
      Cloud: [],
      Tools: [],
      Other: [],
    };

    // Category definitions with more specific matching
    const categoryMap: { [key: string]: string[] } = {
      Languages: [
        "javascript",
        "python",
        "typescript",
        "java",
        "c++",
        "c#",
        "php",
        "ruby",
        "go",
        "rust",
        "swift",
        "kotlin",
        "scala",
        "r",
        "perl",
        "shell",
        "bash",
      ],
      Frameworks: [
        "react",
        "vue",
        "angular",
        "express",
        "django",
        "flask",
        "spring",
        "laravel",
        "rails",
        "next",
        "nuxt",
        "svelte",
        "fastapi",
        "nestjs",
        "adonis",
        "echo",
        "gin",
      ],
      Libraries: [
        "node.js",
        "node",
        "react native",
        "tailwind",
        "bootstrap",
        "jquery",
        "lodash",
        "axios",
        "socket.io",
        "prisma",
        "mongoose",
        "sequelize",
        "typeorm",
        "chart.js",
        "d3",
        "redux",
        "zustand",
        "recoil",
      ],
      Databases: [
        "sql",
        "mysql",
        "postgresql",
        "postgres",
        "mongodb",
        "redis",
        "sqlite",
        "oracle",
        "elasticsearch",
        "cassandra",
        "dynamodb",
        "firebase",
        "supabase",
        "tsql",
        "plsql",
      ],
      Cloud: [
        "aws",
        "azure",
        "gcp",
        "google cloud",
        "digitalocean",
        "heroku",
        "vercel",
        "netlify",
        "cloudflare",
        "docker",
        "kubernetes",
        "k8s",
        "terraform",
        "ci/cd",
        "jenkins",
        "github actions",
      ],
      Tools: [
        "git",
        "github",
        "gitlab",
        "vscode",
        "vim",
        "linux",
        "bash",
        "powershell",
        "npm",
        "yarn",
        "webpack",
        "babel",
        "eslint",
        "prettier",
        "postman",
        "insomnia",
        "chrome devtools",
      ],
    };

    // Group skills
    uniqueSkills.forEach((skill) => {
      const skillLower = skill.toLowerCase();
      let categorized = false;

      // Check each category in order
      for (const [category, keywords] of Object.entries(categoryMap)) {
        if (
          keywords.some(
            (keyword) =>
              skillLower === keyword ||
              skillLower.includes(keyword + "s") ||
              skillLower.includes(keyword),
          )
        ) {
          // Don't add duplicates
          if (!categories[category].includes(skill)) {
            categories[category].push(skill);
          }
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        if (!categories["Other"].includes(skill)) {
          categories["Other"].push(skill);
        }
      }
    });

    // Remove empty categories
    Object.keys(categories).forEach((category) => {
      if (categories[category].length === 0) {
        delete categories[category];
      }
    });

    return categories;
  }

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
    const filename = `resume_${sanitizedCompany}_${template}_${timestamp}.docx`;

    const outputDir = path.join(process.cwd(), "data", "outputs");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, filename);

    // Generate document
    const buffer = await Packer.toBuffer(document);

    // Retry mechanism for file writing (handles locked files)
    let retries = 0;
    const maxRetries = 3;
    let writeSuccess = false;

    while (!writeSuccess && retries < maxRetries) {
      try {
        fs.writeFileSync(filepath, buffer);
        writeSuccess = true;
      } catch (error: any) {
        if (error.code === "EBUSY" && retries < maxRetries - 1) {
          logger.warn(
            `File locked, retrying in 1 second... (attempt ${retries + 1}/${maxRetries})`,
          );
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        } else {
          throw error;
        }
      }
    }

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

    // Accent line under name
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        border: {
          bottom: {
            color: "2C5F8D", // Professional blue
            space: 1,
            style: "single",
            size: 6,
          },
        },
        children: [],
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
      if (tailored.personalInfo.linkedInUrl) {
        // Extract clean URL (remove https://)
        const cleanUrl = tailored.personalInfo.linkedInUrl.replace(
          /^https?:\/\//,
          "",
        );
        linkParts.push(cleanUrl);
      }
      if (tailored.personalInfo.githubUrl) {
        const cleanUrl = tailored.personalInfo.githubUrl.replace(
          /^https?:\/\//,
          "",
        );
        linkParts.push(cleanUrl);
      }
      if (tailored.personalInfo.portfolioUrl) {
        const cleanUrl = tailored.personalInfo.portfolioUrl.replace(
          /^https?:\/\//,
          "",
        );
        linkParts.push(cleanUrl);
      }

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

    // Professional Summary Header
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
            color: "2C5F8D", // Professional blue
          }),
        ],
      }),
    );

    // 🔴 FIX: Split summary into distinct paragraphs
    const summaryParagraphs = tailored.summary
      .split(/\n+/)
      .filter((p) => p.trim().length > 0);

    summaryParagraphs.forEach((paragraph, index) => {
      sections.push(
        new Paragraph({
          // Add standard spacing after each paragraph, slightly more after the last one
          spacing: {
            after: index === summaryParagraphs.length - 1 ? 240 : 120,
          },
          children: [
            new TextRun({
              text: paragraph.trim(),
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );
    });

    // Technical Skills (including engineering skills from GitHub READMEs)
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
              color: "2C5F8D", // Professional blue
            }),
          ],
        }),
      );

      let allSkills = [
        ...tailored.skills.matched,
        ...tailored.skills.relevant,
        ...tailored.skills.other,
      ];

      // Add engineering skills from GitHub READMEs
      if (tailored.engineeringSkills) {
        const engSkills = tailored.engineeringSkills;
        const extraSkills: string[] = [];

        if (engSkills.systemDesign) extraSkills.push(...engSkills.systemDesign);
        if (engSkills.security) extraSkills.push(...engSkills.security);
        if (engSkills.performance) extraSkills.push(...engSkills.performance);
        if (engSkills.architecture) extraSkills.push(...engSkills.architecture);
        if (engSkills.database) extraSkills.push(...engSkills.database);

        // Add unique engineering skills not already in list
        extraSkills.forEach((skill) => {
          if (!allSkills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
            allSkills.push(skill);
          }
        });
      }

      allSkills = allSkills.slice(0, 30); // Limit to top 30

      // Group skills by category
      const groupedSkills = this.groupSkillsByCategory(allSkills);

      // Display grouped skills
      Object.entries(groupedSkills).forEach(([category, skills], index) => {
        sections.push(
          new Paragraph({
            spacing: { before: index > 0 ? 120 : 0, after: 60 },
            children: [
              new TextRun({
                text: `${category}: `,
                bold: true,
                size: 22,
                font: "Arial",
                color: "2C5F8D",
              }),
              new TextRun({
                text: skills.join(" • "),
                size: 22,
                font: "Arial",
              }),
            ],
          }),
        );
      });

      // Add spacing after skills section
      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [],
        }),
      );
    }

    // Experience
    const deduplicatedExperiences = this.deduplicateExperiences(
      tailored.experiences,
    );
    if (deduplicatedExperiences.length > 0) {
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
              color: "2C5F8D", // Professional blue
            }),
          ],
        }),
      );

      deduplicatedExperiences.forEach((exp, index) => {
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
        const endDate = exp.current
          ? "Present"
          : `${exp.endDate?.toLocaleString("default", { month: "short" })} ${exp.endDate?.getFullYear()}`;

        const locationText = exp.location ? `${exp.location} | ` : "";

        sections.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `${locationText}${startMonth} ${startYear} - ${endDate}`,
                size: 22,
                font: "Arial",
                italics: true,
                color: "666666",
              }),
            ],
          }),
        );

        // Achievements (bullets)
        exp.achievements.forEach(
          (achievement: {
            description: string;
            metrics?: string;
            impact: string;
          }) => {
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
          },
        );

        // Add spacing between experiences
        if (index < deduplicatedExperiences.length - 1) {
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
              color: "2C5F8D", // Professional blue
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
              color: "2C5F8D", // Professional blue
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
    const sections: any[] = [];

    // Name (left-aligned, ALL CAPS)
    sections.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: tailored.personalInfo.fullName.toUpperCase(),
            bold: true,
            size: 28, // 14pt - more conservative
            font: "Times New Roman", // Traditional serif font
          }),
        ],
      }),
    );

    // Contact Info (left-aligned, single line)
    const contactParts: string[] = [];
    if (tailored.personalInfo.email)
      contactParts.push(tailored.personalInfo.email);
    if (tailored.personalInfo.phone)
      contactParts.push(tailored.personalInfo.phone);
    if (tailored.personalInfo.location)
      contactParts.push(tailored.personalInfo.location);

    sections.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: contactParts.join(" | "),
            size: 20,
            font: "Times New Roman",
          }),
        ],
      }),
    );

    // Horizontal line separator
    sections.push(
      new Paragraph({
        spacing: { after: 240 },
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: "single",
            size: 6,
          },
        },
        children: [],
      }),
    );

    // Professional Summary Header
    sections.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: "Professional Summary",
            bold: true,
            size: 24,
            font: "Times New Roman",
          }),
        ],
      }),
    );

    // 🔴 FIX: Split summary into distinct paragraphs
    const summaryParagraphs = tailored.summary
      .split(/\n+/)
      .filter((p) => p.trim().length > 0);

    summaryParagraphs.forEach((paragraph, index) => {
      sections.push(
        new Paragraph({
          spacing: {
            after: index === summaryParagraphs.length - 1 ? 240 : 120,
          },
          children: [
            new TextRun({
              text: paragraph.trim(),
              size: 22,
              font: "Times New Roman",
            }),
          ],
        }),
      );
    });

    // Technical Skills
    if (
      tailored.skills.matched.length > 0 ||
      tailored.skills.relevant.length > 0
    ) {
      sections.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Technical Skills",
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        }),
      );

      const allSkills = [
        ...tailored.skills.matched,
        ...tailored.skills.relevant,
      ].slice(0, 20);

      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: allSkills.join(", "), // Comma-separated, more traditional
              size: 22,
              font: "Times New Roman",
            }),
          ],
        }),
      );
    }

    // Professional Experience
    const deduplicatedExperiences = this.deduplicateExperiences(
      tailored.experiences,
    );
    if (deduplicatedExperiences.length > 0) {
      sections.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Professional Experience",
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        }),
      );

      deduplicatedExperiences.forEach((exp, index) => {
        // Company & Title (company first - traditional order)
        sections.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: exp.company,
                bold: true,
                size: 22,
                font: "Times New Roman",
              }),
              new TextRun({
                text: exp.location ? `, ${exp.location}` : "",
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );

        // Title & Dates
        const startYear = exp.startDate.getFullYear();
        const startMonth = exp.startDate.toLocaleString("default", {
          month: "short",
        });
        const endDate = exp.current
          ? "Present"
          : `${exp.endDate?.toLocaleString("default", { month: "short" })} ${exp.endDate?.getFullYear()}`;

        sections.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: exp.title,
                italics: true,
                size: 22,
                font: "Times New Roman",
              }),
              new TextRun({
                text: ` (${startMonth} ${startYear} - ${endDate})`,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );

        // Achievements (bullets)
        exp.achievements.forEach(
          (achievement: {
            description: string;
            metrics?: string;
            impact: string;
          }) => {
            sections.push(
              new Paragraph({
                numbering: {
                  reference: "bullets",
                  level: 0,
                },
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: achievement.description,
                    size: 22,
                    font: "Times New Roman",
                  }),
                ],
              }),
            );
          },
        );

        // Add spacing between experiences
        if (index < deduplicatedExperiences.length - 1) {
          sections.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [],
            }),
          );
        }
      });
    }

    // Education (before projects - traditional order)
    if (tailored.education.length > 0) {
      sections.push(
        new Paragraph({
          spacing: { before: 240, after: 80 },
          children: [
            new TextRun({
              text: "Education",
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        }),
      );

      tailored.education.forEach((edu) => {
        const endYear = edu.endDate ? edu.endDate.getFullYear() : "Present";

        sections.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: edu.institution,
                bold: true,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );

        sections.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `${edu.degree} in ${edu.field}, ${endYear}${edu.gpa ? ` | GPA: ${edu.gpa}` : ""}`,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );
      });
    }

    // Projects (if space allows)
    if (tailored.projects.length > 0) {
      sections.push(
        new Paragraph({
          spacing: { before: 240, after: 80 },
          children: [
            new TextRun({
              text: "Projects",
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        }),
      );

      tailored.projects.forEach((project, index) => {
        sections.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: project.name,
                bold: true,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );

        sections.push(
          new Paragraph({
            spacing: {
              after: index < tailored.projects.length - 1 ? 120 : 60,
            },
            children: [
              new TextRun({
                text: `${project.description} Technologies: ${project.technologies.join(", ")}`,
                size: 22,
                font: "Times New Roman",
              }),
            ],
          }),
        );
      });
    }

    // Create document
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
              font: "Times New Roman",
              size: 22,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 12240,
                height: 15840,
              },
              margin: {
                top: 1440,
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
   * Minimal template (clean, for design/creative roles)
   */
  private createMinimalTemplate(tailored: TailoredResume): Document {
    const sections: any[] = [];

    // Name (large, centered, minimal)
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: tailored.personalInfo.fullName,
            size: 44, // 22pt - larger for impact
            font: "Helvetica", // Clean sans-serif (falls back to Arial)
          }),
        ],
      }),
    );

    // Contact (centered, minimal - email only for truly minimal look)
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 }, // Extra space for breathing room
        children: [
          new TextRun({
            text: tailored.personalInfo.email,
            size: 18,
            font: "Helvetica",
            color: "888888", // Lighter gray
          }),
        ],
      }),
    );

    // 🔴 FIX: Split summary into distinct paragraphs (Minimal style)
    const summaryParagraphs = tailored.summary
      .split(/\n+/)
      .filter((p) => p.trim().length > 0);

    summaryParagraphs.forEach((paragraph, index) => {
      sections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            // Larger spacing after the entire block, distinct spacing between paragraphs
            after: index === summaryParagraphs.length - 1 ? 360 : 120,
          },
          children: [
            new TextRun({
              text: paragraph.trim(),
              size: 22,
              font: "Helvetica",
            }),
          ],
        }),
      );
    });

    // Skills (minimal header)
    if (
      tailored.skills.matched.length > 0 ||
      tailored.skills.relevant.length > 0
    ) {
      sections.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Skills",
              size: 22,
              font: "Helvetica",
              color: "333333",
            }),
          ],
        }),
      );

      const allSkills = [
        ...tailored.skills.matched,
        ...tailored.skills.relevant,
      ].slice(0, 10);

      sections.push(
        new Paragraph({
          spacing: { after: 360 },
          children: [
            new TextRun({
              text: allSkills.join("  ·  "), // Spaced dots
              size: 20,
              font: "Helvetica",
              color: "666666",
            }),
          ],
        }),
      );
    }

    // Experience (minimal headers)
    const deduplicatedExperiences = this.deduplicateExperiences(
      tailored.experiences,
    );
    if (deduplicatedExperiences.length > 0) {
      sections.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Experience",
              size: 22,
              font: "Helvetica",
              color: "333333",
            }),
          ],
        }),
      );

      deduplicatedExperiences.forEach((exp, index) => {
        // Title & Company (single line)
        const startYear = exp.startDate.getFullYear();
        const endYear = exp.current ? "Present" : exp.endDate?.getFullYear();

        sections.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: exp.title,
                size: 22,
                font: "Helvetica",
              }),
              new TextRun({
                text: `  ·  ${exp.company}  ·  ${startYear}–${endYear}`,
                size: 20,
                font: "Helvetica",
                color: "666666",
              }),
            ],
          }),
        );

        // Achievements (no bullets, just dashes) - limit to 3
        exp.achievements
          .slice(0, 3)
          .forEach(
            (achievement: {
              description: string;
              metrics?: string;
              impact: string;
            }) => {
              sections.push(
                new Paragraph({
                  spacing: { after: 40 },
                  children: [
                    new TextRun({
                      text: `– ${achievement.description}`,
                      size: 20,
                      font: "Helvetica",
                    }),
                  ],
                }),
              );
            },
          );

        // Add spacing between experiences
        if (index < deduplicatedExperiences.length - 1) {
          sections.push(
            new Paragraph({
              spacing: { after: 240 },
              children: [],
            }),
          );
        }
      });

      sections.push(
        new Paragraph({
          spacing: { after: 360 },
          children: [],
        }),
      );
    }

    // Projects (minimal)
    if (tailored.projects.length > 0) {
      sections.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Projects",
              size: 22,
              font: "Helvetica",
              color: "333333",
            }),
          ],
        }),
      );

      tailored.projects.forEach((project, index) => {
        sections.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: project.name,
                size: 22,
                font: "Helvetica",
              }),
              new TextRun({
                text: `  ·  ${project.technologies.slice(0, 3).join(", ")}`,
                size: 20,
                font: "Helvetica",
                color: "666666",
              }),
            ],
          }),
        );

        const shortDescription =
          project.description.length > 80
            ? project.description.substring(0, 77) + "..."
            : project.description;

        sections.push(
          new Paragraph({
            spacing: {
              after: index < tailored.projects.length - 1 ? 240 : 120,
            },
            children: [
              new TextRun({
                text: shortDescription,
                size: 20,
                font: "Helvetica",
              }),
            ],
          }),
        );
      });

      sections.push(
        new Paragraph({
          spacing: { after: 360 },
          children: [],
        }),
      );
    }

    // Education (very minimal)
    if (tailored.education.length > 0) {
      sections.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Education",
              size: 22,
              font: "Helvetica",
              color: "333333",
            }),
          ],
        }),
      );

      tailored.education.forEach((edu) => {
        const endYear = edu.endDate ? edu.endDate.getFullYear() : "Present";

        sections.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `${edu.degree}, ${edu.institution}  ·  ${endYear}`,
                size: 20,
                font: "Helvetica",
              }),
            ],
          }),
        );
      });
    }

    // Create document (no bullet numbering - using dashes instead)
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Helvetica",
              size: 22,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 12240,
                height: 15840,
              },
              margin: {
                top: 2160, // 1.5 inches for minimal look
                right: 2160,
                bottom: 2160,
                left: 2160,
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
   * Generate a cover letter DOCX
   */
  async generateCoverLetter(
    coverLetter: CoverLetter,
    _options: { format: "docx" | "pdf" } = { format: "docx" },
  ): Promise<{ success: boolean; filepath?: string; error?: string }> {
    try {
      logger.info("Generating cover letter document");

      // Create cover letter DOCX
      const sections: any[] = [];

      // Your contact info (top right or left, depending on preference)
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: coverLetter.yourName,
              size: 24,
              font: "Arial",
            }),
          ],
        }),
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: coverLetter.yourAddress,
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${coverLetter.yourEmail} | ${coverLetter.yourPhone}`,
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      // Spacing
      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [],
        }),
      );

      // Date
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: coverLetter.date,
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      // Spacing
      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [],
        }),
      );

      // Recipient info (if available)
      if (coverLetter.hiringManager) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: coverLetter.hiringManager,
                size: 22,
                font: "Arial",
              }),
            ],
          }),
        );
      }

      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: coverLetter.companyName,
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      if (coverLetter.companyAddress) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: coverLetter.companyAddress,
                size: 22,
                font: "Arial",
              }),
            ],
          }),
        );
      }

      // Spacing
      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [],
        }),
      );

      // Greeting
      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: coverLetter.greeting,
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      // Opening paragraph
      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: coverLetter.opening,
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      // Body paragraphs
      coverLetter.body.forEach((paragraph: string) => {
        sections.push(
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: paragraph,
                size: 22,
                font: "Arial",
              }),
            ],
          }),
        );
      });

      // Closing paragraph
      sections.push(
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: coverLetter.closing,
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      // Signature
      sections.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: "Sincerely,",
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      sections.push(
        new Paragraph({
          spacing: { after: 360 }, // Extra space for signature
          children: [],
        }),
      );

      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: coverLetter.signature,
              size: 22,
              font: "Arial",
            }),
          ],
        }),
      );

      // Create document
      const doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: "Arial",
                size: 22,
              },
            },
          },
        },
        sections: [
          {
            properties: {
              page: {
                size: {
                  width: 12240,
                  height: 15840,
                },
                margin: {
                  top: 1440,
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

      // Generate filename
      const timestamp = new Date().toISOString().split("T")[0];
      const sanitizedCompany = coverLetter.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      const filename = `cover-letter_${sanitizedCompany}_${timestamp}.docx`;

      const outputDir = path.join(process.cwd(), "data", "outputs");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filepath = path.join(outputDir, filename);

      // Generate document
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filepath, buffer);

      logger.success(`Cover letter generated: ${filename}`);
      return { success: true, filepath };
    } catch (error: any) {
      logger.error("Cover letter generation failed", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert DOCX to PDF using LibreOffice
   */
  private async convertToPDF(docxPath: string): Promise<string> {
    // For now, just return the docx path
    // PDF conversion requires LibreOffice which may not be available
    logger.warn("PDF conversion not yet implemented, returning DOCX");
    return docxPath;
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
