import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

interface MasterResumeExport {
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedInUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    summaryShort: string;
    summaryLong: string;
  };
  experiences: Array<{
    id: string;
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate?: string;
    current: boolean;
    description?: string;
    achievements: Array<{
      description: string;
      metrics?: string;
      impact: string;
      keywords: string[];
    }>;
    technologies: string[];
  }>;
  projects: Array<{
    id: string;
    name: string;
    description: string;
    role: string;
    githubUrl?: string;
    liveUrl?: string;
    featured: boolean;
    startDate: string;
    endDate: string;
    achievements: string[];
    technologies: string[];
  }>;
  skills: Array<{
    name: string;
    category: string;
    proficiency?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    gpa?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    issueDate: string;
    expiryDate?: string;
    credentialId?: string;
    url?: string;
  }>;
  metadata: {
    exportDate: string;
    version: number;
    totalExperienceYears: number;
    projectCount: number;
    skillsCount: number;
    achievementsCount: number;
    educationCount: number;
    certificationCount: number;
  };
}

export class ExportService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async exportMasterResume(
    format: "json" | "markdown" = "json",
  ): Promise<string> {
    // Get the master resume (assuming one for now)
    const masterResume = await this.prisma.masterResume.findFirst({
      include: {
        experiences: {
          include: {
            achievements: true,
            technologies: true,
          },
          orderBy: { startDate: "desc" },
        },
        projects: {
          include: {
            technologies: true,
          },
          orderBy: { startDate: "desc" },
        },
        skills: {
          include: {
            technologies: true,
          },
        },
        education: {
          orderBy: { startDate: "desc" },
        },
        certifications: {
          orderBy: { issueDate: "desc" },
        },
      },
    });

    if (!masterResume) {
      throw new Error("No master resume found. Please upload a resume first.");
    }

    // Format the data
    const exportData: MasterResumeExport = {
      personalInfo: {
        fullName: masterResume.fullName,
        email: masterResume.email,
        phone: masterResume.phone,
        location: masterResume.location,
        linkedInUrl: masterResume.linkedInUrl || undefined,
        githubUrl: masterResume.githubUrl || undefined,
        portfolioUrl: masterResume.portfolioUrl || undefined,
        summaryShort: masterResume.summaryShort,
        summaryLong: masterResume.summaryLong,
      },
      experiences: masterResume.experiences.map((exp) => ({
        id: exp.id,
        company: exp.company,
        title: exp.title,
        location: exp.location,
        startDate: exp.startDate.toISOString().split("T")[0],
        endDate: exp.endDate?.toISOString().split("T")[0],
        current: exp.current,
        description: exp.description || undefined,
        achievements: exp.achievements.map((ach) => ({
          description: ach.description,
          metrics: ach.metrics || undefined,
          impact: ach.impact,
          keywords: ach.keywords,
        })),
        technologies: exp.technologies.map((tech) => tech.name),
      })),
      projects: masterResume.projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        role: project.role,
        githubUrl: project.githubUrl || undefined,
        liveUrl: project.liveUrl || undefined,
        featured: project.featured,
        startDate: project.startDate.toISOString().split("T")[0],
        endDate: project.endDate.toISOString().split("T")[0],
        achievements: project.achievements,
        technologies: project.technologies.map((tech) => tech.name),
      })),
      skills: masterResume.skills.map((skill) => ({
        name: skill.name,
        category: skill.category,
        proficiency: skill.proficiency || undefined,
      })),
      education: masterResume.education.map((edu) => ({
        institution: edu.institution,
        degree: edu.degree,
        field: edu.field,
        startDate: edu.startDate.toISOString().split("T")[0],
        endDate: edu.endDate?.toISOString().split("T")[0],
        gpa: edu.gpa || undefined,
      })),
      certifications: masterResume.certifications.map((cert) => ({
        name: cert.name,
        issuer: cert.issuer,
        issueDate: cert.issueDate.toISOString().split("T")[0],
        expiryDate: cert.expiryDate?.toISOString().split("T")[0],
        credentialId: cert.credentialId || undefined,
        url: cert.url || undefined,
      })),
      metadata: {
        exportDate: new Date().toISOString(),
        version: masterResume.version,
        totalExperienceYears: this.calculateExperienceYears(
          masterResume.experiences,
        ),
        projectCount: masterResume.projects.length,
        skillsCount: masterResume.skills.length,
        achievementsCount: masterResume.experiences.reduce(
          (sum, exp) => sum + exp.achievements.length,
          0,
        ),
        educationCount: masterResume.education.length,
        certificationCount: masterResume.certifications.length,
      },
    };

    // Create outputs directory if it doesn't exist
    const outputsDir = path.join(process.cwd(), "data", "outputs");
    await fs.mkdir(outputsDir, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    const filename = `master_resume_${timestamp}`;

    if (format === "json") {
      const filePath = path.join(outputsDir, `${filename}.json`);
      await fs.writeFile(
        filePath,
        JSON.stringify(exportData, null, 2),
        "utf-8",
      );
      return filePath;
    } else {
      const filePath = path.join(outputsDir, `${filename}.md`);
      const markdown = this.convertToMarkdown(exportData);
      await fs.writeFile(filePath, markdown, "utf-8");
      return filePath;
    }
  }

  async exportGitHubRepos(): Promise<string> {
    const repos = await this.prisma.gitHubRepo.findMany({
      orderBy: { stars: "desc" },
    });

    const outputsDir = path.join(process.cwd(), "data", "outputs");
    await fs.mkdir(outputsDir, { recursive: true });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    const filePath = path.join(outputsDir, `github_repos_${timestamp}.json`);

    await fs.writeFile(filePath, JSON.stringify(repos, null, 2), "utf-8");
    return filePath;
  }

  private calculateExperienceYears(experiences: any[]): number {
    let totalDays = 0;

    for (const exp of experiences) {
      const start = new Date(exp.startDate);
      const end = exp.endDate ? new Date(exp.endDate) : new Date();
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      totalDays += days;
    }

    return Math.round((totalDays / 365) * 10) / 10;
  }

  private convertToMarkdown(data: MasterResumeExport): string {
    let markdown = `# ${data.personalInfo.fullName} - Master Resume\n\n`;
    markdown += `**Exported:** ${new Date(data.metadata.exportDate).toLocaleDateString()} | `;
    markdown += `Version: ${data.metadata.version} | `;
    markdown += `Total Experience: ${data.metadata.totalExperienceYears} years\n\n`;

    // Contact Information
    markdown += `## 📇 Contact Information\n\n`;
    markdown += `- **Email:** ${data.personalInfo.email}\n`;
    markdown += `- **Phone:** ${data.personalInfo.phone}\n`;
    markdown += `- **Location:** ${data.personalInfo.location}\n`;
    if (data.personalInfo.linkedInUrl) {
      markdown += `- **LinkedIn:** ${data.personalInfo.linkedInUrl}\n`;
    }
    if (data.personalInfo.githubUrl) {
      markdown += `- **GitHub:** ${data.personalInfo.githubUrl}\n`;
    }
    if (data.personalInfo.portfolioUrl) {
      markdown += `- **Portfolio:** ${data.personalInfo.portfolioUrl}\n`;
    }
    markdown += `\n`;

    // Professional Summary
    markdown += `## 💼 Professional Summary\n\n`;
    markdown += `${data.personalInfo.summaryShort}\n\n`;
    markdown += `${data.personalInfo.summaryLong}\n\n`;

    // Work Experience
    markdown += `## 💼 Work Experience\n\n`;
    for (const exp of data.experiences) {
      markdown += `### ${exp.title} at ${exp.company}\n`;
      markdown += `**${exp.location}** | `;
      markdown += `${exp.startDate} - ${exp.current ? "Present" : exp.endDate}\n\n`;

      if (exp.description) {
        markdown += `${exp.description}\n\n`;
      }

      if (exp.achievements.length > 0) {
        markdown += `**Key Achievements:**\n`;
        for (const ach of exp.achievements) {
          markdown += `- ${ach.description}`;
          if (ach.metrics) {
            markdown += ` (${ach.metrics})`;
          }
          markdown += `\n`;
        }
        markdown += `\n`;
      }

      if (exp.technologies.length > 0) {
        markdown += `**Technologies:** ${exp.technologies.join(", ")}\n\n`;
      }
    }

    // Projects
    markdown += `## 🚀 Projects\n\n`;
    for (const project of data.projects) {
      markdown += `### ${project.name}\n`;
      markdown += `**Role:** ${project.role} | `;
      markdown += `${project.startDate} - ${project.endDate}\n\n`;
      markdown += `${project.description}\n\n`;

      if (project.achievements.length > 0) {
        markdown += `**Achievements:**\n`;
        for (const achievement of project.achievements) {
          markdown += `- ${achievement}\n`;
        }
        markdown += `\n`;
      }

      if (project.technologies.length > 0) {
        markdown += `**Technologies:** ${project.technologies.join(", ")}\n\n`;
      }

      if (project.githubUrl || project.liveUrl) {
        markdown += `**Links:** `;
        if (project.githubUrl) markdown += `[GitHub](${project.githubUrl}) `;
        if (project.liveUrl) markdown += `[Live Demo](${project.liveUrl})`;
        markdown += `\n\n`;
      }
    }

    // Skills
    markdown += `## 🛠️ Skills\n\n`;
    const skillsByCategory = data.skills.reduce(
      (acc, skill) => {
        if (!acc[skill.category]) acc[skill.category] = [];
        acc[skill.category].push(skill.name);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    for (const [category, skills] of Object.entries(skillsByCategory)) {
      markdown += `**${category.charAt(0).toUpperCase() + category.slice(1)}:** ${skills.join(", ")}\n`;
    }
    markdown += `\n`;

    // Education
    if (data.education.length > 0) {
      markdown += `## 🎓 Education\n\n`;
      for (const edu of data.education) {
        markdown += `### ${edu.degree} in ${edu.field}\n`;
        markdown += `**${edu.institution}** | `;
        markdown += `${edu.startDate} - ${edu.endDate || "Present"}\n`;
        if (edu.gpa) {
          markdown += `**GPA:** ${edu.gpa}\n`;
        }
        markdown += `\n`;
      }
    }

    // Certifications
    if (data.certifications.length > 0) {
      markdown += `## 🏆 Certifications\n\n`;
      for (const cert of data.certifications) {
        markdown += `### ${cert.name}\n`;
        markdown += `**${cert.issuer}** | `;
        markdown += `Issued: ${cert.issueDate}`;
        if (cert.expiryDate) {
          markdown += ` | Expires: ${cert.expiryDate}`;
        }
        if (cert.url) {
          markdown += ` | [Credential](${cert.url})`;
        }
        markdown += `\n\n`;
      }
    }

    // Metadata
    markdown += `---\n\n`;
    markdown += `## 📊 Statistics\n\n`;
    markdown += `- **Total Experience:** ${data.metadata.totalExperienceYears} years\n`;
    markdown += `- **Projects:** ${data.metadata.projectCount}\n`;
    markdown += `- **Skills:** ${data.metadata.skillsCount}\n`;
    markdown += `- **Achievements:** ${data.metadata.achievementsCount}\n`;
    markdown += `- **Education:** ${data.metadata.educationCount}\n`;
    markdown += `- **Certifications:** ${data.metadata.certificationCount}\n\n`;
    markdown += `**Export Date:** ${new Date(data.metadata.exportDate).toLocaleString()}\n`;

    return markdown;
  }
}
