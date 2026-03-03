// src/services/apollo.service.ts
import axios from "axios";
import config from "@/config";
import { logger } from "@/utils/logger";

export interface ApolloContact {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  linkedinUrl?: string;
  title?: string;
  email?: string;
  phoneNumbers?: Array<{
    rawNumber: string;
    sanitizedNumber: string;
    type: string;
  }>;
  organizationName?: string;
  headline?: string;
  photoUrl?: string;
  employmentHistory?: Array<{
    title: string;
    companyName: string;
    startDate?: string;
    endDate?: string;
    current: boolean;
  }>;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  foundedYear?: number;
}

export class ApolloService {
  private apiKey: string;
  private baseUrl = "https://api.apollo.io/v1";
  private requestCount = 0;
  private monthlyLimit = config.contactFinder.apollo.monthlyLimit;

  constructor() {
    if (!config.contactFinder.apollo.apiKey) {
      throw new Error("Apollo.io API key not configured");
    }
    this.apiKey = config.contactFinder.apollo.apiKey;
  }

  /**
   * Search for people by name and company
   */
  async searchPeople(params: {
    personName?: string;
    firstName?: string;
    lastName?: string;
    organizationName?: string;
    personTitles?: string[];
    personLocations?: string[];
  }): Promise<ApolloContact[]> {
    if (!this.hasCreditsRemaining()) {
      logger.warn("Apollo.io monthly limit reached");
      return [];
    }

    try {
      logger.debug("Apollo.io: Searching people", params);

      const searchParams: any = {
        api_key: this.apiKey,
        page: 1,
        per_page: 10,
      };

      if (params.personName) {
        searchParams.q_keywords = params.personName;
      }
      if (params.firstName) {
        searchParams.person_first_name = params.firstName;
      }
      if (params.lastName) {
        searchParams.person_last_name = params.lastName;
      }
      if (params.organizationName) {
        searchParams.organization_names = [params.organizationName];
      }
      if (params.personTitles && params.personTitles.length > 0) {
        searchParams.person_titles = params.personTitles;
      }
      if (params.personLocations && params.personLocations.length > 0) {
        searchParams.person_locations = params.personLocations;
      }

      const response = await axios.post(
        `${this.baseUrl}/mixed_people/search`,
        searchParams,
      );

      this.requestCount++;

      const people = response.data.people || [];
      logger.success(`Apollo.io: Found ${people.length} people`);

      return people.map((p: any) => this.mapToPerson(p));
    } catch (error: any) {
      logger.error(
        "Apollo.io search error",
        error.response?.data || error.message,
      );
      return [];
    }
  }

  /**
   * Enrich a person with email and phone
   */
  async enrichPerson(params: {
    firstName?: string;
    lastName?: string;
    organizationName?: string;
    domain?: string;
    linkedinUrl?: string;
  }): Promise<ApolloContact | null> {
    if (!this.hasCreditsRemaining()) {
      logger.warn("Apollo.io monthly limit reached");
      return null;
    }

    try {
      logger.debug("Apollo.io: Enriching person", params);

      const response = await axios.post(`${this.baseUrl}/people/match`, {
        api_key: this.apiKey,
        first_name: params.firstName,
        last_name: params.lastName,
        organization_name: params.organizationName,
        domain: params.domain,
        linkedin_url: params.linkedinUrl,
        reveal_personal_emails: true,
        reveal_phone_number: true,
      });

      this.requestCount++;

      if (response.data.person) {
        const person = this.mapToPerson(response.data.person);
        logger.success("Apollo.io: Person enriched", {
          name: person.name,
          email: person.email,
          phone: person.phoneNumbers?.[0]?.rawNumber,
        });
        return person;
      }

      return null;
    } catch (error: any) {
      logger.error(
        "Apollo.io enrich error",
        error.response?.data || error.message,
      );
      return null;
    }
  }

  /**
   * Search for organizations
   */
  async searchOrganizations(params: {
    organizationName?: string;
    domain?: string;
  }): Promise<ApolloOrganization[]> {
    if (!this.hasCreditsRemaining()) {
      logger.warn("Apollo.io monthly limit reached");
      return [];
    }

    try {
      logger.debug("Apollo.io: Searching organizations", params);

      const response = await axios.post(
        `${this.baseUrl}/organizations/search`,
        {
          api_key: this.apiKey,
          q_organization_name: params.organizationName,
          q_organization_domains: params.domain ? [params.domain] : undefined,
          page: 1,
          per_page: 10,
        },
      );

      this.requestCount++;

      const orgs = response.data.organizations || [];
      logger.success(`Apollo.io: Found ${orgs.length} organizations`);

      return orgs.map((o: any) => this.mapToOrganization(o));
    } catch (error: any) {
      logger.error(
        "Apollo.io organization search error",
        error.response?.data || error.message,
      );
      return [];
    }
  }

  /**
   * Map Apollo API person response to our format
   */
  private mapToPerson(data: any): ApolloContact {
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      name: data.name,
      linkedinUrl: data.linkedin_url,
      title: data.title,
      email: data.email,
      phoneNumbers: data.phone_numbers?.map((p: any) => ({
        rawNumber: p.raw_number,
        sanitizedNumber: p.sanitized_number,
        type: p.type,
      })),
      organizationName: data.organization?.name,
      headline: data.headline,
      photoUrl: data.photo_url,
      employmentHistory: data.employment_history?.map((e: any) => ({
        title: e.title,
        companyName: e.organization_name,
        startDate: e.start_date,
        endDate: e.end_date,
        current: e.current,
      })),
    };
  }

  /**
   * Map Apollo API organization response to our format
   */
  private mapToOrganization(data: any): ApolloOrganization {
    return {
      id: data.id,
      name: data.name,
      websiteUrl: data.website_url,
      linkedinUrl: data.linkedin_url,
      domain: data.primary_domain,
      industry: data.industry,
      employeeCount: data.estimated_num_employees,
      foundedYear: data.founded_year,
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
    logger.info("Apollo.io: Monthly counter reset");
  }
}

// Singleton
let apolloService: ApolloService | null = null;

export function getApolloService(): ApolloService {
  if (!config.contactFinder.apollo.enabled) {
    throw new Error("Apollo.io is not enabled. Add APOLLO_API_KEY to .env");
  }

  if (!apolloService) {
    apolloService = new ApolloService();
  }
  return apolloService;
}

export default getApolloService;
