// test-skills-fix.ts
import { getResumeParserService } from "./src/services/resume-parser.service";
import { PrismaClient } from "@prisma/client";

async function testSkillsFix() {
  console.log("🧪 Testing Resume Skills Fix...\n");

  const prisma = new PrismaClient();

  try {
    // 1. Test parsing
    console.log("1️⃣ Testing resume parsing...");
    const parser = getResumeParserService();
    const parsed = await parser.parseResumeFile(
      "data/resumes/Bonny_Makaniankhondo_Full_Stack_Software_Engineer.pdf",
    );

    console.log("✅ Parsed skills summary:");
    console.log(`   Technical: ${parsed.skills.technical.length}`);
    console.log(`   Languages: ${parsed.skills.languages.length}`);
    console.log(`   Frameworks: ${parsed.skills.frameworks.length}`);
    console.log(`   Tools: ${parsed.skills.tools.length}`);
    console.log(`   Databases: ${parsed.skills.databases.length}`);
    console.log(`   Soft Skills: ${parsed.skills.soft.length}`);

    const allSkills = [
      ...parsed.skills.technical,
      ...parsed.skills.languages,
      ...parsed.skills.frameworks,
      ...parsed.skills.tools,
      ...parsed.skills.databases,
      ...parsed.skills.soft,
    ];

    console.log(`   Total: ${allSkills.length}`);
    console.log(`   Sample: ${allSkills.slice(0, 5).join(", ")}`);

    // 2. Test database query
    console.log("\n2️⃣ Testing database query...");
    const masterResume = await prisma.masterResume.findFirst({
      include: {
        skills: {
          include: { technologies: true },
        },
      },
    });

    if (masterResume) {
      console.log(`✅ Master Resume ID: ${masterResume.id}`);
      console.log(`✅ Skills in database: ${masterResume.skills.length}`);

      if (masterResume.skills.length > 0) {
        console.log("✅ Sample skills from database:");
        masterResume.skills.slice(0, 5).forEach((skill) => {
          console.log(`   - ${skill.name} (${skill.category})`);
        });
      } else {
        console.log(
          "❌ No skills found in database - need to upload with fixed code",
        );
      }
    }

    // 3. Test with resume repository
    console.log("\n3️⃣ Testing resume repository...");
    const {
      ResumeRepository,
    } = require("./src/database/repositories/resume.repository");
    const resumeRepo = new ResumeRepository(prisma);
    const repoResult = await resumeRepo.getMasterResume();

    if (repoResult) {
      console.log(`✅ Repository query skills: ${repoResult.skills.length}`);
    }
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n🎯 To test the fix:");
  console.log(
    "1. Upload your resume: npm run dev -- upload data/resumes/your-resume.pdf",
  );
  console.log("2. Check skills: npm run dev -- resume list");
  console.log("3. Add skills manually: npm run dev -- resume add-skill");
}

testSkillsFix().catch(console.error);
