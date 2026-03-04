import { prisma } from "@resume-agent/shared/src/client.js";

type SnapshotExperience = {
  bullets?: unknown;
};

type Snapshot = {
  experiences?: unknown;
};

type ResumeData = {
  uploadSnapshot?: Snapshot;
};

async function main() {
  const resumes = await prisma.masterResume.findMany({
    take: 12,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      createdAt: true,
      resumeData: true,
    },
  });

  let totalResumesWithSnapshot = 0;
  let totalExperiences = 0;
  let experiencesWithBullets = 0;

  for (const resume of resumes) {
    const data = ((resume.resumeData || {}) as ResumeData);
    const snapshot = (data.uploadSnapshot || {}) as Snapshot;
    const experiences = Array.isArray(snapshot.experiences)
      ? (snapshot.experiences as SnapshotExperience[])
      : [];

    if (experiences.length > 0) totalResumesWithSnapshot += 1;

    const bulletCounts = experiences.map((exp) =>
      Array.isArray(exp?.bullets) ? exp.bullets.length : 0,
    );
    const withBullets = bulletCounts.filter((count) => count > 0).length;

    totalExperiences += experiences.length;
    experiencesWithBullets += withBullets;

    console.log(
      JSON.stringify({
        id: resume.id,
        name: resume.fullName,
        createdAt: resume.createdAt.toISOString(),
        experiences: experiences.length,
        bulletCounts,
      }),
    );
  }

  const coverage = totalExperiences > 0
    ? Number((experiencesWithBullets / totalExperiences).toFixed(3))
    : 0;

  console.log(
    JSON.stringify({
      summary: {
        resumesChecked: resumes.length,
        resumesWithSnapshotExperiences: totalResumesWithSnapshot,
        totalExperiences,
        experiencesWithBullets,
        bulletCoverage: coverage,
      },
    }),
  );

  if (totalExperiences > 0 && experiencesWithBullets === 0) {
    throw new Error("No snapshot experiences contain bullets.");
  }
}

main()
  .catch((error) => {
    console.error("validate-upload-bullets failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
