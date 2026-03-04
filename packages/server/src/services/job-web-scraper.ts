export interface ScrapedJobPosting {
  sourceUrl: string;
  title?: string;
  company?: string;
  location?: string;
  description: string;
}

function decodeHtmlEntities(input: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " ",
    ndash: "-",
    mdash: "-",
    rsquo: "'",
    lsquo: "'",
    ldquo: "\"",
    rdquo: "\"",
    hellip: "...",
  };

  return (input || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    const key = entity.toLowerCase();
    if (key.startsWith("#x")) {
      const code = parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    }
    if (key.startsWith("#")) {
      const code = parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    }
    return namedEntities[key] ?? "";
  });
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    (html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|br|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n"),
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function extractMetaContent(html: string, keys: string[]): string {
  const tags = html.match(/<meta[^>]*>/gi) || [];
  const keySet = new Set(keys.map((key) => key.toLowerCase()));
  for (const tag of tags) {
    const name =
      tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ||
      "";
    if (!keySet.has(name)) continue;

    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    if (content.trim()) return decodeHtmlEntities(content.trim());
  }
  return "";
}

function parseJsonLd(input: string): unknown | null {
  const cleaned = input
    .replace(/<!--|-->/g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function findJobPostingNode(node: unknown): Record<string, any> | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPostingNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const obj = node as Record<string, any>;
  const typeValue = obj["@type"];

  if (typeof typeValue === "string" && typeValue.toLowerCase().includes("jobposting")) {
    return obj;
  }
  if (
    Array.isArray(typeValue) &&
    typeValue.some((value) => `${value}`.toLowerCase().includes("jobposting"))
  ) {
    return obj;
  }

  for (const value of Object.values(obj)) {
    const found = findJobPostingNode(value);
    if (found) return found;
  }
  return null;
}

function normalizePageTitle(rawTitle: string): string {
  const title = decodeHtmlEntities((rawTitle || "").replace(/\s+/g, " ").trim());
  if (!title) return "";
  return (
    title
      .split(/\s+[|\-–—]\s+/)
      .map((part) => part.trim())
      .find((part) => part.length >= 4 && part.length <= 120) || title
  );
}

function splitTitleAndCompanyFromText(title: string): { title: string; company: string } {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) return { title: "", company: "" };

  const atMatch = normalized.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() };
  }

  const parts = normalized
    .split(/\s+[|\-–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { title: parts[0], company: parts[1] };
  }

  return { title: normalized, company: "" };
}

function cleanApplicationNoise(text: string): string {
  const stopPatterns = [
    /^create a job alert\b/i,
    /^apply for this job\b/i,
    /^indicates a required field\b/i,
    /^powered by\b.*greenhouse\b/i,
    /^autofill with\b/i,
    /^submit application\b/i,
  ];

  const fieldLikePatterns = [
    /^first name\b/i,
    /^last name\b/i,
    /^preferred first name\b/i,
    /^email\b/i,
    /^phone\b/i,
    /^phone country\b/i,
    /^resume\/cv\b/i,
    /^cover letter\b/i,
    /^accepted file types:/i,
    /^attach\b/i,
    /^dropbox$/i,
    /^google drive$/i,
    /^enter manually$/i,
    /^select\.\.\.$/i,
  ];

  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const cleaned: string[] = [];
  for (const line of lines) {
    if (stopPatterns.some((pattern) => pattern.test(line))) break;
    if (fieldLikePatterns.some((pattern) => pattern.test(line))) continue;
    if (/^\S[^.]{1,70}\*$/.test(line)) continue;
    cleaned.push(line);
  }

  return cleaned.join("\n");
}

function selectLikelyJobDescription(rawText: string): string {
  const noNoise = cleanApplicationNoise(rawText);
  if (noNoise.length <= 8500) return noNoise;

  const lower = noNoise.toLowerCase();
  const anchors = [
    "position overview",
    "company overview",
    "about the role",
    "job description",
    "essential functions",
    "responsibilities",
    "qualifications",
    "requirements",
  ];

  let startIndex = -1;
  for (const anchor of anchors) {
    const idx = lower.indexOf(anchor);
    if (idx >= 0 && (startIndex === -1 || idx < startIndex)) {
      startIndex = idx;
    }
  }

  const start = startIndex >= 0 ? Math.max(0, startIndex - 100) : 0;
  const trimmed = noNoise.slice(start);
  return trimmed.slice(0, 8500).trim();
}

function scoreDescriptionCandidate(text: string): number {
  const normalized = `${text || ""}`.trim();
  if (!normalized) return 0;

  let score = Math.min(normalized.length, 12000);

  // Reward structure commonly present in full job descriptions.
  if (
    /\b(responsibilities|requirements|qualifications|about the role|what you'll do|benefits|about us)\b/i.test(
      normalized,
    )
  ) {
    score += 1200;
  }

  const bulletLines = (normalized.match(/\n-\s/g) || []).length;
  score += Math.min(bulletLines, 40) * 30;

  // Penalize common non-description page boilerplate.
  if (/\b(cookie|privacy policy|sign in|create account)\b/i.test(normalized)) {
    score -= 800;
  }

  return score;
}

function extractLocationFromText(text: string): string {
  const locationMatch =
    text.match(/\b(remote|hybrid|onsite|on-site)\b/i)?.[0] ||
    text.match(/\b[A-Z][a-z]+,\s*[A-Z]{2}\b/)?.[0] ||
    "";
  return locationMatch.trim();
}

function extractCompanyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("greenhouse.io")) {
      const match = parsed.pathname.match(/^\/([^/]+)/);
      if (match?.[1]) return match[1];
    }
    if (host.includes("lever.co")) {
      const match = parsed.pathname.match(/^\/([^/]+)/);
      if (match?.[1]) return match[1];
    }

    const parts = host.split(".").filter(Boolean);
    const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "";
    if (!core) return "";
    return core.replace(/[-_]/g, " ");
  } catch {
    return "";
  }
}

interface WorkableContext {
  accountSlug?: string;
  jobCode?: string;
}

function parseWorkableContextFromUrl(rawUrl: string): WorkableContext {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.toLowerCase().includes("apply.workable.com")) {
      return {};
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return {};

    // Patterns:
    // 1) /{account}/j/{code}
    // 2) /j/{code}
    if (segments[0] === "j") {
      return { jobCode: segments[1] || undefined };
    }
    if (segments[1] === "j") {
      return {
        accountSlug: segments[0],
        jobCode: segments[2] || undefined,
      };
    }

    return { accountSlug: segments[0] };
  } catch {
    return {};
  }
}

function extractMetaUrl(html: string, propertyName: "og:url" | "canonical"): string {
  if (propertyName === "og:url") {
    return (
      html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      ""
    );
  }
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || "";
}

async function fetchWorkableJobDescription(
  pageUrl: string,
  html: string,
): Promise<{
  title?: string;
  company?: string;
  location?: string;
  description?: string;
} | null> {
  const canonicalUrl = extractMetaUrl(html, "canonical");
  const ogUrl = extractMetaUrl(html, "og:url");

  const fromPage = parseWorkableContextFromUrl(pageUrl);
  const fromCanonical = parseWorkableContextFromUrl(canonicalUrl);
  const fromOg = parseWorkableContextFromUrl(ogUrl);

  const accountSlug =
    fromPage.accountSlug || fromCanonical.accountSlug || fromOg.accountSlug;
  const jobCode =
    fromPage.jobCode || fromCanonical.jobCode || fromOg.jobCode;

  if (!accountSlug) return null;

  const endpoint = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(accountSlug)}?details=true`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as any;
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  if (jobs.length === 0) return null;

  let selectedJob: any | null = null;
  if (jobCode) {
    const normalizedCode = `${jobCode}`.trim().toLowerCase();
    selectedJob =
      jobs.find(
        (job: any) =>
          `${job?.shortcode || ""}`.trim().toLowerCase() === normalizedCode,
      ) || null;
  }

  if (!selectedJob) {
    // Fallback to the richest listing in the account feed.
    selectedJob = jobs
      .slice()
      .sort(
        (a: any, b: any) =>
          `${b?.description || ""}`.length - `${a?.description || ""}`.length,
      )[0];
  }

  const descriptionText = htmlToPlainText(`${selectedJob?.description || ""}`).trim();
  if (!descriptionText) return null;

  const city = `${selectedJob?.city || ""}`.trim();
  const state = `${selectedJob?.state || ""}`.trim();
  const country = `${selectedJob?.country || ""}`.trim();
  const locationParts = [city, state, country].filter(Boolean);
  const location = selectedJob?.telecommuting
    ? locationParts.length > 0
      ? `Remote (${locationParts.join(", ")})`
      : "Remote"
    : locationParts.join(", ");

  return {
    title: `${selectedJob?.title || ""}`.trim() || undefined,
    company: `${payload?.name || accountSlug}`.trim() || undefined,
    location: location || undefined,
    description: descriptionText,
  };
}

function toTitleCase(value: string): string {
  return (value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export class JobWebScraperService {
  async scrapeJobPosting(url: string): Promise<ScrapedJobPosting> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
      const ogTitle = extractMetaContent(html, ["og:title", "twitter:title"]);
      const ogDescription = extractMetaContent(html, [
        "description",
        "og:description",
        "twitter:description",
      ]);

      let jsonLdTitle = "";
      let jsonLdCompany = "";
      let jsonLdDescription = "";
      let jsonLdLocation = "";

      for (const match of html.matchAll(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      )) {
        const parsed = parseJsonLd(match[1]);
        if (!parsed) continue;
        const jobPosting = findJobPostingNode(parsed);
        if (!jobPosting) continue;

        if (typeof jobPosting.title === "string") {
          jsonLdTitle = jsonLdTitle || decodeHtmlEntities(jobPosting.title.trim());
        }

        const orgName = jobPosting.hiringOrganization?.name;
        if (typeof orgName === "string") {
          jsonLdCompany = jsonLdCompany || decodeHtmlEntities(orgName.trim());
        }

        if (typeof jobPosting.description === "string") {
          jsonLdDescription =
            jsonLdDescription || htmlToPlainText(jobPosting.description);
        }

        const locationNode = jobPosting.jobLocation;
        const locationValue = Array.isArray(locationNode)
          ? locationNode[0]
          : locationNode;
        const locality = locationValue?.address?.addressLocality;
        const region = locationValue?.address?.addressRegion;
        if (typeof locality === "string" || typeof region === "string") {
          jsonLdLocation = [locality, region].filter(Boolean).join(", ");
        }

        if (jsonLdTitle && jsonLdCompany && jsonLdDescription.length > 100) break;
      }

      let workableData: {
        title?: string;
        company?: string;
        location?: string;
        description?: string;
      } | null = null;
      try {
        if (new URL(url).hostname.toLowerCase().includes("apply.workable.com")) {
          workableData = await fetchWorkableJobDescription(url, html);
        }
      } catch {
        workableData = null;
      }

      const bodyHtml = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
      const bodyText = htmlToPlainText(bodyHtml);
      const descriptionCandidates = [
        selectLikelyJobDescription(workableData?.description || ""),
        selectLikelyJobDescription(jsonLdDescription || ""),
        selectLikelyJobDescription(bodyText || ""),
        selectLikelyJobDescription(ogDescription || ""),
      ].filter((candidate) => Boolean(candidate));

      const description =
        descriptionCandidates.sort(
          (a, b) => scoreDescriptionCandidate(b) - scoreDescriptionCandidate(a),
        )[0] || "";

      const titleSource = jsonLdTitle || ogTitle || normalizePageTitle(titleTag);
      const split = splitTitleAndCompanyFromText(titleSource);
      const companyFallback = toTitleCase(extractCompanyFromUrl(url));

      const title =
        workableData?.title || split.title || normalizePageTitle(titleTag);
      const company =
        workableData?.company || jsonLdCompany || split.company || companyFallback;
      const location =
        workableData?.location || jsonLdLocation || extractLocationFromText(description);

      return {
        sourceUrl: url,
        title: title.trim() || undefined,
        company: company.trim() || undefined,
        location: location.trim() || undefined,
        description: description.trim(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

let jobWebScraperService: JobWebScraperService | null = null;

export function getJobWebScraperService(): JobWebScraperService {
  if (!jobWebScraperService) {
    jobWebScraperService = new JobWebScraperService();
  }
  return jobWebScraperService;
}

export default getJobWebScraperService;
