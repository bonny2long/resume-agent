// src/services/contact-finder.service.ts
import { logger } from "@/utils/logger";
import { getHunterService } from "./hunter.service";
import { getApolloService } from "./apollo.service";
import { getRocketReachService } from "./rocketreach.service";
import config from "@/config";

export interface ContactResult {
  name: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  title?: string;
  company?: string;
  confidence: number; // 0-100
  source: "hunter" | "apollo" | "rocketreach" | "manual" | "scraped";
  verified: boolean;
}

export interface ContactFinderStats {
  hunter: { used: number; remaining: number; limit: number };
  apollo: { used: number; remaining: number; limit: number };
  rocketReach: { used: number; remaining: number; limit: number };
}

export type JobPriority = "low" | "medium" | "high";

export class ContactFinderService {
  private hunter =
    config.contactFinder.hunter.enabled ? getHunterService() : null;
  private apollo =
    config.contactFinder.apollo.enabled ? getApolloService() : null;
  private rocketReach =
    config.contactFinder.rocketReach.enabled ? getRocketReachService() : null;

  /**
   * Find hiring manager contact info using waterfall strategy
   */
  async findContact(
    params: {
      firstName?: string;
      lastName?: string;
      fullName?: string;
      company?: string;
      companyDomain?: string;
      title?: string;
      linkedinUrl?: string;
    },
    priority: JobPriority = "medium",
  ): Promise<ContactResult | null> {
    logger.header("Contact Finder - Waterfall Strategy");
    logger.info(`Job Priority: ${priority.toUpperCase()}`);

    // Parse full name if provided
    let firstName = params.firstName;
    let lastName = params.lastName;

    if (params.fullName && !firstName && !lastName) {
      const nameParts = params.fullName.trim().split(" ");
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(" ");
    }

    logger.item("Target", `${firstName} ${lastName} at ${params.company}`);

    // Tier 1: Try Apollo first (best balance of cost/quality)
    if (this.apollo && this.apollo.getRemainingCredits() > 0) {
      logger.section("Tier 1: Trying Apollo.io");
      const apolloResult = await this.tryApollo({
        firstName,
        lastName,
        company: params.company,
        domain: params.companyDomain,
        linkedinUrl: params.linkedinUrl,
      });

      if (apolloResult) {
        return apolloResult;
      }
    }

    // Tier 2: Try Hunter.io (good for emails)
    if (
      this.hunter &&
      this.hunter.getRemainingCredits() > 0 &&
      firstName &&
      lastName &&
      params.companyDomain
    ) {
      logger.section("Tier 2: Trying Hunter.io");
      const hunterResult = await this.tryHunter({
        firstName,
        lastName,
        domain: params.companyDomain,
      });

      if (hunterResult) {
        return hunterResult;
      }
    }

    // Tier 3: RocketReach (only for high priority jobs)
    if (
      priority === "high" &&
      this.rocketReach &&
      this.rocketReach.getRemainingCredits() > 0
    ) {
      logger.section("Tier 3: Trying RocketReach (HIGH PRIORITY)");
      const rocketResult = await this.tryRocketReach({
        name: params.fullName || `${firstName} ${lastName}`,
        company: params.company,
        linkedinUrl: params.linkedinUrl,
      });

      if (rocketResult) {
        return rocketResult;
      }
    }

    logger.warn("All contact finder methods exhausted");
    return null;
  }

  /**
   * Try Apollo.io
   */
  private async tryApollo(params: {
    firstName?: string;
    lastName?: string;
    company?: string;
    domain?: string;
    linkedinUrl?: string;
  }): Promise<ContactResult | null> {
    if (!this.apollo) return null;

    try {
      const result = await this.apollo.enrichPerson({
        firstName: params.firstName,
        lastName: params.lastName,
        organizationName: params.company,
        domain: params.domain,
        linkedinUrl: params.linkedinUrl,
      });

      if (result && result.email) {
        logger.success("✓ Apollo.io found contact!", {
          email: result.email,
          phone: result.phoneNumbers?.[0]?.rawNumber,
        });

        return {
          name: result.name,
          email: result.email,
          phone: result.phoneNumbers?.[0]?.rawNumber,
          linkedinUrl: result.linkedinUrl,
          title: result.title,
          company: result.organizationName,
          confidence: 85,
          source: "apollo",
          verified: true,
        };
      }

      logger.warn("Apollo.io: No results");
      return null;
    } catch (error) {
      logger.error("Apollo.io error", error);
      return null;
    }
  }

  /**
   * Try Hunter.io
   */
  private async tryHunter(params: {
    firstName: string;
    lastName: string;
    domain: string;
  }): Promise<ContactResult | null> {
    if (!this.hunter) return null;

    try {
      const result = await this.hunter.findEmail(
        params.firstName,
        params.lastName,
        params.domain,
      );

      if (result && result.email) {
        logger.success("✓ Hunter.io found email!", {
          email: result.email,
          score: result.score,
        });

        return {
          name: `${result.firstName} ${result.lastName}`,
          email: result.email,
          phone: result.phoneNumber,
          linkedinUrl: result.linkedin,
          title: result.position,
          company: undefined,
          confidence: result.score,
          source: "hunter",
          verified: result.score > 70,
        };
      }

      logger.warn("Hunter.io: No results");
      return null;
    } catch (error) {
      logger.error("Hunter.io error", error);
      return null;
    }
  }

  /**
   * Try RocketReach (premium)
   */
  private async tryRocketReach(params: {
    name: string;
    company?: string;
    linkedinUrl?: string;
  }): Promise<ContactResult | null> {
    if (!this.rocketReach) return null;

    try {
      const result = await this.rocketReach.lookupPerson({
        name: params.name,
        currentEmployer: params.company,
        linkedinUrl: params.linkedinUrl,
      });

      if (result && result.emails.length > 0) {
        logger.success("✓ RocketReach found contact! (PREMIUM)", {
          email: result.emails[0],
          phones: result.phones.length,
          creditsRemaining: this.rocketReach.getRemainingCredits(),
        });

        return {
          name: result.name,
          email: result.emails[0],
          phone: result.phones[0],
          linkedinUrl: result.linkedinUrl || params.linkedinUrl,
          title: result.currentTitle,
          company: result.currentEmployer,
          confidence: 95, // RocketReach is most accurate
          source: "rocketreach",
          verified: true,
        };
      }

      logger.warn("RocketReach: No results");
      return null;
    } catch (error) {
      logger.error("RocketReach error", error);
      return null;
    }
  }

  /**
   * Get usage statistics for all services
   */
  getStats(): ContactFinderStats {
    return {
      hunter:
        this.hunter ?
          {
            used:
              config.contactFinder.hunter.monthlyLimit -
              this.hunter.getRemainingCredits(),
            remaining: this.hunter.getRemainingCredits(),
            limit: config.contactFinder.hunter.monthlyLimit,
          }
        : { used: 0, remaining: 0, limit: 0 },
      apollo:
        this.apollo ?
          {
            used:
              config.contactFinder.apollo.monthlyLimit -
              this.apollo.getRemainingCredits(),
            remaining: this.apollo.getRemainingCredits(),
            limit: config.contactFinder.apollo.monthlyLimit,
          }
        : { used: 0, remaining: 0, limit: 0 },
      rocketReach:
        this.rocketReach ?
          {
            used:
              config.contactFinder.rocketReach.monthlyLimit -
              this.rocketReach.getRemainingCredits(),
            remaining: this.rocketReach.getRemainingCredits(),
            limit: config.contactFinder.rocketReach.monthlyLimit,
          }
        : { used: 0, remaining: 0, limit: 0 },
    };
  }

  /**
   * Display usage stats
   */
  displayStats(): void {
    const stats = this.getStats();

    logger.header("Contact Finder API Usage");

    logger.section("Hunter.io (Email Finding)");
    logger.item("Used", `${stats.hunter.used}/${stats.hunter.limit}`);
    logger.item("Remaining", stats.hunter.remaining.toString());

    logger.section("Apollo.io (Contact Enrichment)");
    logger.item("Used", `${stats.apollo.used}/${stats.apollo.limit}`);
    logger.item("Remaining", stats.apollo.remaining.toString());

    logger.section("RocketReach (Premium)");
    logger.item("Used", `${stats.rocketReach.used}/${stats.rocketReach.limit}`);
    logger.item("Remaining", `${stats.rocketReach.remaining} ⭐`);

    if (stats.rocketReach.remaining === 0) {
      logger.warn(
        "⚠️  RocketReach credits exhausted! Will skip premium lookups.",
      );
    }
  }

  /**
   * Determine recommended service based on remaining credits
   */
  getRecommendedService(): "hunter" | "apollo" | "rocketreach" | null {
    const stats = this.getStats();

    if (stats.apollo.remaining > stats.hunter.remaining) {
      return "apollo";
    } else if (stats.hunter.remaining > 0) {
      return "hunter";
    } else if (stats.rocketReach.remaining > 0) {
      return "rocketreach";
    }

    return null;
  }
}

// Singleton
let contactFinderService: ContactFinderService | null = null;

export function getContactFinderService(): ContactFinderService {
  if (!contactFinderService) {
    contactFinderService = new ContactFinderService();
  }
  return contactFinderService;
}

export default getContactFinderService;
