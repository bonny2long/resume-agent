// src/agents/hiring-manager-finder.agent.ts
import { getLLMService } from "@/services/llm.service";
import { getWebScraperService } from "@/services/web-scraper.service";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";
import getPrismaClient from "@/database/client";
import config from "@/config";
import { getContactFinderService } from "@/services/contact-finder.service";
import axios from "axios";

export interface HiringManager {
  id?: string;
  name: string;
  title: string;
  company: string;
  linkedInUrl?: string;
  email?: string;
  phone?: string;
  location?: string;
  profileSummary?: string;
  confidence: number; // 0-100
  source: string; // "linkedin" | "hunter" | "apollo" | "rocketreach" | "company_website" | "ai_suggestion"
  verified: boolean;
}

export interface HiringManagerSearchResult {
  managers: HiringManager[];
  topMatch?: HiringManager;
  searchMethod: string;
}

export class HiringManagerFinderAgent {
  private llm = getLLMService();
  private scraper = getWebScraperService();
  private prisma = getPrismaClient();

  /**
   * Find hiring manager for a specific job
   */
  async findHiringManager(
    jobId: string,
  ): Promise<AgentResponse<HiringManagerSearchResult>> {
    try {
      logger.header("Hiring Manager Finder");
      logger.info("Searching for hiring manager", { jobId });

      // Step 1: Load job data
      logger.step(1, 4, "Loading job data...");
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      logger.success(`Job: ${job.title} at ${job.company?.name}`);

      const candidates: HiringManager[] = [];

      // Step 2: Generate AI suggestions (always works)
      logger.step(2, 4, "Generating hiring manager suggestions...");
      const aiSuggestions = await this.getAISuggestions(
        job.title,
        job.company?.name || "",
        job.location,
      );
      candidates.push(...aiSuggestions);
      logger.success(`Generated ${aiSuggestions.length} suggestions`);

      // Step 3: Try company website (if domain available)
      logger.step(3, 4, "Searching company website...");
      if (job.company?.domain) {
        const websiteResults = await this.searchCompanyWebsite(
          job.company.domain,
          job.title,
        );
        candidates.push(...websiteResults);
        logger.success(`Found ${websiteResults.length} from company website`);
      } else {
        logger.warn("No company domain available, skipping website search");
      }

      // Step 4: Try Hunter.io (if configured)
      logger.step(4, 4, "Searching contact databases...");
      if (config.contactFinder?.hunter?.apiKey && job.company?.domain) {
        const hunterResults = await this.searchHunter(
          job.company.domain,
          job.title,
        );
        candidates.push(...hunterResults);
        logger.success(`Found ${hunterResults.length} from Hunter.io`);
      } else {
        logger.warn("Hunter.io not configured, skipping");
      }

      // Rank and deduplicate
      const rankedCandidates = this.rankCandidates(candidates);
      const enrichedCandidates = await this.enrichCandidatesWithContactData(
        rankedCandidates,
        {
          companyName: job.company?.name || "",
          companyDomain: job.company?.domain || undefined,
        },
      );
      const topMatch = enrichedCandidates[0];

      logger.success(
        enrichedCandidates.length > 0 ?
          `Found ${enrichedCandidates.length} candidates`
        : "No candidates found",
      );

      return {
        success: true,
        data: {
          managers: enrichedCandidates,
          topMatch,
          searchMethod: this.determineSearchMethod(enrichedCandidates),
        },
      };
    } catch (error: any) {
      logger.error("Hiring manager search failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get AI suggestions for likely hiring managers
   */
  private async getAISuggestions(
    jobTitle: string,
    companyName: string,
    location?: string,
  ): Promise<HiringManager[]> {
    const managers: HiringManager[] = [];

    try {
      const prompt = `You are helping identify the hiring manager for a job posting.

Job Title: ${jobTitle}
Company: ${companyName}
Location: ${location || "Not specified"}

Based on typical organizational structures, suggest 3 likely job titles for the person who would be hiring for this role, ordered by likelihood.

Rules:
- For "Software Engineer" or "Developer" roles → Engineering Manager, Senior Engineering Manager, Director of Engineering
- For "Senior/Staff Engineer" → Director of Engineering, VP of Engineering, Head of Engineering
- For "Marketing" roles → Marketing Manager, Director of Marketing, VP of Marketing
- For "Sales" roles → Sales Manager, Director of Sales, VP of Sales
- For "Product" roles → Product Manager, Director of Product, VP of Product
- For "Data/Analytics" roles → Data Manager, Head of Analytics, Director of Data Science

Return ONLY a JSON array of objects with this structure:
[
  {"title": "Engineering Manager", "confidence": 80},
  {"title": "Senior Engineering Manager", "confidence": 70},
  {"title": "Director of Engineering", "confidence": 60}
]`;

      const response = await this.llm.complete(prompt, {
        temperature: 0.3,
        maxTokens: 300,
      });

      if (response.success && response.data) {
        try {
          let jsonStr = response.data.trim();

          // Clean up JSON
          if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr
              .replace(/```json\n?/g, "")
              .replace(/```\n?$/g, "");
          } else if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replace(/```\n?/g, "");
          }

          const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);

            suggestions.forEach((suggestion: any, index: number) => {
              managers.push({
                name: `[Search LinkedIn for: ${suggestion.title}]`,
                title: suggestion.title,
                company: companyName,
                linkedInUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName + " " + suggestion.title)}`,
                confidence: suggestion.confidence || 75 - index * 10,
                source: "ai_suggestion",
                verified: false,
              });
            });
          }
        } catch (e) {
          logger.warn("Failed to parse AI suggestions", e);
        }
      }
    } catch (error) {
      logger.warn("AI suggestions failed", error);
    }

    return managers;
  }

  /**
   * Search company website for hiring manager info
   */
  private async searchCompanyWebsite(
    domain: string,
    jobTitle: string,
  ): Promise<HiringManager[]> {
    const managers: HiringManager[] = [];

    try {
      // Try only the most likely team/about page to avoid timeouts
      const pagesToTry = [`https://${domain}/about`];

      for (const url of pagesToTry) {
        try {
          const page = await this.scraper.scrape(url);

          if (page.content && page.content.length > 100) {
            const extracted = await this.extractManagersFromText(
              page.content,
              jobTitle,
              domain,
            );

            if (extracted.length > 0) {
              managers.push(...extracted);
              break; // Found some, stop searching
            }
          }
        } catch (e) {
          // Page doesn't exist or failed to scrape, continue
          continue;
        }
      }
    } catch (error) {
      logger.warn("Company website search failed", error);
    }

    return managers;
  }

  /**
   * Extract managers from webpage text using AI
   */
  private async extractManagersFromText(
    text: string,
    jobTitle: string,
    domain: string,
  ): Promise<HiringManager[]> {
    const managers: HiringManager[] = [];

    try {
      const prompt = `Extract potential hiring managers from this company page text.

Job Title Looking For: ${jobTitle}

Company Page Text (first 2000 chars):
${text.substring(0, 2000)}

Look for people with titles relevant to hiring for "${jobTitle}":
- Engineering roles → Engineering Manager, Director/VP of Engineering, CTO
- Product roles → Product Manager, Director of Product, VP Product
- Marketing roles → Marketing Manager, Director/VP of Marketing, CMO
- Sales roles → Sales Manager, Director of Sales, VP Sales
- General roles → HR Manager, Talent Acquisition, Recruiting Manager

Return a JSON array with ONLY people who might hire for this role:
[
  {"name": "John Doe", "title": "Engineering Manager"},
  {"name": "Jane Smith", "title": "VP of Engineering"}
]

If no relevant managers found, return empty array: []`;

      const response = await this.llm.complete(prompt, {
        temperature: 0.2,
        maxTokens: 400,
      });

      if (response.success && response.data) {
        try {
          let jsonStr = response.data.trim();

          if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr
              .replace(/```json\n?/g, "")
              .replace(/```\n?$/g, "");
          } else if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replace(/```\n?/g, "");
          }

          const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const people = JSON.parse(jsonMatch[0]);

            people.forEach((person: any) => {
              if (person.name && person.title) {
                managers.push({
                  name: person.name,
                  title: person.title,
                  company: domain,
                  linkedInUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(person.name + " " + domain)}`,
                  confidence: 65,
                  source: "company_website",
                  verified: false,
                });
              }
            });
          }
        } catch (e) {
          logger.warn("Failed to parse manager extraction", e);
        }
      }
    } catch (error) {
      logger.warn("Manager extraction failed", error);
    }

    return managers;
  }

  /**
   * Search Hunter.io for company contacts
   */
  private async searchHunter(
    domain: string,
    _jobTitle: string,
  ): Promise<HiringManager[]> {
    const managers: HiringManager[] = [];

    try {
      const apiKey = config.contactFinder?.hunter?.apiKey;
      if (!apiKey) {
        logger.warn("Hunter.io API key not configured");
        return managers;
      }

      const response = await axios.get(
        `https://api.hunter.io/v2/domain-search`,
        {
          params: {
            domain: domain,
            api_key: apiKey,
            limit: 10,
          },
          timeout: 10000,
        },
      );

      if (response.data?.data?.emails) {
        response.data.data.emails.forEach((person: any) => {
          const title = person.position?.toLowerCase() || "";

          // Filter for managers/directors/VPs
          if (
            title.includes("manager") ||
            title.includes("director") ||
            title.includes("vp") ||
            title.includes("head") ||
            title.includes("lead")
          ) {
            managers.push({
              name: `${person.first_name} ${person.last_name}`,
              title: person.position || "Unknown Title",
              company: domain,
              email: person.value,
              linkedInUrl: person.linkedin,
              confidence: person.confidence || 55,
              source: "hunter",
              verified: person.verification?.status === "valid",
            });
          }
        });
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.warn("Hunter.io: Invalid API key");
      } else if (error.response?.status === 429) {
        logger.warn("Hunter.io: Rate limit exceeded");
      } else {
        logger.warn("Hunter.io API error", { error: error.message });
      }
    }

    return managers;
  }

  /**
   * Rank candidates by confidence and completeness
   */
  private rankCandidates(candidates: HiringManager[]): HiringManager[] {
    // Remove exact duplicates
    const unique = candidates.filter(
      (candidate, index, self) =>
        index ===
        self.findIndex(
          (c) =>
            c.name.toLowerCase() === candidate.name.toLowerCase() &&
            c.company.toLowerCase() === candidate.company.toLowerCase(),
        ),
    );

    // Sort by multiple factors
    return unique.sort((a, b) => {
      // 1. Verified contacts first
      if (a.verified !== b.verified) {
        return a.verified ? -1 : 1;
      }

      // 2. Has email/LinkedIn
      const aHasContact = a.email || a.linkedInUrl ? 1 : 0;
      const bHasContact = b.email || b.linkedInUrl ? 1 : 0;
      if (aHasContact !== bHasContact) {
        return bHasContact - aHasContact;
      }

      // 3. Confidence score
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // 4. Source priority (rocketreach > apollo > hunter > company_website > ai_suggestion)
      const sourcePriority = {
        rocketreach: 5,
        apollo: 4,
        hunter: 3,
        company_website: 2,
        ai_suggestion: 1,
      };
      const aPriority =
        sourcePriority[a.source as keyof typeof sourcePriority] || 0;
      const bPriority =
        sourcePriority[b.source as keyof typeof sourcePriority] || 0;
      return bPriority - aPriority;
    });
  }

  /**
   * Use service-layer waterfall (Apollo/Hunter/RocketReach) to enrich top candidates
   * with contact fields when we only have a likely name/title.
   */
  private async enrichCandidatesWithContactData(
    candidates: HiringManager[],
    context: { companyName: string; companyDomain?: string },
  ): Promise<HiringManager[]> {
    if (candidates.length === 0) return candidates;

    const enriched = [...candidates];
    const contactFinder = getContactFinderService();
    const maxEnrich = Math.min(3, enriched.length);

    for (let i = 0; i < maxEnrich; i += 1) {
      const candidate = enriched[i];
      if (candidate.email) continue;
      if (!this.isLikelyRealName(candidate.name)) continue;

      const parts = candidate.name.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");

      try {
        const found = await contactFinder.findContact(
          {
            firstName,
            lastName,
            fullName: candidate.name,
            company: context.companyName,
            companyDomain: context.companyDomain,
            title: candidate.title,
            linkedinUrl: candidate.linkedInUrl,
          },
          "medium",
        );

        if (!found) continue;

        enriched[i] = {
          ...candidate,
          title: found.title || candidate.title,
          linkedInUrl: found.linkedinUrl || candidate.linkedInUrl,
          email: found.email || candidate.email,
          phone: found.phone || candidate.phone,
          confidence: Math.max(candidate.confidence, found.confidence || 0),
          source: found.source || candidate.source,
          verified: candidate.verified || found.verified,
        };
      } catch (error) {
        logger.warn("Contact enrichment failed", {
          candidate: candidate.name,
          error,
        });
      }
    }

    return this.rankCandidates(enriched);
  }

  private isLikelyRealName(name: string): boolean {
    const normalized = `${name || ""}`.trim();
    if (!normalized) return false;
    if (normalized.includes("[") || normalized.includes("]")) return false;
    if (/search linkedin/i.test(normalized)) return false;
    const parts = normalized.split(/\s+/);
    if (parts.length < 2) return false;
    return parts.every((part) => /^[A-Za-z.'-]{2,}$/.test(part));
  }

  /**
   * Determine which search method was most successful
   */
  private determineSearchMethod(candidates: HiringManager[]): string {
    if (candidates.length === 0) return "none";

    const sources = candidates.map((c) => c.source);
    const sourceCounts = sources.reduce(
      (acc, source) => {
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Return most common source
    return Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0][0];
  }
}

// Singleton
let hiringManagerFinderAgent: HiringManagerFinderAgent | null = null;

export function getHiringManagerFinderAgent(): HiringManagerFinderAgent {
  if (!hiringManagerFinderAgent) {
    hiringManagerFinderAgent = new HiringManagerFinderAgent();
  }
  return hiringManagerFinderAgent;
}

export default getHiringManagerFinderAgent;
