// src/types/linkedin.types.ts

export interface HiringManager {
  id: string;
  jobId: string;
  name: string;
  title: string;
  department?: string;
  linkedInUrl?: string;
  email?: string;
  phone?: string;
  profile: LinkedInProfile;
  activity: LinkedInActivity;
  insights: PersonalizationInsights;
  confidence: number; // 0-100
  sources: HiringManagerSource[];
  contactStrategy: ContactStrategy;
  foundAt: Date;
  verified: boolean;
}

export type HiringManagerSource =
  | "linkedin"
  | "job_posting"
  | "company_website"
  | "api"
  | "manual";

export interface LinkedInProfile {
  headline: string;
  location: string;
  photoUrl?: string;
  connectionCount?: number;
  followerCount?: number;
  companyTenure: {
    current: number; // months
    total: number;
  };
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  sharedConnections: SharedConnection[];
}

export interface LinkedInExperience {
  company: string;
  title: string;
  duration: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface LinkedInEducation {
  institution: string;
  degree?: string;
  field?: string;
  year?: number;
}

export interface SharedConnection {
  name: string;
  linkedInUrl?: string;
  relationship?: string;
  mutualCount?: number;
}

export interface LinkedInActivity {
  recentPosts: LinkedInPost[];
  recentComments: LinkedInComment[];
  articlesWritten: LinkedInArticle[];
  engagementTopics: string[];
  postingFrequency: "daily" | "weekly" | "monthly" | "rarely";
}

export interface LinkedInPost {
  id: string;
  date: Date;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  topic: string;
  sentiment: "positive" | "neutral" | "critical";
  url?: string;
}

export interface LinkedInComment {
  postTitle: string;
  content: string;
  date: Date;
  url?: string;
}

export interface LinkedInArticle {
  title: string;
  url: string;
  publishedDate: Date;
  summary?: string;
}

export interface PersonalizationInsights {
  communicationStyle: "formal" | "casual" | "mixed";
  interests: string[];
  values: string[];
  recentAchievements: string[];
  conversationStarters: string[];
  sharedBackground: SharedBackground[];
}

export interface SharedBackground {
  type: "education" | "company" | "location" | "interest" | "group" | "skill";
  value: string;
  relevance: number; // 0-1
  context?: string;
}

export interface ContactStrategy {
  preferredChannel: "linkedin" | "email" | "both";
  timing: {
    bestDay?: string;
    bestTime?: string;
  };
  approach: "direct" | "relationship-first" | "referral";
  personalizationAngle: string;
  icebreakers: string[];
}

export interface LinkedInMessage {
  id: string;
  hiringManagerId: string;
  type: "connection_request" | "initial_message" | "follow_up" | "thank_you";
  message: {
    subject?: string;
    body: string;
    characterCount: number;
  };
  personalization: MessagePersonalization;
  variants: MessageVariant[];
  strategy: MessageStrategy;
  timing?: {
    bestSendTime: Date;
    followUpSchedule?: Date;
  };
  status: "draft" | "sent" | "accepted" | "replied" | "ignored";
  createdAt: Date;
  sentAt?: Date;
  responseAt?: Date;
}

export interface MessagePersonalization {
  elements: PersonalizationElement[];
  sharedConnections: string[];
  conversationHooks: string[];
}

export interface PersonalizationElement {
  type: PersonalizationElementType;
  value: string;
  confidence: number; // 0-1
  context?: string;
}

export type PersonalizationElementType =
  | "shared_connection"
  | "shared_education"
  | "recent_post"
  | "company_achievement"
  | "mutual_interest"
  | "shared_experience"
  | "alma_mater"
  | "previous_company"
  | "industry_trend"
  | "shared_group";

export interface MessageVariant {
  id: string;
  body: string;
  approach: string;
  reasoning: string;
  estimatedEffectiveness?: number; // 0-100
}

export interface MessageStrategy {
  tone: "professional" | "friendly" | "casual";
  approach: "direct" | "value-first" | "curiosity";
  cta: string;
  personalizationLevel: "basic" | "standard" | "advanced";
}

export interface CoverLetter {
  id: string;
  jobId: string;
  hiringManagerId?: string;
  metadata: CoverLetterMetadata;
  content: CoverLetterContent;
  personalization: CoverLetterPersonalization;
  style: CoverLetterStyle;
  generated: Date;
  version: number;
}

export interface CoverLetterMetadata {
  recipientName?: string;
  recipientTitle?: string;
  companyName: string;
  positionTitle: string;
  date: Date;
}

export interface CoverLetterContent {
  salutation: string;
  opening: {
    hook: string;
    context: string;
  };
  body: {
    whyCompany: string;
    qualifications: string[];
    uniqueValue: string;
  };
  closing: {
    callToAction: string;
    availability: string;
    signature: string;
  };
  fullText: string;
}

export interface CoverLetterPersonalization {
  companyResearch: string[];
  hiringManagerReference: boolean;
  recentNewsReference?: string;
  sharedConnectionReference?: string;
  customizations: string[];
}

export interface CoverLetterStyle {
  tone: "formal" | "professional" | "conversational";
  length: number; // word count
  format: "traditional" | "modern" | "creative";
}

// For manual input/screenshot upload
export interface ManualLinkedInData {
  profileUrl: string;
  name: string;
  title: string;
  company: string;
  location?: string;
  sharedConnections?: string[];
  recentActivity?: string[];
  aboutSection?: string;
  customNotes?: string;
}

// Search results
export interface LinkedInSearchResult {
  name: string;
  title: string;
  company: string;
  location: string;
  profileUrl: string;
  headline: string;
  connectionDegree: "1st" | "2nd" | "3rd";
  matchScore?: number;
}
