import dotenv from "dotenv";
dotenv.config();

import getPrismaClient from "../src/database/client";

const prisma = getPrismaClient();

async function checkJobs() {
  const jobs = await prisma.job.findMany({ take: 5 });
  console.log("Jobs:", JSON.stringify(jobs, null, 2));
  await prisma.$disconnect();
}

checkJobs().catch(console.error);
