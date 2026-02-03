// src/services/rocketreach.service.ts
import axios from "axios";
import config from "@/config";
import { logger } from "@/utils/logger";

export interface RocketReachContact {
  id: number;
  name: string;
  currentTitle?: string;
  currentEmployer?: string;
  linkedinUrl?: string;
  emails?: Array<{
    email: string;
    type: string;
    status: string;
  }>;
  phones?: Array<{
    number: string;
    type: string;
  }>;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface RocketReachLookupResult {
  id: number;
  name: string;
  currentTitle?: string;
  currentEmployer?: string;
  linkedinUrl?: string;
  emails: string[];
  phones: string[];
  location?: string;
  profiles: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
}

export class RocketReachService {
  private apiKey: string;
  private baseUrl = "https://api.rocketreach.co/v2/api";
  private requestCount = 0;
  private monthlyLimit = config.contactFinder.rocketReach.monthlyLimit;

  constructor() {
    if (!config.contactFinder.rocketReach.apiKey) {
      throw new Error("RocketReach API key not configured");
    }
    this.apiKey = config.contactFinder.rocketReach.apiKey;
  }

  /**
   * Lookup person by name and company (USES 1 CREDIT)
   */
  async lookupPerson(params: {
    name?: string;
    currentEmployer?: string;
    linkedinUrl?: string;
  }): Promise<RocketReachLookupResult | null> {
    if (!this.hasCreditsRemaining()) {
      logger.warn("RocketReach monthly limit reached (5/month)");
      return null;
    }

    try {
      logger.debug("RocketReach: Looking up person", params);

      const response = await axios.post(
        `${this.baseUrl}/lookupProfile`,
        {
          name: params.name,
          current_employer: params.currentEmployer,
          li_url: params.linkedinUrl,
        },
        {
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
        },
      );

      this.requestCount++;

      if (response.data) {
        const data = response.data;
        const result: RocketReachLookupResult = {
          id: data.id,
          name: data.name,
          currentTitle: data.current_title,
          currentEmployer: data.current_employer,
          linkedinUrl: data.linkedin_url,
          emails: data.emails?.map((e: any) => e.email) || [],
          phones: data.phones?.map((p: any) => p.number) || [],
          location: data.location,
          profiles: {
            linkedin: data.linkedin_url,
            twitter: data.twitter_url,
            facebook: data.facebook_url,
          },
        };

        logger.success("RocketReach: Person found", {
          name: result.name,
          emails: result.emails.length,
          phones: result.phones.length,
          creditsRemaining: this.getRemainingCredits(),
        });

        return result;
      }

      return null;
    } catch (error: any) {
      logger.error(
        "RocketReach lookup error",
        error.response?.data || error.message,
      );
      return null;
    }
  }

  /**
   * Search for people (USES 1 CREDIT PER RESULT)
   */
  async searchPeople(params: {
    name?: string;
    currentTitle?: string[];
    currentEmployer?: string[];
    location?: string[];
    keyword?: string;
    pageSize?: number;
  }): Promise<RocketReachContact[]> {
    if (!this.hasCreditsRemaining()) {
      logger.warn("RocketReach monthly limit reached (5/month)");
      return [];
    }

    try {
      logger.debug("RocketReach: Searching people", params);

      const response = await axios.post(
        `${this.baseUrl}/search`,
        {
          query: {
            name: params.name ? [params.name] : undefined,
            current_title: params.currentTitle,
            current_employer: params.currentEmployer,
            location: params.location,
            keyword: params.keyword,
          },
          page_size: Math.min(params.pageSize || 5, this.getRemainingCredits()),
          start: 1,
        },
        {
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
        },
      );

      // Each result uses a credit
      const resultsCount = response.data.profiles?.length || 0;
      this.requestCount += resultsCount;

      const profiles = response.data.profiles || [];
      logger.success(`RocketReach: Found ${profiles.length} people`, {
        creditsUsed: resultsCount,
        creditsRemaining: this.getRemainingCredits(),
      });

      return profiles.map((p: any) => this.mapToContact(p));
    } catch (error: any) {
      logger.error(
        "RocketReach search error",
        error.response?.data || error.message,
      );
      return [];
    }
  }

  /**
   * Verify email (doesn't use credits)
   */
  async verifyEmail(email: string): Promise<{
    valid: boolean;
    status: string;
  }> {
    try {
      logger.debug("RocketReach: Verifying email", { email });

      const response = await axios.post(
        `${this.baseUrl}/verifyEmail`,
        { email },
        {
          headers: {
            "Api-Key": this.apiKey,
            "Content-Type": "application/json",
          },
        },
      );

      return {
        valid: response.data.status === "valid",
        status: response.data.status,
      };
    } catch (error: any) {
      logger.error("RocketReach email verification error", error);
      return { valid: false, status: "unknown" };
    }
  }

  /**
   * Map RocketReach API response to our format
   */
  private mapToContact(data: any): RocketReachContact {
    return {
      id: data.id,
      name: data.name,
      currentTitle: data.current_title,
      currentEmployer: data.current_employer,
      linkedinUrl: data.linkedin_url,
      emails: data.emails?.map((e: any) => ({
        email: e.email,
        type: e.type,
        status: e.status,
      })),
      phones: data.phones?.map((p: any) => ({
        number: p.number,
        type: p.type,
      })),
      location: data.location,
      city: data.city,
      state: data.state,
      country: data.country,
    };
  }

  /**
   * Check if we have credits remaining
   */
  private hasCreditsRemaining(): boolean {
    return this.requestCount < this.monthlyLimit;
  }

  /**
   * Get remaining credits
   */
  getRemainingCredits(): number {
    return Math.max(0, this.monthlyLimit - this.requestCount);
  }

  /**
   * Reset monthly counter
   */
  resetMonthlyCount(): void {
    this.requestCount = 0;
    logger.info("RocketReach: Monthly counter reset");
  }

  /**
   * Get usage stats
   */
  getUsageStats() {
    return {
      used: this.requestCount,
      remaining: this.getRemainingCredits(),
      limit: this.monthlyLimit,
      percentUsed: (this.requestCount / this.monthlyLimit) * 100,
    };
  }
}

// Singleton
let rocketReachService: RocketReachService | null = null;

export function getRocketReachService(): RocketReachService {
  if (!config.contactFinder.rocketReach.enabled) {
    throw new Error(
      "RocketReach is not enabled. Add ROCKETREACH_API_KEY to .env",
    );
  }

  if (!rocketReachService) {
    rocketReachService = new RocketReachService();
  }
  return rocketReachService;
}

export default getRocketReachService;
