import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { prisma } from "@resume-agent/shared/src/client.js";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
  }
}

export async function resumeRoutes(fastify: FastifyInstance) {
  // Get all resumes for user
  fastify.get(
    "/resumes",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const resumes = await prisma.masterResume.findMany({
        where: { userId: request.user.id },
        include: {
          experiences: { take: 3 },
          projects: { take: 2 },
          skills: { take: 5 },
        },
        orderBy: { updatedAt: "desc" },
      });

      return { resumes };
    },
  );

  // Get single resume
  fastify.get<{ Params: { id: string } }>(
    "/resumes/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const { id } = request.params;

      const resume = await prisma.masterResume.findFirst({
        where: { id, userId: request.user.id },
        include: {
          experiences: {
            include: { achievements: true, technologies: true },
            orderBy: { startDate: "desc" },
          },
          projects: {
            include: { technologies: true },
            orderBy: { startDate: "desc" },
          },
          skills: true,
          education: { orderBy: { startDate: "desc" } },
          certifications: { orderBy: { issueDate: "desc" } },
        },
      });

      if (!resume) {
        return reply.status(404).send({ message: "Resume not found" });
      }

      return { resume };
    },
  );

  // Upload resume (parse from file)
  fastify.post<{
    Body: {
      fileName: string;
      content: string;
      fullName?: string;
      email?: string;
    };
  }>(
    "/resumes/upload",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const { fileName, content, fullName, email } = request.body;

      // Save file to uploads directory
      const uploadsDir = join(process.cwd(), "data/uploads");
      try {
        mkdirSync(uploadsDir, { recursive: true });
      } catch (e) {
        // Directory may already exist
      }

      const filePath = join(uploadsDir, `${Date.now()}-${fileName}`);
      const buffer = Buffer.from(content, "base64");
      writeFileSync(filePath, buffer);

      // Create resume record (simplified - just stores basic info)
      const resume = await prisma.masterResume.create({
        data: {
          userId: request.user.id,
          fullName: fullName || "Unknown",
          email: email || "",
          phone: "",
          location: "",
          summaryShort: `Uploaded from ${fileName}`,
          summaryLong: "",
        },
      });

      return { resume, filePath };
    },
  );

  // Create empty resume
  fastify.post(
    "/resumes",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const data = request.body as any;

      const resume = await prisma.masterResume.create({
        data: {
          userId: request.user.id,
          fullName: data.fullName || "",
          email: data.email || "",
          phone: data.phone || "",
          location: data.location || "",
          summaryShort: data.summaryShort || "",
          summaryLong: data.summaryLong || "",
          linkedInUrl: data.linkedInUrl,
          githubUrl: data.githubUrl,
          portfolioUrl: data.portfolioUrl,
        },
      });

      return { resume };
    },
  );

  // Update resume
  fastify.put<{ Params: { id: string } }>(
    "/resumes/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const { id } = request.params;
      const data = request.body as any;

      const resume = await prisma.masterResume.updateMany({
        where: { id, userId: request.user.id },
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          location: data.location,
          summaryShort: data.summaryShort,
          summaryLong: data.summaryLong,
          linkedInUrl: data.linkedInUrl,
          githubUrl: data.githubUrl,
          portfolioUrl: data.portfolioUrl,
        },
      });

      if (resume.count === 0) {
        return reply.status(404).send({ message: "Resume not found" });
      }

      return { success: true };
    },
  );

  // Delete resume
  fastify.delete<{ Params: { id: string } }>(
    "/resumes/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const { id } = request.params;

      await prisma.masterResume.deleteMany({
        where: { id, userId: request.user.id },
      });

      return { success: true };
    },
  );

  // Add experience to resume
  fastify.post<{ Params: { resumeId: string } }>(
    "/resumes/:resumeId/experiences",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const { resumeId } = request.params;
      const data = request.body as any;

      const resume = await prisma.masterResume.findFirst({
        where: { id: resumeId, userId: request.user.id },
      });

      if (!resume) {
        return reply.status(404).send({ message: "Resume not found" });
      }

      const experience = await prisma.experience.create({
        data: {
          resumeId,
          company: data.company,
          title: data.jobTitle || data.title,
          location: data.location,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          current: data.isCurrentRole || data.current || false,
          description: data.description || "",
        },
      });

      return { experience };
    },
  );

  // Add project to resume
  fastify.post<{ Params: { resumeId: string } }>(
    "/resumes/:resumeId/projects",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const { resumeId } = request.params;
      const data = request.body as any;

      const resume = await prisma.masterResume.findFirst({
        where: { id: resumeId, userId: request.user.id },
      });

      if (!resume) {
        return reply.status(404).send({ message: "Resume not found" });
      }

      const project = await prisma.project.create({
        data: {
          resumeId,
          name: data.name,
          description: data.description || "",
          url: data.url,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
        },
      });

      return { project };
    },
  );

  // Add skill to resume
  fastify.post<{ Params: { resumeId: string } }>(
    "/resumes/:resumeId/skills",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: any, reply) => {
      const { resumeId } = request.params;
      const data = request.body as any;

      const resume = await prisma.masterResume.findFirst({
        where: { id: resumeId, userId: request.user.id },
      });

      if (!resume) {
        return reply.status(404).send({ message: "Resume not found" });
      }

      const skill = await prisma.skill.create({
        data: {
          resumeId,
          name: data.name,
          category: data.category || "technical",
          proficiency: data.proficiency || "intermediate",
        },
      });

      return { skill };
    },
  );
}
