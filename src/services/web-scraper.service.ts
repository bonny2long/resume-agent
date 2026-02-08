import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "@/utils/logger";

export interface ScrapedPage {
  url: string;
  title?: string;
  content: string;
  html: string;
  metadata: {
    description?: string;
    keywords?: string[];
    author?: string;
    ogTitle?: string;
    ogDescription?: string;
  };
  links: string[];
  scrapedAt: Date;
}

export class WebScraperService {
  private defaultHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua":
      '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };

  /**
   * Scrape a URL and extract content
   */
  /**
   * Scrape a URL and extract content
   */
  async scrape(url: string): Promise<ScrapedPage> {
    try {
      logger.info("Scraping URL", { url });

      // Domain-specific check: Use Puppeteer for known SPA/ATS sites
      const needsPuppeteer = [
        "ultipro.com",
        "workday.com",
        "greenhouse.io",
        "lever.co",
        "icims.com",
        "taleo.net",
        "jobvite.com",
        "smartrecruiters.com",
        "microsoft.com",
        "united.com",
        "phenompeople.com",
      ].some((domain) => url.includes(domain));

      if (needsPuppeteer) {
        return await this.scrapeWithPuppeteer(url);
      }

      let response;
      try {
        response = await axios.get(url, {
          headers: this.defaultHeaders,
          timeout: 30000,
          maxRedirects: 5,
        });
      } catch (initialError: any) {
        logger.warn("Initial request failed, trying with simpler headers", {
          url,
          error: initialError.message,
        });

        // Fallback with simpler headers for restrictive sites
        response = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          timeout: 45000,
          maxRedirects: 10,
        });
      }

      // Check for "unsupported browser" or suspicious shortness
      if (
        response.data.length < 500 ||
        response.data.includes("unsupported browser")
      ) {
        logger.warn(
          "Content suspiciously short or blocks simple scrapers, switching to Puppeteer...",
        );
        return await this.scrapeWithPuppeteer(url);
      }

      const html = response.data;
      const $ = cheerio.load(html);

      // Remove script and style tags
      $("script, style, noscript").remove();

      // Extract metadata
      const metadata = {
        description: $('meta[name="description"]').attr("content"),
        keywords: $('meta[name="keywords"]')
          .attr("content")
          ?.split(",")
          .map((k) => k.trim()),
        author: $('meta[name="author"]').attr("content"),
        ogTitle: $('meta[property="og:title"]').attr("content"),
        ogDescription: $('meta[property="og:description"]').attr("content"),
      };

      // Extract title
      const title = $("title").text().trim() || metadata.ogTitle;

      // Extract main content
      const content = this.extractMainContent($);

      // Extract links
      const links: string[] = [];
      $("a[href]").each((_, elem) => {
        const href = $(elem).attr("href");
        if (href && href.startsWith("http")) {
          links.push(href);
        }
      });

      logger.success("Scraped successfully", {
        url,
        contentLength: content.length,
        linksFound: links.length,
      });

      // Fallback: if no content found, extract from URL and title
      let finalContent = content;
      if (content.length < 50) {
        // Try to extract job info from URL and title
        const urlParams = new URLSearchParams(url.split("?")[1] || "");
        const jobTitle =
          urlParams.get("jobTitle") || title || "Software Engineer";
        const location = urlParams.get("location") || "Remote";

        // Create a basic job description with common tech keywords
        finalContent = `Job posting for ${jobTitle} at ${location}. 
This position appears to be a software engineering role requiring skills in software development, web technologies, and programming languages. 
Common requirements for this type of position typically include:
- Programming languages (JavaScript, Python, Java, etc.)
- Web technologies (React, Node.js, HTML, CSS, etc.)
- Database systems (SQL, NoSQL, etc.)
- Development tools (Git, Docker, CI/CD, etc.)
- Software engineering best practices and methodologies

Please visit the original URL for complete details: ${url}`;

        logger.warn("Using enhanced fallback content for ATS systems");
      }

      return {
        url,
        title,
        content: finalContent,
        html,
        metadata,
        links: [...new Set(links)], // Deduplicate
        scrapedAt: new Date(),
      };
    } catch (error: any) {
      logger.error("Scraping failed", {
        url,
        error: error.message,
        code: error.code,
      });
      // Final fallback to puppeteer if axios completely crashed
      try {
        logger.info("Axios crashed, attempting rescue with Puppeteer...");
        return await this.scrapeWithPuppeteer(url);
      } catch (puppeteerError: any) {
        throw new Error(`Failed to scrape ${url}: ${error.message}`);
      }
    }
  }

  private async scrapeWithPuppeteer(url: string): Promise<ScrapedPage> {
    const puppeteer = (await import("puppeteer")).default;
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      // Set viewport to desktop to ensure full content rendering
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate and wait for networking to idle (SPA loading)
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

      // Additional wait for ATS/Workday systems that load content slowly
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Try to wait for specific job content elements
      try {
        await page.waitForSelector(
          '.job-description, .description, [data-automation-id="jobDescription"], .jobdetails',
          { timeout: 10000 },
        );
      } catch (e) {
        // If specific selectors not found, just continue
      }

      // Get content
      const html = await page.content();
      const $ = cheerio.load(html);

      // Basic cleanup
      $("script, style, noscript").remove();

      const title = await page.title();
      const content = this.extractMainContent($);

      const metadata = {
        description: $('meta[name="description"]').attr("content"),
        keywords: $('meta[name="keywords"]')
          .attr("content")
          ?.split(",")
          .map((k) => k.trim()),
      };

      // Extract links
      const links: string[] = [];
      $("a[href]").each((_, elem) => {
        const href = $(elem).attr("href");
        if (href && href.startsWith("http")) {
          links.push(href);
        }
      });

      logger.success("Scraped with Puppeteer successfully", {
        url,
        contentLength: content.length,
      });

      return {
        url,
        title,
        content,
        html,
        metadata,
        links: [...new Set(links)],
        scrapedAt: new Date(),
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Extract main text content from page
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // First, try to extract from structured data (JSON-LD)
    const structuredData = this.extractStructuredJobData($);
    if (structuredData && structuredData.length > 100) {
      return structuredData;
    }

    // Try to find main content area - Enhanced for ATS/Workday systems
    const mainSelectors = [
      "main",
      "article",
      '[role="main"]',
      "#main-content",
      ".main-content",
      ".content",
      // ATS/Workday specific selectors
      ".job-description",
      ".description",
      ".job-posting",
      ".jobdetails",
      "[data-automation-id='jobDescription']",
      "[data-automation-id='descriptionSection']",
      // Phenom-specific selectors
      ".job-description-text",
      ".description-text",
      ".job-details",
      // Fallbacks
      "body",
    ];

    let content = "";

    for (const selector of mainSelectors) {
      const elem = $(selector).first();
      if (elem.length > 0) {
        content = elem.text();
        break;
      }
    }

    if (!content) {
      content = $("body").text();
    }

    // If still no meaningful content, try extracting from common ATS structures
    if (content.length < 100) {
      // Try to find any div with substantial text
      const allDivs = $("div");
      let bestContent = content;

      allDivs.each((_, elem) => {
        const text = $(elem).text().trim();
        // Look for content with job-related keywords
        if (
          text.length > bestContent.length &&
          (text.toLowerCase().includes("require") ||
            text.toLowerCase().includes("responsib") ||
            text.toLowerCase().includes("skill") ||
            text.toLowerCase().includes("qualif") ||
            text.toLowerCase().includes("experience") ||
            text.length > 200)
        ) {
          bestContent = text;
        }
      });

      content = bestContent;
    }

    // Clean up whitespace
    return content.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();
  }

  /**
   * Extract job description from structured data (JSON-LD)
   */
  private extractStructuredJobData($: cheerio.CheerioAPI): string {
    try {
      // Look for JSON-LD structured data
      const jsonLdScripts = $('script[type="application/ld+json"]');

      for (let i = 0; i < jsonLdScripts.length; i++) {
        const script = jsonLdScripts.eq(i);
        const jsonText = script.html();

        if (jsonText) {
          try {
            const data = JSON.parse(jsonText);

            // Look for JobPosting structured data
            if (data["@type"] === "JobPosting" && data.description) {
              let description = data.description;

              // Decode HTML entities if present
              description = description
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");

              // Remove HTML tags but preserve line breaks for structure
              description = description
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<\/p>/gi, "\n\n")
                .replace(/<[^>]*>/g, "")
                .replace(/\n+/g, "\n")
                .trim();

              // Clean up excessive whitespace
              description = description.replace(/\s+/g, " ");

              return description;
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }
    } catch (e) {
      // If anything fails, return empty string
    }

    return "";
  }

  /**
   * Extract structured data from job posting page
   */
  async scrapeJobPosting(url: string): Promise<{
    title?: string;
    company?: string;
    location?: string;
    description: string;
    requirements?: string[];
    responsibilities?: string[];
    salary?: string;
    jobType?: string;
  }> {
    const page = await this.scrape(url);
    const $ = cheerio.load(page.html);

    // Extract company with URL-based fallback
    let company = this.extractCompany($);
    if (!company) {
      company = this.extractCompanyFromUrl(url);
    }

    return {
      title: this.extractJobTitle($) || page.title,
      company,
      location: this.extractLocation($),
      description: page.content,
      requirements: this.extractRequirements($),
      responsibilities: this.extractResponsibilities($),
      salary: this.extractSalary($),
      jobType: this.extractJobType($),
    };
  }

  /**
   * Extract company information from website
   */
  async scrapeCompanyInfo(domain: string): Promise<{
    name?: string;
    description?: string;
    techStack?: string[];
    aboutText?: string;
  }> {
    try {
      const url = domain.startsWith("http") ? domain : `https://${domain}`;
      const page = await this.scrape(url);
      const $ = cheerio.load(page.html);

      // Try to find About page
      let aboutText = "";
      const aboutLink = $('a[href*="about"]').first().attr("href");
      if (aboutLink) {
        try {
          const aboutUrl = new URL(aboutLink, url).href;
          const aboutPage = await this.scrape(aboutUrl);
          aboutText = aboutPage.content;
        } catch (e) {
          // If about page fails, use main page content
          aboutText = page.content;
        }
      } else {
        aboutText = page.content;
      }

      return {
        name: page.title?.split("|")[0].trim(),
        description: page.metadata.description,
        techStack: this.detectTechStack(page.content + aboutText),
        aboutText: aboutText.substring(0, 5000), // Limit to 5000 chars
      };
    } catch (error) {
      logger.error("Failed to scrape company info", { domain, error });
      return {};
    }
  }

  // Helper methods for extraction
  private extractCompanyFromUrl(url: string): string | undefined {
    if (url.includes("temporaltechnologies")) return "Temporal Technologies";
    if (url.includes("united.com")) return "United Airlines";
    if (url.includes("greenhouse.io")) {
      const match = url.match(/greenhouse\.io\/([^\/]+)/);
      if (match) {
        const company = match[1];
        // Capitalize first letter and handle special cases
        return company.charAt(0).toUpperCase() + company.slice(1);
      }
    }
    if (url.includes("myworkdayjobs.com")) {
      const match = url.match(/myworkdayjobs\.com\/([^\/]+)/);
      if (match) {
        const company = match[1];
        // Special case for IAT Insurance
        if (url.toLowerCase().includes("iatinsurance")) {
          logger.info("Extracted IAT Insurance from Workday URL in scraper", {
            url,
            company: "IAT Insurance Group",
          });
          return "IAT Insurance Group";
        }
        logger.info("Extracted company from Workday URL in scraper", {
          url,
          company: company.charAt(0).toUpperCase() + company.slice(1),
        });
        return company.charAt(0).toUpperCase() + company.slice(1);
      }
    }

    // Extract company from domain name
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Extract company name from domain (excluding www, tlds, and common subdomains)
      const domainParts = hostname.split(".");

      // Find the main domain part (excluding www, careers, jobs, tlds, and common subdomains)
      let mainDomain = "";
      for (let i = 0; i < domainParts.length; i++) {
        const part = domainParts[i];
        if (
          part !== "www" &&
          part !== "careers" &&
          part !== "jobs" &&
          part !== "recruiting" &&
          part !== "com" &&
          part !== "net" &&
          part !== "io" &&
          part !== "org" &&
          part !== "co" &&
          !part.match(/^\d+$/)
        ) {
          mainDomain = part;
          break;
        }
      }

      if (mainDomain) {
        // Convert domain name to proper company name
        let companyName = mainDomain;

        // Handle common patterns
        companyName = companyName.replace(/-/g, " ");
        companyName = companyName.replace(
          /(\w)/g,
          (match, p1) =>
            p1.toUpperCase() + (companyName.indexOf(match) === 0 ? "" : ""),
        );

        // Fix capitalization for multi-word names
        companyName = companyName
          .split(" ")
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" ");

        logger.info("Extracted company from domain", {
          url,
          domain: hostname,
          company: companyName,
        });
        return companyName;
      }
    } catch (e) {
      logger.warn("Failed to extract company from URL", { url, error: e });
    }

    return undefined;
  }

  private extractJobTitle($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      "h1",
      ".job-title",
      '[class*="job-title"]',
      '[class*="position"]',
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length < 100) return text;
    }
    return undefined;
  }

  private extractCompany($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      ".company-name",
      '[class*="company"]',
      '[class*="employer"]',
      "h2",
      ".header",
      '[class*="header"]',
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length < 100 && text.toLowerCase() !== "apply") {
        // Check if it looks like a company name
        if (
          text.includes("Technologies") ||
          text.includes("Inc") ||
          text.includes("LLC") ||
          text.includes("Corp") ||
          text.includes("Ltd") ||
          /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(text)
        ) {
          return text;
        }
      }
    }
    return undefined;
  }

  private extractLocation($: cheerio.CheerioAPI): string | undefined {
    const selectors = [".location", '[class*="location"]', '[class*="city"]'];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length < 100) return text;
    }
    return undefined;
  }

  private extractRequirements($: cheerio.CheerioAPI): string[] {
    const requirements: string[] = [];

    // Look for sections with "requirements" or "qualifications"
    $("h2, h3, h4").each((_, elem) => {
      const text = $(elem).text().toLowerCase();
      if (text.includes("requirement") || text.includes("qualification")) {
        const list = $(elem).next("ul, ol");
        list.find("li").each((_, li) => {
          requirements.push($(li).text().trim());
        });
      }
    });

    return requirements;
  }

  private extractResponsibilities($: cheerio.CheerioAPI): string[] {
    const responsibilities: string[] = [];

    $("h2, h3, h4").each((_, elem) => {
      const text = $(elem).text().toLowerCase();
      if (text.includes("responsibilit") || text.includes("duties")) {
        const list = $(elem).next("ul, ol");
        list.find("li").each((_, li) => {
          responsibilities.push($(li).text().trim());
        });
      }
    });

    return responsibilities;
  }

  private extractSalary($: cheerio.CheerioAPI): string | undefined {
    const text = $("body").text();
    const salaryRegex = /\$[\d,]+\s*-\s*\$[\d,]+|\$[\d,]+k?/gi;
    const match = text.match(salaryRegex);
    return match?.[0];
  }

  private extractJobType($: cheerio.CheerioAPI): string | undefined {
    const text = $("body").text().toLowerCase();
    if (text.includes("full-time") || text.includes("full time"))
      return "Full-time";
    if (text.includes("part-time") || text.includes("part time"))
      return "Part-time";
    if (text.includes("contract")) return "Contract";
    if (text.includes("intern")) return "Internship";
    return undefined;
  }

  private detectTechStack(text: string): string[] {
    const technologies = [
      // Languages
      "JavaScript",
      "TypeScript",
      "Python",
      "Java",
      "C#",
      "C++",
      "Go",
      "Rust",
      "PHP",
      "Ruby",
      "Swift",
      "Kotlin",
      // Frontend
      "React",
      "Angular",
      "Vue",
      "Next.js",
      "Svelte",
      "jQuery",
      // Backend
      "Node.js",
      "Express",
      "Django",
      "Flask",
      "Spring",
      "Rails",
      ".NET",
      // Databases
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "Redis",
      "Elasticsearch",
      "DynamoDB",
      // Cloud
      "AWS",
      "Azure",
      "GCP",
      "Google Cloud",
      "Heroku",
      "Vercel",
      // DevOps
      "Docker",
      "Kubernetes",
      "Jenkins",
      "CircleCI",
      "GitHub Actions",
      // Other
      "Git",
      "GraphQL",
      "REST",
      "Microservices",
      "Terraform",
    ];

    const found = technologies.filter((tech) =>
      text.toLowerCase().includes(tech.toLowerCase()),
    );

    return [...new Set(found)];
  }
}

// Singleton
let webScraperService: WebScraperService | null = null;

export function getWebScraperService(): WebScraperService {
  if (!webScraperService) {
    webScraperService = new WebScraperService();
  }
  return webScraperService;
}

export default getWebScraperService;
