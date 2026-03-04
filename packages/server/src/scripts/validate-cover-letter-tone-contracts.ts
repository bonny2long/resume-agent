import {
  applyCoverLetterTonePostProcessing,
  assessCoverLetterTone,
  type CoverLetterTone,
} from "../services/cover-letter-tone.service.js";

const SAMPLE_BODY = `BONNY MAKANIANKHONDO
312-966-9631
bmakaniankhondo@icstars.org
Chicago, IL 60625

March 3, 2026

Evolent Specialty Services, Inc
Attn: Hiring Manager

Dear Hiring Manager,

I'm excited to apply for the Software Engineer position at Evolent Specialty Services, Inc. I value your mission and I'm ready to contribute to reliable software delivery.

At i.c Stars, I collaborated with product and design partners to deliver a full-stack dashboard selected by United Airlines. I implemented role-based access control and AI-driven insights for structured recommendations.

My background in industrial infrastructure strengthened my approach to disciplined execution and system reliability. I apply that same mindset to building maintainable software and effective team workflows.

Thank you for your time and consideration. I'd welcome the opportunity to discuss my fit for this role.

Sincerely,
BONNY MAKANIANKHONDO`;

function signatureForTone(tone: CoverLetterTone): string {
  const processed = applyCoverLetterTonePostProcessing(SAMPLE_BODY, tone);
  const assessment = assessCoverLetterTone(processed, tone);
  if (!assessment.passed) {
    throw new Error(
      `${tone} failed tone contract: ${assessment.issues.join(", ") || "unknown"}`,
    );
  }
  return `c${assessment.metrics.contractions}|e${assessment.metrics.exclamations}|h${assessment.metrics.enthusiasmWords}|f${assessment.metrics.friendlyWords}`;
}

function main() {
  const tones: CoverLetterTone[] = [
    "professional",
    "enthusiastic",
    "friendly",
    "formal",
  ];

  const signatures = tones.map((tone) => signatureForTone(tone));
  const unique = new Set(signatures);

  console.log(JSON.stringify({ signatures }, null, 0));

  if (unique.size !== tones.length) {
    throw new Error("Tone signatures are not distinct.");
  }
}

main();
