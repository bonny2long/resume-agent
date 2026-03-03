// src/database/repositories/application.repository.ts
import getPrismaClient from "@/database/client";
import { Prisma } from "@prisma/client";

export interface ApplicationWithRelations {
  id: string;
  jobId: string;
  status: string;
  appliedAt: Date | null;
  resumePath: string | null;
  coverLetterPath: string | null;
  hiringManagerId: string | null;
  linkedInSent: boolean;
  linkedInSentAt: Date | null;
  responded: boolean;
  respondedAt: Date | null;
  interviewDate: Date | null;
  notes: string | null;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  job: {
    id: string;
    title: string;
    location: string;
    skillsMatch: number | null;
    company: {
      name: string;
    };
  };
  hiringManager: {
    name: string;
    linkedInUrl: string | null;
  } | null;
}

export interface ApplicationFilter {
  status?: string;
  responded?: boolean;
  hasHiringManager?: boolean;
}

export interface ApplicationStats {
  total: number;
  byStatus: Record<string, number>;
  responseRate: number;
  averageMatchScore: number;
  needsFollowUp: number;
}

export class ApplicationRepository {
  private prisma = getPrismaClient();

  /**
   * Get all applications with relations
   */
  async findAll(
    filter?: ApplicationFilter,
  ): Promise<ApplicationWithRelations[]> {
    const where: Prisma.ApplicationWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.responded !== undefined) {
      where.responded = filter.responded;
    }

    if (filter?.hasHiringManager !== undefined) {
      where.hiringManagerId = filter.hasHiringManager ? { not: null } : null;
    }

    return this.prisma.application.findMany({
      where,
      include: {
        job: {
          include: {
            company: {
              select: {
                name: true,
              },
            },
          },
        },
        hiringManager: {
          select: {
            name: true,
            linkedInUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }) as any;
  }

  /**
   * Get application by ID with relations
   */
  async findById(id: string): Promise<ApplicationWithRelations | null> {
    return this.prisma.application.findUnique({
      where: { id },
      include: {
        job: {
          include: {
            company: {
              select: {
                name: true,
              },
            },
          },
        },
        hiringManager: {
          select: {
            name: true,
            title: true,
            linkedInUrl: true,
            email: true,
          },
        },
      },
    }) as any;
  }

  /**
   * Update application status
   */
  async updateStatus(id: string, status: string): Promise<void> {
    const updateData: Prisma.ApplicationUpdateInput = {
      status,
      updatedAt: new Date(),
    };

    // Auto-set appliedAt when status changes to "applied"
    if (status === "applied") {
      updateData.appliedAt = new Date();
    }

    await this.prisma.application.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update application with custom data
   */
  async update(
    id: string,
    data: Partial<{
      status: string;
      appliedAt: Date;
      responded: boolean;
      respondedAt: Date;
      interviewDate: Date;
      notes: string;
      followUpDate: Date;
      linkedInSent: boolean;
      linkedInSentAt: Date;
    }>,
  ): Promise<void> {
    await this.prisma.application.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Add note to application
   */
  async addNote(id: string, note: string): Promise<void> {
    const existing = await this.prisma.application.findUnique({
      where: { id },
      select: { notes: true },
    });

    const newNotes =
      existing?.notes ?
        `${existing.notes}\n\n---\n${new Date().toLocaleDateString()}: ${note}`
      : `${new Date().toLocaleDateString()}: ${note}`;

    await this.prisma.application.update({
      where: { id },
      data: {
        notes: newNotes,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get application statistics
   */
  async getStats(): Promise<ApplicationStats> {
    const applications = await this.prisma.application.findMany({
      include: {
        job: {
          select: {
            skillsMatch: true,
          },
        },
      },
    });

    const total = applications.length;

    // Count by status
    const byStatus = applications.reduce(
      (acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate response rate
    const responded = applications.filter((app) => app.responded).length;
    const responseRate = total > 0 ? (responded / total) * 100 : 0;

    // Calculate average match score
    const matchScores = applications
      .map((app) => app.job.skillsMatch)
      .filter((score): score is number => score !== null);
    const averageMatchScore =
      matchScores.length > 0 ?
        matchScores.reduce((sum, score) => sum + score, 0) / matchScores.length
      : 0;

    // Count applications needing follow-up
    const now = new Date();
    const needsFollowUp = applications.filter(
      (app) =>
        app.followUpDate &&
        new Date(app.followUpDate) <= now &&
        !app.responded &&
        app.status !== "rejected",
    ).length;

    return {
      total,
      byStatus,
      responseRate,
      averageMatchScore,
      needsFollowUp,
    };
  }

  /**
   * Get applications needing follow-up
   */
  async getNeedingFollowUp(): Promise<ApplicationWithRelations[]> {
    const now = new Date();

    return this.prisma.application.findMany({
      where: {
        followUpDate: {
          lte: now,
        },
        responded: false,
        status: {
          not: "rejected",
        },
      },
      include: {
        job: {
          include: {
            company: {
              select: {
                name: true,
              },
            },
          },
        },
        hiringManager: {
          select: {
            name: true,
            linkedInUrl: true,
          },
        },
      },
      orderBy: {
        followUpDate: "asc",
      },
    }) as any;
  }

  /**
   * Delete application
   */
  async delete(id: string): Promise<void> {
    await this.prisma.application.delete({
      where: { id },
    });
  }
}

// Singleton
let applicationRepository: ApplicationRepository | null = null;

export function getApplicationRepository(): ApplicationRepository {
  if (!applicationRepository) {
    applicationRepository = new ApplicationRepository();
  }
  return applicationRepository;
}

export default getApplicationRepository;
