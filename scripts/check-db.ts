import dotenv from "dotenv";
dotenv.config();

import getPrismaClient from "../src/database/client";

const prisma = getPrismaClient();

async function checkOrphans() {
  console.log("=== Checking for orphaned records ===\n");

  // Get master resume
  const masterResume = await prisma.masterResume.findFirst();
  
  if (!masterResume) {
    console.log("No master resume found. Database is empty.");
    return;
  }

  console.log(`Master Resume: ${masterResume.fullName} (${masterResume.id})`);

  // Check skills
  const skills = await prisma.skill.findMany({
    where: { resumeId: masterResume.id },
  });
  
  // Check for case-insensitive duplicates
  const skillLowerMap = new Map<string, number>();
  for (const skill of skills) {
    const lower = skill.name.toLowerCase();
    skillLowerMap.set(lower, (skillLowerMap.get(lower) || 0) + 1);
  }
  
  const duplicates = Array.from(skillLowerMap.entries()).filter(([_, count]) => count > 1);
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Found ${duplicates.length} case-insensitive skill duplicates:`);
    duplicates.slice(0, 5).forEach(([name, count]) => {
      console.log(`   - "${name}": ${count} occurrences`);
    });
  } else {
    console.log("\n✅ No skill duplicates found");
  }

  // Check TechStack for duplicates
  const techStacks = await prisma.techStack.findMany();
  const techLowerMap = new Map<string, number>();
  for (const tech of techStacks) {
    const lower = tech.name.toLowerCase();
    techLowerMap.set(lower, (techLowerMap.get(lower) || 0) + 1);
  }
  
  const techDuplicates = Array.from(techLowerMap.entries()).filter(([_, count]) => count > 1);
  
  if (techDuplicates.length > 0) {
    console.log(`\n⚠️  Found ${techDuplicates.length} case-insensitive TechStack duplicates:`);
    techDuplicates.slice(0, 5).forEach(([name, count]) => {
      console.log(`   - "${name}": ${count} occurrences`);
    });
  } else {
    console.log("✅ No TechStack duplicates found");
  }

  // Check for orphaned quantified achievements
  const quantAchievements = await prisma.quantifiedAchievement.findMany();
  console.log(`\n📊 Quantified Achievements: ${quantAchievements.length}`);

  // Check for orphaned enhanced summaries
  const enhancedSummaries = await prisma.enhancedSummary.findMany();
  console.log(`📝 Enhanced Summaries: ${enhancedSummaries.length}`);

  // Check for orphaned ATS analyses
  const atsAnalyses = await prisma.aTSAnalysis.findMany();
  console.log(`🔍 ATS Analyses: ${atsAnalyses.length}`);

  // Check for orphaned STAR stories
  const starStories = await prisma.sTARStory.findMany();
  console.log(`⭐ STAR Stories: ${starStories.length}`);

  console.log("\n=== Summary ===");
  console.log(`Total Skills: ${skills.length}`);
  console.log(`Total TechStacks: ${techStacks.length}`);

  await prisma.$disconnect();
}

checkOrphans().catch(console.error);
