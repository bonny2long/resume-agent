// src/database/repositories/resume.repository.ts
import { PrismaClient } from "@prisma/client";

export class ResumeRepository {
  constructor(private prisma: PrismaClient) {}

  async getMasterResume() {
    return await this.prisma.masterResume.findFirst({
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
  }

  async createMasterResume(data: {
    fullName: string;
    email: string;
    phone?: string;
    location?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    summary?: string;
    summaryShort?: string;
    summaryLong?: string;
  }) {
    return await this.prisma.masterResume.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || "",
        location: data.location || "",
        linkedInUrl: data.linkedInUrl || null,
        githubUrl: data.githubUrl || null,
        portfolioUrl: data.portfolioUrl || null,
        summaryShort: data.summaryShort || data.summary || "",
        summaryLong: data.summaryLong || data.summary || "",
      },
    });
  }

  async updateMasterResume(
    id: string,
    data: Partial<{
      fullName: string;
      email: string;
      phone: string;
      location: string;
      linkedInUrl: string;
      githubUrl: string;
      portfolioUrl: string;
      summaryShort: string;
      summaryLong: string;
    }>,
  ) {
    return await this.prisma.masterResume.update({
      where: { id },
      data,
    });
  }

  async addExperience(
    masterResumeId: string,
    experienceData: {
      company: string;
      title: string;
      location: string;
      startDate: Date;
      endDate?: Date;
      current: boolean;
      description?: string;
      achievements: Array<{
        description: string;
        metrics?: string;
        impactLevel: "high" | "medium" | "low";
      }>;
      technologies: string[];
    },
  ) {
    return await this.prisma.experience.create({
      data: {
        resumeId: masterResumeId,
        company: experienceData.company,
        title: experienceData.title,
        location: experienceData.location,
        startDate: experienceData.startDate,
        endDate: experienceData.endDate || null,
        current: experienceData.current,
        description: experienceData.description || null,
        achievements: {
          create: experienceData.achievements.map((achievement) => ({
            description: achievement.description,
            metrics: achievement.metrics || null,
            impact: achievement.impactLevel,
            keywords: [], // Will be populated by AI later
          })),
        },
        technologies: {
          connectOrCreate: experienceData.technologies.map((tech) => ({
            where: { name: tech },
            create: {
              name: tech,
              category: "framework", // Default category
            },
          })),
        },
      },
      include: {
        achievements: true,
        technologies: true,
      },
    });
  }

  async addProject(
    masterResumeId: string,
    projectData: {
      name: string;
      description: string;
      role: string;
      startDate: Date;
      endDate?: Date;
      current: boolean;
      technologies: string[];
      achievements: Array<{
        description: string;
        metrics?: string;
        impactLevel: "high" | "medium" | "low";
      }>;
      url?: string;
      githubUrl?: string;
    },
  ) {
    const achievementStrings = projectData.achievements.map(
      (a) => a.description,
    );

    return await this.prisma.project.create({
      data: {
        resumeId: masterResumeId,
        name: projectData.name,
        description: projectData.description,
        role: projectData.role,
        startDate: projectData.startDate,
        endDate: projectData.endDate || new Date(), // Required field
        githubUrl: projectData.githubUrl || null,
        liveUrl: projectData.url || null,
        achievements: achievementStrings,
        technologies: {
          connectOrCreate: projectData.technologies.map((tech) => ({
            where: { name: tech },
            create: {
              name: tech,
              category: "framework", // Default category
            },
          })),
        },
      },
      include: {
        technologies: true,
      },
    });
  }

  async addSkill(
    masterResumeId: string,
    skillData: {
      name: string;
      category: string;
      level: "beginner" | "intermediate" | "advanced" | "expert";
      yearsOfExperience?: number;
    },
  ) {
    return await this.prisma.skill.create({
      data: {
        resumeId: masterResumeId,
        name: skillData.name,
        category: skillData.category,
        proficiency: skillData.level,
        technologies: {
          connectOrCreate: {
            where: { name: skillData.name },
            create: {
              name: skillData.name,
              category: "language", // Default for skills
            },
          },
        },
      },
      include: {
        technologies: true,
      },
    });
  }

  async addEducation(
    masterResumeId: string,
    educationData: {
      institution: string;
      degree: string;
      field: string;
      startDate: Date;
      endDate?: Date;
      current: boolean;
      gpa?: string;
    },
  ) {
    return await this.prisma.education.create({
      data: {
        resumeId: masterResumeId,
        institution: educationData.institution,
        degree: educationData.degree,
        field: educationData.field,
        startDate: educationData.startDate,
        endDate: educationData.endDate || null,
        gpa: educationData.gpa || null,
      },
    });
  }

  async getExperiences(resumeId: string) {
    return await this.prisma.experience.findMany({
      where: { resumeId },
      include: {
        achievements: true,
        technologies: true,
      },
      orderBy: { startDate: "desc" },
    });
  }

  async getProjects(resumeId: string) {
    return await this.prisma.project.findMany({
      where: { resumeId },
      include: {
        technologies: true,
      },
      orderBy: { startDate: "desc" },
    });
  }

  async getSkills(resumeId: string) {
    return await this.prisma.skill.findMany({
      where: { resumeId },
      include: {
        technologies: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async getEducation(resumeId: string) {
    return await this.prisma.education.findMany({
      where: { resumeId },
      orderBy: { startDate: "desc" },
    });
  }

  async deleteExperience(id: string) {
    return await this.prisma.experience.delete({
      where: { id },
    });
  }

  async deleteProject(id: string) {
    return await this.prisma.project.delete({
      where: { id },
    });
  }

  async deleteSkill(id: string) {
    return await this.prisma.skill.delete({
      where: { id },
    });
  }

  async deleteEducation(id: string) {
    return await this.prisma.education.delete({
      where: { id },
    });
  }

  async getExperienceById(id: string) {
    return await this.prisma.experience.findUnique({
      where: { id },
      include: {
        achievements: true,
        technologies: true,
      },
    });
  }

  async getProjectById(id: string) {
    return await this.prisma.project.findUnique({
      where: { id },
      include: {
        technologies: true,
      },
    });
  }

  async getSkillById(id: string) {
    return await this.prisma.skill.findUnique({
      where: { id },
      include: {
        technologies: true,
      },
    });
  }

  async getEducationById(id: string) {
    return await this.prisma.education.findUnique({
      where: { id },
    });
  }
}
