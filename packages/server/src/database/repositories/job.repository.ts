// src/database/repositories/job.repository.ts
import getPrismaClient from "@/database/client";
import { Job, Company } from "@prisma/client";

export class JobRepository {
  private prisma = getPrismaClient();

  /**
   * Create or update a company
   */
  async upsertCompany(data: {
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
    founded?: number;
    headquarters?: string;
    values?: string[];
    workStyle?: string[];
    benefits?: string[];
    techStack?: string[];
    recentNews?: any;
  }): Promise<Company> {
    return await this.prisma.company.upsert({
      where: { name: data.name },
      create: data,
      update: {
        ...data,
        lastResearched: new Date(),
      },
    });
  }

  /**
   * Create or update a job posting (prevents duplicates)
   */
  async createJob(data: {
    companyId: string;
    title: string;
    url?: string;
    location: string;
    salary?: string;
    postedDate?: Date;
    rawDescription: string;
    requiredSkills: string[];
    preferredSkills: string[];
    responsibilities: string[];
    qualifications: string[];
    keywords: string[];
    skillsMatch?: number;
    experienceLevel?: string;
  }): Promise<Job> {
    // Handle null companyId case (create a placeholder company if needed)
    let companyId = data.companyId;
    if (!companyId) {
      // Create a placeholder company for unknown companies
      const placeholderCompany = await this.prisma.company.create({
        data: {
          name: "Unknown Company",
          domain: "",
          industry: "Unknown",
          size: "Unknown",
          headquarters: "Unknown",
          values: [],
          workStyle: [],
          benefits: [],
          techStack: [],
        },
      });
      companyId = placeholderCompany.id;
    }

    return await this.prisma.job.upsert({
      where: {
        companyId_title: {
          companyId,
          title: data.title,
        },
      },
      create: {
        ...data,
        companyId,
      },
      update: {
        ...data,
        companyId,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get job by ID
   */
  async getJobById(id: string): Promise<Job | null> {
    return await this.prisma.job.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });
  }

  /**
   * Get all jobs
   */
  async getAllJobs(): Promise<Job[]> {
    return await this.prisma.job.findMany({
      include: {
        company: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Search jobs by company name
   */
  async searchJobsByCompany(companyName: string): Promise<Job[]> {
    return await this.prisma.job.findMany({
      where: {
        company: {
          name: {
            contains: companyName,
            mode: "insensitive",
          },
        },
      },
      include: {
        company: true,
      },
    });
  }

  /**
   * Update job match score
   */
  async updateJobMatchScore(jobId: string, score: number): Promise<Job> {
    return await this.prisma.job.update({
      where: { id: jobId },
      data: { skillsMatch: score },
    });
  }

  /**
   * Get company by name
   */
  async getCompanyByName(name: string): Promise<Company | null> {
    return await this.prisma.company.findUnique({
      where: { name },
    });
  }

  /**
   * Get or create company
   */
  async getOrCreateCompany(name: string): Promise<Company> {
    let company = await this.getCompanyByName(name);

    if (!company) {
      company = await this.prisma.company.create({
        data: {
          name,
          values: [],
          workStyle: [],
          benefits: [],
          techStack: [],
        },
      });
    }

    return company;
  }

  /**
   * Delete job
   */
  async deleteJob(id: string): Promise<void> {
    await this.prisma.job.delete({
      where: { id },
    });
  }

  /**
   * Delete all jobs (and orphaned companies)
   */
  async deleteAllJobs(): Promise<void> {
    // First delete all jobs (this will cascade delete from applications)
    await this.prisma.job.deleteMany({});

    // Optionally clean up companies that have no jobs
    const companiesWithNoJobs = await this.prisma.company.findMany({
      where: {
        jobs: {
          none: {},
        },
      },
    });

    if (companiesWithNoJobs.length > 0) {
      await this.prisma.company.deleteMany({
        where: {
          id: {
            in: companiesWithNoJobs.map((c) => c.id),
          },
        },
      });
    }
  }

  /**
   * Get recent jobs
   */
  async getRecentJobs(limit: number = 10): Promise<Job[]> {
    return await this.prisma.job.findMany({
      include: {
        company: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  }
}

// Singleton
let jobRepository: JobRepository | null = null;

export function getJobRepository(): JobRepository {
  if (!jobRepository) {
    jobRepository = new JobRepository();
  }
  return jobRepository;
}

export default getJobRepository;
