import dotenv from "dotenv";
dotenv.config();

import getPrismaClient from "../src/database/client";

const prisma = getPrismaClient();

async function listTables() {
  const result = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log("Tables:", JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

listTables().catch(console.error);
