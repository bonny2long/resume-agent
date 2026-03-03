// src/types/job.types.ts

export interface JobPosting {
  id: string;
  companyId: string;
  title: string;
  url?: string;
  location: string;
  salary?: string;
  postedDate?: Date;
  rawDescription: string;
  parsed: ParsedJobData;
  aiAnalysis: JobAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedJobData {
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  qualifications: string[];
  keywords: string[];
  benefits?: string[];
}

export interface JobAnalysis {
  skillsMatch: number; // 0-100
  experienceLevel:
    | "entry"
    | "junior"
    | "mid"
    | "senior"
    | "staff"
    | "principal";
  estimatedSalaryRange?: string;
  workStyle?: ("remote" | "hybrid" | "onsite")[];
  competitionLevel?: "low" | "medium" | "high";
  recommendations: string[];
}

export interface CompanyProfile {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  founded?: number;
  headquarters?: string;
  basicInfo: CompanyBasicInfo;
  culture: CompanyCulture;
  techStack: TechStack;
  research: CompanyResearch;
  lastResearched: Date;
}

export interface CompanyBasicInfo {
  description?: string;
  mission?: string;
  vision?: string;
  website?: string;
}

export interface CompanyCulture {
  values: string[];
  workStyle: string[];
  benefits: string[];
  perks?: string[];
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  infrastructure: string[];
  tools: string[];
  databases: string[];
}

export interface CompanyResearch {
  recentNews: NewsItem[];
  products: string[];
  competitors: string[];
  fundingStage?: string;
  employeeCount?: string;
  glassdoorRating?: number;
}

export interface NewsItem {
  title: string;
  url: string;
  date: Date;
  source: string;
  summary: string;
}

export interface MatchAnalysis {
  overallScore: number; // 0-100
  skillMatch: number;
  experienceMatch: number;
  cultureMatch: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface ApplicationPackage {
  id: string;
  job: JobPosting;
  company: CompanyProfile;
  resume: {
    path: string;
    atsScore: number;
    keywordMatch: number;
  };
  coverLetter?: {
    path: string;
    personalized: boolean;
  };
  hiringManagers: HiringManagerSummary[];
  strategy: ApplicationStrategy;
  status: string;
  createdAt: Date;
}

export interface HiringManagerSummary {
  id: string;
  name: string;
  title: string;
  confidence: number;
  linkedInUrl?: string;
}

export interface ApplicationStrategy {
  channels: ApplicationChannel[];
  timeline: ApplicationTimeline;
  priorities: string[];
  estimatedResponseTime?: string;
}

export type ApplicationChannel =
  | "job_board"
  | "company_website"
  | "linkedin_outreach"
  | "email_direct"
  | "referral"
  | "recruiter";

export interface ApplicationTimeline {
  day1: string[];
  day2: string[];
  day5: string[];
  day7: string[];
  day14: string[];
}

export interface FollowUpPlan {
  checkpoints: FollowUpCheckpoint[];
  escalationPath: string[];
}

export interface FollowUpCheckpoint {
  day: number;
  action: string;
  channel: "linkedin" | "email" | "phone";
  message?: string;
}

// For parsing job postings
export interface JobParsingResult {
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  qualifications: string[];
  salary?: string;
  benefits?: string[];
  metadata: {
    postedDate?: Date;
    closingDate?: Date;
    jobType?: string;
    remote?: boolean;
  };
}
