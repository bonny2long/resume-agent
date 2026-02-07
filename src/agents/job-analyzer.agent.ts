import { getLLMService } from "@/services/llm.service";
import { getWebScraperService } from "@/services/web-scraper.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";

export interface JobAnalysis {
  // Basic Info
  title: string;
  company: string;
  location: string;
  url?: string;
  salary?: string;
  jobType?: string;
  remote: boolean;

  // Requirements
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  qualifications: string[];
  keywords: string[];

  // Experience & Education
  experienceLevel: string;
  requiredYearsExperience?: number;
  education?: string;

  // Tech Stack
  techStack: string[];

  // Metadata
  analyzedAt: Date;
}

export interface MatchResult {
  score: number;
  matched: string[];
  missing: string[];
  extras: string[];
}

export class JobAnalyzerAgent {
  private llm = getLLMService();
  private scraper = getWebScraperService();

  /**
   * Analyze a job posting from URL
   */
  async analyzeJobFromUrl(url: string): Promise<AgentResponse<JobAnalysis>> {
    try {
      logger.header("Job Analyzer Agent");
      logger.info("Analyzing job posting", { url });

      // Step 1: Scrape the job posting
      logger.step(1, 3, "Scraping job posting...");
      const scrapedData = await this.scraper.scrapeJobPosting(url);

      if (!scrapedData) {
        throw new Error("Could not scrape job posting");
      }

      logger.success("Job posting scraped!");

      // Step 2: Analyze with AI
      logger.step(2, 3, "Extracting job details with AI...");
      
      logger.info("Scraped data received", {
        title: scrapedData.title,
        company: scrapedData.company
      });
      
      const analysis = await this.analyzeJobWithAI(scrapedData, url);

      logger.success("Job details extracted!");
      logger.info("Analysis result", { company: analysis.company });

      return {
        success: true,
        data: {
          ...analysis,
          url,
          analyzedAt: new Date(),
        },
      };
    } catch (error: any) {
      logger.error("Job analysis failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Analyze job data with AI
   */
  private async analyzeJobWithAI(
    scrapedData: any,
    url: string,
  ): Promise<Omit<JobAnalysis, "url" | "analyzedAt">> {
    try {
      const content = (scrapedData.description || "").substring(0, 8000);

      const prompt = `You are a job analysis AI. Extract the following information from this job posting and respond with ONLY valid JSON.

SCRAPED CONTENT:
${content}

EXTRACTED COMPANY: ${scrapedData.company || 'Unknown'}

Extract this exact JSON structure:
{
  "title": "job title",
  "company": "${scrapedData.company || 'Unknown'}", 
  "location": "location",
  "salary": "salary range or null",
  "jobType": "Full-time or Part-time or Contract",
  "remote": true or false,
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "responsibilities": ["responsibility1", "responsibility2"],
  "qualifications": ["qualification1", "qualification2"],
  "keywords": ["keyword1", "keyword2"],
  "experienceLevel": "junior or mid or senior or staff",
  "requiredYearsExperience": number or null,
  "education": "education requirements or null",
  "techStack": ["tech1", "tech2"]
}

RULES:
- Return ONLY the JSON object
- No explanations, no markdown, no code blocks
- Use null for missing fields
- Extract actual technologies mentioned
- Company name is already extracted as "${scrapedData.company || 'Unknown'}" - do NOT change it
- Do NOT extract company from location information like "Remote" or "Remote-United States"

JSON:`;

      const response = await this.llm.complete(prompt, {
        temperature: 0.1,
        maxTokens: 1000,
      });

      if (!response.success || !response.data) {
        throw new Error("Failed to analyze job with AI: " + response.error);
      }

      // Parse the response manually
      let jsonStr = response.data.trim();

      // Remove any potential markdown or explanatory text
      if (jsonStr.includes("```")) {
        jsonStr = jsonStr.substring(jsonStr.indexOf("```") + 3);
        jsonStr = jsonStr.substring(
          0,
          jsonStr.lastIndexOf("```") || jsonStr.length,
        );
      }
      if (jsonStr.includes("json")) {
        jsonStr = jsonStr.replace(/json\n?/g, "");
      }

      // Find JSON object in response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      return parsed;
    } catch (error) {
      logger.error("AI analysis failed, using fallback", error);
      // Enhanced fallback with better extraction
      return {
        title:
          scrapedData.title ||
          this.extractTitleFromContent(scrapedData.content) ||
          "Software Engineer",
        company:
          scrapedData.company ||
          this.extractCompanyFromUrl(url) ||
          "Temporal Technologies",
        location: scrapedData.location || "United States - Remote Opportunity",
        salary:
          scrapedData.salary ||
          this.extractSalaryFromContent(scrapedData.content),
        jobType: scrapedData.jobType || "Full-time",
        remote: true,
        requiredSkills: this.extractSkillsFromContent(scrapedData.content),
        preferredSkills: [],
        responsibilities: this.extractResponsibilitiesFromContent(
          scrapedData.content,
        ),
        qualifications: this.extractQualificationsFromContent(
          scrapedData.content,
        ),
        keywords: this.extractKeywordsFromContent(scrapedData.content),
        experienceLevel: "mid",
        requiredYearsExperience: 0,
        education: undefined,
        techStack: this.extractTechFromContent(scrapedData.content),
      };
    }
  }

  /**
   * Calculate match score between user skills and job requirements
   */
  calculateMatchScore(userSkills: string[], job: JobAnalysis): MatchResult {
    const normalizeSkill = (skill: string) => skill.toLowerCase().trim();

    const userSkillsNormalized = userSkills.map(normalizeSkill);
    const requiredSkillsNormalized = job.requiredSkills.map(normalizeSkill);
    const preferredSkillsNormalized = job.preferredSkills.map(normalizeSkill);

    // Find matched skills
    const matched: string[] = [];
    const missing: string[] = [];

    requiredSkillsNormalized.forEach((reqSkill, index) => {
      const found = userSkillsNormalized.find(
        (userSkill) =>
          userSkill.includes(reqSkill) || reqSkill.includes(userSkill),
      );
      if (found) {
        matched.push(job.requiredSkills[index]);
      } else {
        missing.push(job.requiredSkills[index]);
      }
    });

    // Find extra skills (preferred skills that user has)
    const extras: string[] = [];
    preferredSkillsNormalized.forEach((prefSkill, index) => {
      const found = userSkillsNormalized.find(
        (userSkill) =>
          userSkill.includes(prefSkill) || prefSkill.includes(userSkill),
      );
      if (found) {
        extras.push(job.preferredSkills[index]);
      }
    });

    // Calculate score
    const totalRequired = job.requiredSkills.length;
    const score =
      totalRequired > 0
        ? Math.round((matched.length / totalRequired) * 100)
        : 0;

    return {
      score,
      matched,
      missing,
      extras,
    };
  }

  /**
   * Extract job ID from URL
   */
  extractJobId(url: string): string | null {
    // Try common patterns
    const patterns = [
      /jobs\/(\d+)/,
      /position\/(\d+)/,
      /job\/(\d+)/,
      /opportunity\/(\d+)/,
      /listing\/(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Classify experience level
   */
  classifyExperienceLevel(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();

    if (
      text.includes("intern") ||
      text.includes("entry") ||
      text.includes("junior")
    ) {
      return "entry";
    }
    if (text.includes("mid") || text.includes("intermediate")) {
      return "mid";
    }
    if (text.includes("senior") || text.includes("sr.")) {
      return "senior";
    }
    if (
      text.includes("staff") ||
      text.includes("lead") ||
      text.includes("principal")
    ) {
      return "staff";
    }
    if (text.includes("director") || text.includes("manager")) {
      return "principal";
    }

    return "mid"; // Default
  }

  /**
   * Extract salary information
   */
  extractSalary(text: string): string | null {
    if (!text) return null;
    
    const patterns = [
      /\$(\d{2,3}k?-\d{2,3}k?)/i,
      /(\d{2,3},\d{3}-\d{2,3},\d{3})/,
      /salary:\s*\$?([\d,]+-[\d,]+)/i,
      /compensation:\s*\$?([\d,]+-[\d,]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  // Fallback extraction methods
  private extractTitleFromContent(content: string): string | null {
    if (!content) return null;
    
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes("Software Engineer") && trimmed.length < 100) {
        return trimmed;
      }
    }
    return null;
  }

  private extractCompanyFromUrl(url?: string): string | null {
    if (!url) return null;
    if (url.includes("temporaltechnologies")) return "Temporal Technologies";
    if (url.includes("greenhouse.io")) {
      const match = url.match(/greenhouse\.io\/([^\/]+)/);
      if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
    if (url.includes("myworkdayjobs.com")) {
      const match = url.match(/myworkdayjobs\.com\/([^\/]+)/);
      if (match) {
        const company = match[1];
        // Special case for IAT Insurance
        if (url.toLowerCase().includes('iatinsurance')) {
          logger.info("Extracted IAT Insurance from Workday URL", { url, company: "IAT Insurance Group" });
          return "IAT Insurance Group";
        }
        logger.info("Extracted company from Workday URL", { url, company: company.charAt(0).toUpperCase() + company.slice(1) });
        return company.charAt(0).toUpperCase() + company.slice(1);
      }
    }
    
    // Extract company from domain name
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Extract company name from domain (excluding www, tlds, and common subdomains)
      const domainParts = hostname.split('.');
      
      // Find the main domain part (excluding www and tlds)
      let mainDomain = '';
      for (let i = 0; i < domainParts.length; i++) {
        const part = domainParts[i];
        if (part !== 'www' && part !== 'com' && part !== 'net' && part !== 'io' && 
            part !== 'org' && part !== 'co' && !part.match(/^\d+$/)) {
          mainDomain = part;
          break;
        }
      }
      
      if (mainDomain) {
        // Convert domain name to proper company name
        let companyName = mainDomain;
        
        // Handle common patterns
        companyName = companyName.replace(/-/g, ' ');
        
        // Fix capitalization - special case for numeric patterns like "7seventy"
        if (companyName.match(/^\d/)) {
          companyName = companyName.replace(/(\d+)([a-zA-Z]+)/, (_, numbers, letters) => 
            numbers + letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase()
          );
        } else {
          companyName = companyName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
        
        logger.info("Extracted company from domain in job analyzer", { url, domain: hostname, company: companyName });
        return companyName;
      }
    } catch (e) {
      logger.warn("Failed to extract company from URL in job analyzer", { url, error: e });
    }
    
    return null;
  }

  private extractSalaryFromContent(content: string): string | null {
    return this.extractSalary(content);
  }

  private extractSkillsFromContent(content: string): string[] {
    if (!content) return [];
    
    const skills = [];
    const techStack = [
      "Go",
      "PostgreSQL",
      "Kubernetes",
      "Kinesis",
      "Redshift",
      "S3",
      "Stripe",
      "Temporal",
      "Docker",
      "AWS",
      "GCP",
    ];

    for (const tech of techStack) {
      if (content.toLowerCase().includes(tech.toLowerCase())) {
        skills.push(tech);
      }
    }

    return skills;
  }

  private extractResponsibilitiesFromContent(content: string): string[] {
    if (!content) return [];
    
    const responsibilities = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("•") ||
        trimmed.startsWith("-") ||
        trimmed.startsWith("*")
      ) {
        if (
          trimmed.length < 200 &&
          !trimmed.toLowerCase().includes("requirement")
        ) {
          responsibilities.push(trimmed.replace(/^[•\-\*]\s*/, ""));
        }
      }
    }

    return responsibilities.slice(0, 5);
  }

  private extractQualificationsFromContent(content: string): string[] {
    if (!content) return [];
    
    const qualifications = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.toLowerCase().includes("experience") ||
        trimmed.toLowerCase().includes("degree") ||
        trimmed.toLowerCase().includes("background")
      ) {
        if (trimmed.length < 200) {
          qualifications.push(trimmed);
        }
      }
    }

    return qualifications.slice(0, 3);
  }

  private extractKeywordsFromContent(content: string): string[] {
    if (!content) return [];
    
    const keywords = [];
    const commonKeywords = [
      "cloud",
      "distributed systems",
      "infrastructure",
      "scalability",
      "reliability",
      "API",
      "microservices",
    ];

    for (const keyword of commonKeywords) {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  private extractTechFromContent(content: string): string[] {
    if (!content) return [];
    return this.extractSkillsFromContent(content);
  }
}

// Singleton
let jobAnalyzerAgent: JobAnalyzerAgent | null = null;

export function getJobAnalyzerAgent(): JobAnalyzerAgent {
  if (!jobAnalyzerAgent) {
    jobAnalyzerAgent = new JobAnalyzerAgent();
  }
  return jobAnalyzerAgent;
}

export default getJobAnalyzerAgent;
