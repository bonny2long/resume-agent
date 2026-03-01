import dotenv from "dotenv";
dotenv.config();

import getPrismaClient from "../src/database/client";

const prisma = getPrismaClient();

async function fixTechStackDuplicates() {
  console.log("=== Fixing TechStack duplicates ===\n");

  // Get all TechStacks
  const techStacks = await prisma.techStack.findMany();
  console.log(`Total TechStacks: ${techStacks.length}`);

  // Find case-insensitive duplicates
  const techLowerMap = new Map<string, typeof techStacks[0][]>();
  
  for (const tech of techStacks) {
    const lower = tech.name.toLowerCase();
    if (!techLowerMap.has(lower)) {
      techLowerMap.set(lower, []);
    }
    techLowerMap.get(lower)!.push(tech);
  }

  // For each duplicate group, keep the first one and delete the rest
  let deletedCount = 0;
  
  for (const [_, entries] of techLowerMap) {
    if (entries.length > 1) {
      console.log(`\nFound ${entries.length} duplicates for "${entries[0].name}":`);
      
      // Keep the first one (sorted alphabetically for consistency)
      const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
      const keep = sorted[0];
      const toDelete = sorted.slice(1);
      
      console.log(`  Keeping: "${keep.name}" (${keep.id})`);
      
      // Delete the others
      for (const del of toDelete) {
        console.log(`  Deleting: "${del.name}" (${del.id})`);
        await prisma.techStack.delete({ where: { id: del.id } });
        deletedCount++;
      }
    }
  }

  console.log(`\n✅ Deleted ${deletedCount} duplicate TechStack entries`);

  // Verify
  const remaining = await prisma.techStack.findMany();
  console.log(`Remaining TechStacks: ${remaining.length}`);

  await prisma.$disconnect();
}

fixTechStackDuplicates().catch(console.error);
