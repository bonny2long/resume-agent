// src/services/resume-parser.service.ts
import { getLLMService } from "./llm.service";
import { getPDFParserService } from "./pdf-parser.service";
import { getDOCXParserService } from "./docx-parser.service";
import { logger } from "@/utils/logger";
import path from "path";

export interface ParsedResume {
  personalInfo: {
    fullName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
  };
  summary: {
    short?: string;
    long?: string;
  };
  experiences: ParsedExperience[];
  projects: ParsedProject[];
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
    frameworks: string[];
    tools: string[];
    databases: string[];
  };
  education: ParsedEducation[];
  certifications: ParsedCertification[];
}

export interface ParsedExperience {
  company: string;
  title: string;
  location?: string;
  startDate: string; // YYYY-MM-DD or YYYY-MM
  endDate?: string; // null if current
  current: boolean;
  description?: string;
  achievements: Array<{
    description: string;
    metrics?: string;
    impact?: "high" | "medium" | "low";
  }>;
  technologies: string[];
}

export interface ParsedProject {
  name: string;
  description: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  technologies: string[];
  achievements: string[];
  githubUrl?: string;
  liveUrl?: string;
}

export interface ParsedEducation {
  institution: string;
  degree: string;
  field: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
}

export interface ParsedCertification {
  name: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  url?: string;
}

export class ResumeParserService {
  private llm = getLLMService();
  private pdfParser = getPDFParserService();
  private docxParser = getDOCXParserService();

  /**
   * Parse resume file (PDF or DOCX)
   */
  async parseResumeFile(filePath: string): Promise<ParsedResume> {
    logger.header("Resume Parser");

    // Determine file type
    const ext = path.extname(filePath).toLowerCase();

    let text: string;

    if (ext === ".pdf") {
      logger.info("Parsing PDF file...");
      text = await this.pdfParser.extractText(filePath);
    } else if (ext === ".docx" || ext === ".doc") {
      logger.info("Parsing DOCX file...");
      text = await this.docxParser.extractText(filePath);
    } else {
      throw new Error(`Unsupported file type: ${ext}. Use .pdf or .docx`);
    }

    logger.success(`Extracted ${text.length} characters`);

    // Parse with AI
    return await this.parseResumeText(text);
  }

  /**
   * Parse resume text using Claude AI
   */
  async parseResumeText(resumeText: string): Promise<ParsedResume> {
    logger.info("Parsing resume with AI...");

    const prompt = `
You are an expert resume parser. Parse the following resume and extract all information into structured JSON.

IMPORTANT RULES:
1. Extract dates in YYYY-MM-DD format (or YYYY-MM if day not specified)
2. For current positions, set "endDate" to null and "current" to true
3. Extract all metrics and numbers from achievements (e.g., "40%", "$2M", "5 engineers")
4. Identify technologies mentioned (programming languages, frameworks, tools, databases)
5. Classify skills into categories
6. Extract complete contact information
7. Separate work experience from projects
8. Classify achievement impact as high/medium/low based on scope and results

Resume Text:
${resumeText}

Return ONLY valid JSON in this exact structure:
{
  "personalInfo": {
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedInUrl": "string or null",
    "githubUrl": "string or null",
    "portfolioUrl": "string or null"
  },
  "summary": {
    "short": "2-3 sentence summary",
    "long": "Full professional summary paragraph"
  },
  "experiences": [
    {
      "company": "string",
      "title": "string",
      "location": "string or null",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD or null",
      "current": boolean,
      "description": "string or null",
      "achievements": [
        {
          "description": "string",
          "metrics": "extracted numbers/percentages",
          "impact": "high/medium/low"
        }
      ],
      "technologies": ["tech1", "tech2"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "role": "string or null",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "technologies": ["tech1", "tech2"],
      "achievements": ["achievement1", "achievement2"],
      "githubUrl": "string or null",
      "liveUrl": "string or null"
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "languages": ["JavaScript", "Python"],
    "frameworks": ["React", "Node.js"],
    "tools": ["Git", "Docker"],
    "databases": ["PostgreSQL", "MongoDB"]
  },
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "startDate": "YYYY-MM or null",
      "endDate": "YYYY-MM or null",
      "gpa": "string or null"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "issueDate": "YYYY-MM-DD or null",
      "expiryDate": "YYYY-MM-DD or null",
      "credentialId": "string or null",
      "url": "string or null"
    }
  ]
}
`;

    const response = await this.llm.completeJSON<ParsedResume>(prompt);

    if (!response.success || !response.data) {
      throw new Error(
        "Failed to parse resume: " + (response.error || "Unknown error"),
      );
    }

    const parsed = response.data;

    logger.success("Resume parsed successfully!");
    logger.item("Experiences", parsed.experiences.length.toString());
    logger.item("Projects", parsed.projects.length.toString());
    logger.item("Skills", parsed.skills.technical.length.toString());
    logger.item("Education", parsed.education.length.toString());

    return parsed;
  }

  /**
   * Validate parsed resume
   */
  validateParsedResume(parsed: ParsedResume): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!parsed.personalInfo?.fullName) {
      errors.push("Missing full name");
    }
    if (!parsed.personalInfo?.email) {
      warnings.push("Missing email address");
    }
    if (!parsed.personalInfo?.phone) {
      warnings.push("Missing phone number");
    }

    // Check experiences
    if (!parsed.experiences || parsed.experiences.length === 0) {
      warnings.push("No work experience found");
    } else {
      parsed.experiences.forEach((exp, i) => {
        if (!exp.company) errors.push(`Experience ${i + 1}: Missing company`);
        if (!exp.title) errors.push(`Experience ${i + 1}: Missing title`);
        if (!exp.startDate)
          errors.push(`Experience ${i + 1}: Missing start date`);
      });
    }

    // Check skills
    const totalSkills =
      (parsed.skills?.technical?.length || 0) +
      (parsed.skills?.languages?.length || 0) +
      (parsed.skills?.frameworks?.length || 0);

    if (totalSkills === 0) {
      warnings.push("No technical skills found");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get summary statistics
   */
  getSummaryStats(parsed: ParsedResume) {
    return {
      totalExperiences: parsed.experiences?.length || 0,
      totalProjects: parsed.projects?.length || 0,
      totalSkills:
        (parsed.skills?.technical?.length || 0) +
        (parsed.skills?.languages?.length || 0) +
        (parsed.skills?.frameworks?.length || 0) +
        (parsed.skills?.tools?.length || 0) +
        (parsed.skills?.databases?.length || 0),
      totalEducation: parsed.education?.length || 0,
      totalCertifications: parsed.certifications?.length || 0,
      yearsOfExperience: this.calculateYearsOfExperience(
        parsed.experiences || [],
      ),
    };
  }

  /**
   * Calculate total years of experience
   */
  private calculateYearsOfExperience(experiences: ParsedExperience[]): number {
    if (experiences.length === 0) return 0;

    let totalMonths = 0;

    experiences.forEach((exp) => {
      const start = new Date(exp.startDate);
      const end = exp.endDate ? new Date(exp.endDate) : new Date();

      const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());

      totalMonths += months;
    });

    return Math.round((totalMonths / 12) * 10) / 10; // Round to 1 decimal
  }
}

// Singleton
let resumeParserService: ResumeParserService | null = null;

export function getResumeParserService(): ResumeParserService {
  if (!resumeParserService) {
    resumeParserService = new ResumeParserService();
  }
  return resumeParserService;
}

export default getResumeParserService;
