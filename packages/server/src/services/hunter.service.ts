// src/services/hunter.service.ts
import axios from "axios";
import config from "@/config";
import { logger } from "@/utils/logger";

export interface HunterEmailResult {
  email: string;
  score: number;
  firstName: string;
  lastName: string;
  position?: string;
  linkedin?: string;
  twitter?: string;
  phoneNumber?: string;
  sources: Array<{
    domain: string;
    uri: string;
    extracted_on: string;
  }>;
}

export interface HunterDomainSearchResult {
  emails: HunterEmailResult[];
  domain: string;
  organization: string;
}

export class HunterService {
  private apiKey: string;
  private baseUrl = "https://api.hunter.io/v2";
  private requestCount = 0;
  private monthlyLimit = config.contactFinder.hunter.monthlyLimit;

  constructor() {
    if (!config.contactFinder.hunter.apiKey) {
      throw new Error("Hunter.io API key not configured");
    }
    this.apiKey = config.contactFinder.hunter.apiKey;
  }

  /**
   * Find email by name and company domain
   */
  async findEmail(
    firstName: string,
    lastName: string,
    domain: string,
  ): Promise<HunterEmailResult | null> {
    if (!this.hasCreditsRemaining()) {
      logger.warn("Hunter.io monthly limit reached");
      return null;
    }

    try {
      logger.debug("Hunter.io: Finding email", { firstName, lastName, domain });

      const response = await axios.get(`${this.baseUrl}/email-finder`, {
        params: {
          domain,
          first_name: firstName,
          last_name: lastName,
          api_key: this.apiKey,
        },
      });

      this.requestCount++;

      if (response.data.data.email) {
        logger.success("Hunter.io: Email found", {
          email: response.data.data.email,
          score: response.data.data.score,
        });

        return {
          email: response.data.data.email,
          score: response.data.data.score,
          firstName: response.data.data.first_name,
          lastName: response.data.data.last_name,
          position: response.data.data.position,
          linkedin: response.data.data.linkedin,
          twitter: response.data.data.twitter,
          phoneNumber: response.data.data.phone_number,
          sources: response.data.data.sources || [],
        };
      }

      return null;
    } catch (error: any) {
      logger.error("Hunter.io error", error);
      return null;
    }
  }

  /**
   * Get all emails from a domain
   */
  async domainSearch(
    domain: string,
    limit: number = 10,
  ): Promise<HunterEmailResult[]> {
    if (!this.hasCreditsRemaining()) {
      logger.warn("Hunter.io monthly limit reached");
      return [];
    }

    try {
      logger.debug("Hunter.io: Searching domain", { domain, limit });

      const response = await axios.get(`${this.baseUrl}/domain-search`, {
        params: {
          domain,
          limit,
          api_key: this.apiKey,
        },
      });

      this.requestCount++;

      const emails = response.data.data.emails || [];
      logger.success(`Hunter.io: Found ${emails.length} emails`);

      return emails.map((e: any) => ({
        email: e.value,
        score: e.confidence,
        firstName: e.first_name,
        lastName: e.last_name,
        position: e.position,
        linkedin: e.linkedin,
        twitter: e.twitter,
        phoneNumber: e.phone_number,
        sources: e.sources || [],
      }));
    } catch (error: any) {
      logger.error("Hunter.io domain search error", error);
      return [];
    }
  }

  /**
   * Verify if an email is valid
   */
  async verifyEmail(email: string): Promise<{
    valid: boolean;
    score: number;
    disposable: boolean;
  }> {
    if (!this.hasCreditsRemaining()) {
      logger.warn("Hunter.io monthly limit reached");
      return { valid: false, score: 0, disposable: false };
    }

    try {
      logger.debug("Hunter.io: Verifying email", { email });

      const response = await axios.get(`${this.baseUrl}/email-verifier`, {
        params: {
          email,
          api_key: this.apiKey,
        },
      });

      this.requestCount++;

      return {
        valid: response.data.data.status === "valid",
        score: response.data.data.score,
        disposable: response.data.data.disposable,
      };
    } catch (error: any) {
      logger.error("Hunter.io email verification error", error);
      return { valid: false, score: 0, disposable: false };
    }
  }

  /**
   * Get account info and remaining credits
   */
  async getAccountInfo(): Promise<{
    requestsUsed: number;
    requestsAvailable: number;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/account`, {
        params: {
          api_key: this.apiKey,
        },
      });

      return {
        requestsUsed: response.data.data.requests.used,
        requestsAvailable: response.data.data.requests.available,
      };
    } catch (error: any) {
      logger.error("Hunter.io account info error", error);
      return {
        requestsUsed: this.requestCount,
        requestsAvailable: this.monthlyLimit - this.requestCount,
      };
    }
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
   * Reset monthly counter (call this at start of month)
   */
  resetMonthlyCount(): void {
    this.requestCount = 0;
    logger.info("Hunter.io: Monthly counter reset");
  }
}

// Singleton
let hunterService: HunterService | null = null;

export function getHunterService(): HunterService {
  if (!config.contactFinder.hunter.enabled) {
    throw new Error("Hunter.io is not enabled. Add HUNTER_API_KEY to .env");
  }

  if (!hunterService) {
    hunterService = new HunterService();
  }
  return hunterService;
}

export default getHunterService;
