type Fixture = {
  name: string;
  body: string;
};

const FIXTURES: Fixture[] = [
  {
    name: "default-structure",
    body: `BONNY MAKANIANKHONDO
312-966-9631
bmakaniankhondo@icstars.org
Chicago, IL 60625

March 3, 2026

Evolent Specialty Services, Inc
Attn: Hiring Manager
1300 17th Street North, Suite 1000
Arlington, VA 22209

Dear Hiring Manager,

I am writing to apply for the Software Engineer position at Evolent Specialty Services, Inc. Your mission to improve outcomes for complex health conditions strongly aligns with the type of software work I want to build.

As a Full-Stack Engineering Intern at i.c Stars, I collaborated across product and design to deliver a customer insight dashboard selected by United Airlines. I implemented role-based access control and AI-assisted recommendation workflows to support clear, role-specific decision making.

Before software, I worked in commercial insulation and as an electrical technician. That background shaped a practical, reliability-focused engineering mindset that I now apply to API design, database work, and maintainable implementation.

I would welcome the opportunity to discuss how my background and skills can contribute to your engineering team. Thank you for your time and consideration.

Sincerely,
BONNY MAKANIANKHONDO`,
  },
];

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function validateStructure(body: string): string[] {
  const issues: string[] = [];
  const normalized = (body || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return ["empty_body"];

  const lines = normalized.split("\n").map((line) => line.trim());
  const salutationIndex = lines.findIndex((line) => /^Dear\b/i.test(line));
  const signOffIndex = lines.findIndex((line) => /^(Sincerely|Best regards),?$/i.test(line));

  if (salutationIndex < 0) issues.push("missing_salutation");
  if (signOffIndex < 0) issues.push("missing_sign_off");
  if (salutationIndex >= 0 && signOffIndex >= 0 && signOffIndex <= salutationIndex) {
    issues.push("invalid_salutation_signoff_order");
  }

  if (signOffIndex >= 0) {
    const signatureLine = lines[signOffIndex + 1] || "";
    if (!signatureLine) issues.push("missing_signature_name");
  }

  const paragraphs = splitParagraphs(normalized);
  const salutationParagraphIndex = paragraphs.findIndex((paragraph) => /^Dear\b/i.test(paragraph));
  const signOffParagraphIndex = paragraphs.findIndex((paragraph) =>
    /^(Sincerely|Best regards),?\n?/i.test(paragraph),
  );

  if (salutationParagraphIndex < 0 || signOffParagraphIndex < 0) {
    issues.push("missing_required_sections");
    return issues;
  }

  const bodyParagraphCount = paragraphs
    .slice(salutationParagraphIndex + 1, signOffParagraphIndex)
    .filter(Boolean).length;
  if (bodyParagraphCount < 4) issues.push("body_paragraphs_less_than_4");

  const headerLinesBeforeSalutation = lines
    .slice(0, salutationIndex)
    .filter(Boolean).length;
  if (headerLinesBeforeSalutation < 7) issues.push("header_or_employer_block_too_short");

  return issues;
}

function main() {
  for (const fixture of FIXTURES) {
    const issues = validateStructure(fixture.body);
    console.log(JSON.stringify({ fixture: fixture.name, issues }, null, 0));
    if (issues.length > 0) {
      throw new Error(`${fixture.name} failed structure validation`);
    }
  }
}

main();
