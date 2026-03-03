// src/types/resume.types.ts

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

export interface Summary {
  short: string; // 2-3 sentences
  long: string; // Full paragraph
  keywords?: string[];
}

export interface Achievement {
  id: string;
  description: string;
  metrics?: string; // "Increased by 40%", "$2M revenue"
  impact: "high" | "medium" | "low";
  keywords: string[];
}

export interface Experience {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: Date;
  endDate: Date | null;
  current: boolean;
  description?: string;
  achievements: Achievement[];
  technologies: string[];
  relevanceScore?: number; // Calculated per job
}

export interface Project {
  id: string;
  name: string;
  description: string;
  role: string;
  githubUrl?: string;
  liveUrl?: string;
  technologies: string[];
  achievements: string[];
  startDate: Date;
  endDate: Date;
  featured: boolean;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate: Date | null;
  gpa?: string;
  honors?: string[];
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId?: string;
  url?: string;
}

export interface SkillSet {
  technical: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    databases: string[];
    cloud: string[];
  };
  soft: string[];
}

export interface MasterResume {
  id: string;
  version: number;
  personalInfo: PersonalInfo;
  summary: Summary;
  experiences: Experience[];
  projects: Project[];
  skills: SkillSet;
  education: Education[];
  certifications: Certification[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TailoredResume extends Omit<
  MasterResume,
  "experiences" | "projects"
> {
  jobId: string;
  experiences: Experience[]; // Filtered and optimized
  projects: Project[]; // Selected relevant projects
  atsScore?: number;
  keywordMatch?: number;
}

export interface ResumeGenerationOptions {
  format: "pdf" | "docx";
  template: "modern" | "traditional" | "creative";
  maxPages: number;
  includeProjects: boolean;
  maxProjects: number;
  emphasizeKeywords: boolean;
}

// For RAG/Vector search
export interface ExperienceWithEmbedding extends Experience {
  embedding?: number[];
}

export interface ProjectWithEmbedding extends Project {
  embedding?: number[];
}
