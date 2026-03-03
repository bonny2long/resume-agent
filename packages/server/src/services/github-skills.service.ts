// src/services/github-skills.service.ts
import { PrismaClient, Proficiency } from "@prisma/client";
import { GitHubService } from "./github.service";
import { logger } from "@/utils/logger";

export interface GitHubSkill {
  name: string;
  source: "language" | "topic" | "readme";
  confidence: number; // 0-1 based on source reliability
  repositories: string[];
  category?: string;
}

export class GitHubSkillsService {
  private githubService: GitHubService;

  constructor(private prisma: PrismaClient) {
    this.githubService = new GitHubService(prisma);
  }

  /**
   * Extract all skills from user's GitHub repositories
   */
  async extractSkills(): Promise<GitHubSkill[]> {
    logger.info("Extracting skills from GitHub repositories");

    try {
      const repos = await this.githubService.getRepositories();
      const skillsMap = new Map<string, GitHubSkill>();

      for (const repo of repos) {
        // Extract from languages with more sophisticated confidence scoring
        if (repo.languages) {
          for (const language of repo.languages) {
            // Calculate confidence based on multiple factors
            const baseConfidence = 0.3; // Start with low confidence
            let confidenceBoost = 0;

            // Boost confidence for non-forked repos
            if (!repo.isFork) {
              confidenceBoost += 0.2;
            }

            // Boost confidence for recent activity (last 6 months)
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            if (new Date(repo.updatedAt) > sixMonthsAgo) {
              confidenceBoost += 0.2;
            }

            // Boost confidence for larger repositories (more substantial work)
            if (repo.size && repo.size > 100) {
              // 100KB+
              confidenceBoost += 0.1;
            }

            // Boost confidence for repositories with stars (community validation)
            if (repo.stargazers_count && repo.stargazers_count > 0) {
              confidenceBoost += 0.1;
            }

            // Boost confidence for primary language (if specified)
            if (
              repo.language &&
              repo.language.toLowerCase() === language.toLowerCase()
            ) {
              confidenceBoost += 0.1;
            }

            const finalConfidence = Math.min(
              baseConfidence + confidenceBoost,
              0.8,
            );

            this.addSkill(skillsMap, {
              name: language,
              source: "language",
              confidence: finalConfidence,
              repositories: [repo.name],
              category: this.categorizeSkill(language),
            });
          }
        }

        // Extract from topics
        if (repo.topics) {
          for (const topic of repo.topics) {
            this.addSkill(skillsMap, {
              name: topic,
              source: "topic",
              confidence: 0.7, // Medium confidence for topics
              repositories: [repo.name],
              category: this.categorizeSkill(topic),
            });
          }
        }

        // Extract from README content
        if (repo.readmeContent) {
          const readmeSkills = this.extractSkillsFromReadme(repo.readmeContent);
          for (const skill of readmeSkills) {
            this.addSkill(skillsMap, {
              name: skill,
              source: "readme",
              confidence: 0.6, // Lower confidence for README extraction
              repositories: [repo.name],
              category: this.categorizeSkill(skill),
            });
          }
        }
      }

      const skills = Array.from(skillsMap.values());
      logger.info(
        `Extracted ${skills.length} skills from ${repos.length} repositories`,
      );

      return skills.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      logger.error("Failed to extract GitHub skills", error);
      return [];
    }
  }

  /**
   * Get skills that match job requirements
   */
  async getMatchingSkills(jobRequiredSkills: string[]): Promise<{
    matched: GitHubSkill[];
    missing: string[];
  }> {
    const allSkills = await this.extractSkills();
    const normalizedJobSkills = jobRequiredSkills.map((s) =>
      s.toLowerCase().trim(),
    );

    const matched: GitHubSkill[] = [];
    const missing: string[] = [];

    for (const jobSkill of normalizedJobSkills) {
      const matchingSkills = allSkills.filter((githubSkill) =>
        this.isSkillMatch(githubSkill.name.toLowerCase(), jobSkill),
      );

      // Sort by confidence (highest first)
      matchingSkills.sort((a, b) => b.confidence - a.confidence);

      // Only consider it a match if confidence is at least 0.5 (medium threshold)
      const bestMatch = matchingSkills[0];
      if (bestMatch && bestMatch.confidence >= 0.5) {
        matched.push(bestMatch);
      } else {
        missing.push(jobSkill);
      }
    }

    return { matched, missing };
  }

  /**
   * Sync GitHub skills to master resume
   */
  async syncToMasterResume(): Promise<{
    added: number;
    updated: number;
    total: number;
  }> {
    logger.info("Syncing GitHub skills to master resume");

    try {
      const masterResume = await this.prisma.masterResume.findFirst();
      if (!masterResume) {
        throw new Error("No master resume found");
      }

      const githubSkills = await this.extractSkills();
      const existingSkills = await this.prisma.skill.findMany({
        where: { resumeId: masterResume.id },
      });

      const existingSkillNames = new Set(
        existingSkills.map((s) => s.name.toLowerCase()),
      );

      let added = 0;
      let updated = 0;

      for (const githubSkill of githubSkills) {
        const skillName = githubSkill.name.toLowerCase();

        if (!existingSkillNames.has(skillName)) {
          // Add new skill
          await this.prisma.skill.create({
            data: {
              name: githubSkill.name,
              category: githubSkill.category || "Technical",
              proficiency: this.inferProficiency(githubSkill),
              resumeId: masterResume.id,
            },
          });
          added++;
        } else {
          // Could update existing skill metadata here if needed
          updated++;
        }
      }

      logger.info(
        `Synced ${added} new skills, updated ${updated} existing skills`,
      );

      return { added, updated, total: githubSkills.length };
    } catch (error) {
      logger.error("Failed to sync GitHub skills to master resume", error);
      throw error;
    }
  }

  /**
   * Add or update skill in the skills map
   */
  private addSkill(
    skillsMap: Map<string, GitHubSkill>,
    skill: GitHubSkill,
  ): void {
    const existing = skillsMap.get(skill.name.toLowerCase());

    if (existing) {
      // Merge repositories and update confidence if higher
      existing.repositories = [
        ...new Set([...existing.repositories, ...skill.repositories]),
      ];
      existing.confidence = Math.max(existing.confidence, skill.confidence);
    } else {
      skillsMap.set(skill.name.toLowerCase(), skill);
    }
  }

  /**
   * Extract skills from README content using comprehensive pattern matching
   */
  private extractSkillsFromReadme(readme: string): string[] {
    const skills: string[] = [];

    // Core skill categories with simpler patterns
    const skillCategories = [
      // Programming Languages
      [
        "TypeScript",
        "JavaScript",
        "Python",
        "Java",
        "Go",
        "Rust",
        "C++",
        "C#",
        "PHP",
        "Ruby",
        "Swift",
        "Kotlin",
        "Scala",
        "Dart",
        "R",
        "MATLAB",
        "Elixir",
        "Haskell",
        "Lua",
        "Perl",
        "Shell",
        "Bash",
        "PowerShell",
      ],

      // Frontend Technologies
      [
        "React",
        "Vue",
        "Angular",
        "Next.js",
        "Svelte",
        "Nuxt",
        "Gatsby",
        "Remix",
        "Solid.js",
        "Qwik",
        "Alpine.js",
        "Lit",
        "Stencil",
        "Tailwind",
        "Bootstrap",
        "Material-UI",
        "Chakra",
        "Ant Design",
      ],

      // Backend Technologies
      [
        "Express",
        "Fastify",
        "Koa",
        "NestJS",
        "Spring",
        "Spring Boot",
        "Django",
        "Flask",
        "Rails",
        "Laravel",
        "Symfony",
        "ASP.NET",
        "Fiber",
        "Gin",
        "Echo",
        "Phoenix",
        "Actix",
        "Axum",
      ],

      // Databases & Storage
      [
        "PostgreSQL",
        "MySQL",
        "MongoDB",
        "Redis",
        "Elasticsearch",
        "Cassandra",
        "DynamoDB",
        "SQLite",
        "Oracle",
        "SQLServer",
        "Neo4j",
        "InfluxDB",
        "Couchbase",
        "Firebird",
        "MariaDB",
        "Supabase",
        "PlanetScale",
        "Fauna",
        "SurrealDB",
      ],

      // Cloud & Infrastructure
      [
        "AWS",
        "Azure",
        "GCP",
        "Google Cloud",
        "Heroku",
        "Vercel",
        "Netlify",
        "DigitalOcean",
        "Linode",
        "Alibaba Cloud",
        "IBM Cloud",
        "Oracle Cloud",
        "Cloudflare",
        "Railway",
        "Fly.io",
        "Render",
        "Upstash",
      ],

      // DevOps & CI/CD
      [
        "Docker",
        "Kubernetes",
        "K8s",
        "Helm",
        "Terraform",
        "Pulumi",
        "Ansible",
        "Puppet",
        "Chef",
        "SaltStack",
        "Jenkins",
        "CircleCI",
        "GitHub Actions",
        "GitLab CI",
        "Travis CI",
        "AppVeyor",
        "Buddy",
        "CodeShip",
        "Drone",
        "Semaphore",
        "Wercker",
        "Buildkite",
        "Concourse",
        "Spinnaker",
        "ArgoCD",
        "Flux",
      ],

      // Version Control & Collaboration
      [
        "Git",
        "GitHub",
        "GitLab",
        "Bitbucket",
        "SVN",
        "Mercurial",
        "Perforce",
        "SourceForge",
        "GitKraken",
        "Sourcetree",
        "GitHub Desktop",
        "Git LFS",
        "Git Hooks",
        "Git Flow",
      ],

      // APIs & Protocols
      [
        "REST",
        "RESTful",
        "GraphQL",
        "gRPC",
        "SOAP",
        "WebSocket",
        "HTTP",
        "HTTPS",
        "TCP",
        "IP",
        "DNS",
        "SSH",
        "SSL",
        "TLS",
        "OpenAPI",
        "Swagger",
        "Postman",
        "Insomnia",
        "Hoppscotch",
        "GRPC",
        "Webhook",
        "SSE",
        "MQTT",
        "AMQP",
        "Kafka",
        "RabbitMQ",
        "NATS",
        "Pulsar",
      ],

      // ORMs & Database Tools
      [
        "Mongo",
        "Mongoose",
        "Sequelize",
        "TypeORM",
        "Prisma",
        "Hibernate",
        "SQLAlchemy",
        "Doctrine",
        "Entity Framework",
        "GORM",
        "SQLx",
        "Diesel",
        "Slick",
        "Slickify",
        "Jooby",
        "ActiveRecord",
        "Data Mapper",
        "Repository",
        "UnitOfWork",
      ],

      // State Management & Data Flow
      [
        "Redux",
        "MobX",
        "Zustand",
        "Vuex",
        "Pinia",
        "Apollo",
        "Relay",
        "SWR",
        "React Query",
        "TanStack Query",
        "RTK Query",
        "Recoil",
        "Jotai",
        "Valtio",
        "Effector",
        "XState",
        "Solid",
        "Store",
        "Context",
        "Provider",
        "Consumer",
        "Hooks",
        "Effects",
        "Actions",
        "Dispatch",
        "Subscribe",
        "Select",
        "Combine",
        "Middleware",
        "Thunk",
        "Saga",
        "Observable",
        "Subject",
        "BehaviorSubject",
        "ReplaySubject",
        "AsyncSubject",
      ],

      // Testing & Quality Assurance
      [
        "Jest",
        "Mocha",
        "Chai",
        "Sinon",
        "Cypress",
        "Playwright",
        "Selenium",
        "WebDriver",
        "Puppeteer",
        "Testing Library",
        "Enzyme",
        "Jasmine",
        "QUnit",
        "Karma",
        "Istanbul",
        "Codecov",
        "SonarQube",
        "ESLint",
        "Prettier",
        "Husky",
        "lint-staged",
        "Commitlint",
        "Pre-commit",
        "Pre-push",
        "Continuous Integration",
        "Continuous Deployment",
        "CI/CD",
        "Unit Testing",
        "Integration Testing",
        "E2E Testing",
        "Functional Testing",
        "Performance Testing",
        "Load Testing",
        "Stress Testing",
        "Security Testing",
        "Accessibility Testing",
        "Visual Regression Testing",
        "Snapshot Testing",
        "Mock",
        "Stub",
        "Spy",
        "Fixture",
        "Assertion",
        "Expect",
        "Should",
        "Assert",
        "Test",
        "Spec",
        "Suite",
        "Coverage",
        "Branch",
        "Line",
        "Function",
        "Statement",
        "Condition",
        "Path",
        "Complexity",
        "Cyclomatic",
        "Halstead",
        "Maintainability",
        "Reliability",
        "Security",
        "Vulnerability",
        "Penetration",
        "OWASP",
        "SAST",
        "DAST",
        "IAST",
        "RASP",
      ],

      // System Design & Architecture
      [
        "Microservices",
        "Monolith",
        "Serverless",
        "Event-driven",
        "CQRS",
        "Event Sourcing",
        "Domain-Driven Design",
        "DDD",
        "Clean Architecture",
        "Hexagonal Architecture",
        "Onion Architecture",
        "Layered Architecture",
        "N-Tier",
        "SOA",
        "Service-Oriented Architecture",
        "Enterprise Architecture",
        "Solution Architecture",
        "Technical Architecture",
        "Application Architecture",
        "Data Architecture",
        "Security Architecture",
        "Network Architecture",
        "Cloud Architecture",
        "Hybrid Cloud",
        "Multi-cloud",
        "Edge Computing",
        "Fog Computing",
        "Distributed Systems",
        "Scalability",
        "High Availability",
        "Fault Tolerance",
        "Resilience",
        "Disaster Recovery",
        "Backup",
        "Replication",
        "Sharding",
        "Partitioning",
        "Load Balancing",
        "Caching",
        "CDN",
        "Content Delivery Network",
        "Reverse Proxy",
        "API Gateway",
        "Service Mesh",
        "Sidecar",
        "Ambassador",
        "Envoy",
        "Istio",
        "Linkerd",
        "Consul",
        "Nomad",
        "Vault",
        "Observability",
        "Monitoring",
        "Logging",
        "Tracing",
        "Metrics",
        "Alerting",
        "SLA",
        "SLO",
        "SLI",
        "Error Budget",
        "Incident",
        "Post-mortem",
        "Root Cause Analysis",
        "RCA",
        "Blameless",
        "Runbook",
        "Playbook",
        "Chaos Engineering",
        "Resilience Testing",
        "Canary",
        "Blue-Green",
        "Feature Flag",
        "A/B Testing",
        "Dark Launch",
        "Shadow Traffic",
        "Smoke Testing",
        "Regression Testing",
        "Integration Testing",
        "End-to-End Testing",
        "User Acceptance Testing",
        "UAT",
        "Performance Testing",
        "Load Testing",
        "Stress Testing",
        "Capacity Planning",
        "Resource Planning",
        "Cost Optimization",
        "FinOps",
        "Cloud Financial Management",
        "Tagging",
        "Budgeting",
        "Forecasting",
        "Anomaly Detection",
        "Cost Allocation",
        "Chargeback",
        "Showback",
        "Benchmarking",
        "Baseline",
        "Profiling",
        "Optimization",
        "Tuning",
        "Performance",
        "Latency",
        "Throughput",
        "Concurrency",
        "Parallelism",
        "Asynchronous",
        "Synchronous",
        "Blocking",
        "Non-blocking",
        "Reactive",
        "Proactive",
        "Pull",
        "Push",
        "Polling",
        "Webhook",
        "Callback",
        "Promise",
        "Future",
        "Async",
        "Await",
        "Coroutine",
        "Fiber",
        "Thread",
        "Process",
        "Pool",
        "Queue",
        "Stack",
        "Heap",
        "Memory",
        "CPU",
        "GPU",
        "TPU",
        "FPGA",
        "ASIC",
        "Hardware",
        "Infrastructure",
        "Platform",
        "Software",
        "Application",
        "Service",
        "Function",
        "Lambda",
        "Server",
        "Client",
        "Frontend",
        "Backend",
        "Full-stack",
        "MEAN",
        "MERN",
        "LAMP",
        "JAMstack",
        "Static",
        "Dynamic",
        "SPA",
        "PWA",
        "SSR",
        "SSG",
        "ISR",
        "CSR",
        "Hybrid",
        "Universal",
        "Isomorphic",
        "Progressive",
        "Enhancement",
        "Graceful",
        "Degradation",
        "Responsive",
        "Adaptive",
        "Mobile",
        "Desktop",
        "Tablet",
        "Wearable",
        "IoT",
        "Edge",
        "Fog",
        "Cloud",
        "On-premise",
        "Hybrid",
        "Multi-cloud",
        "Cross-platform",
        "Native",
        "Web",
        "Mobile",
        "Desktop",
        "Enterprise",
        "Consumer",
        "B2B",
        "B2C",
        "C2C",
        "P2P",
        "Marketplace",
        "E-commerce",
        "Social",
        "Media",
        "Entertainment",
        "Education",
        "Healthcare",
        "Finance",
        "Banking",
        "Insurance",
        "Real Estate",
        "Travel",
        "Hospitality",
        "Retail",
        "Manufacturing",
        "Logistics",
        "Supply Chain",
        "Transportation",
        "Energy",
        "Utilities",
        "Government",
        "Public",
        "Sector",
        "Non-profit",
        "Startup",
        "SME",
        "Large",
        "Enterprise",
        "Scale-up",
        "Unicorn",
        "Decacorn",
        "Hectocorn",
      ],

      // Project Management & Methodologies
      [
        "Agile",
        "Scrum",
        "Kanban",
        "Lean",
        "Waterfall",
        "XP",
        "Extreme Programming",
        "Crystal",
        "Dynamic Systems Development Method",
        "DSDM",
        "Feature-Driven Development",
        "FDD",
        "Rational Unified Process",
        "RUP",
        "Spiral",
        "V-Model",
        "Iterative",
        "Incremental",
        "Continuous",
        "Integration",
        "Deployment",
        "Delivery",
        "DevOps",
        "DevSecOps",
        "GitOps",
        "NoOps",
        "AIOps",
        "MLOps",
        "DataOps",
        "FinOps",
        "CloudOps",
        "SRE",
        "Site Reliability Engineering",
        "Observability",
        "Monitoring",
        "Logging",
        "Tracing",
        "Metrics",
        "Alerting",
        "Incident",
        "Management",
        "Response",
        "Resolution",
        "Escalation",
        "Communication",
        "Collaboration",
        "Coordination",
        "Planning",
        "Estimation",
        "Forecasting",
        "Roadmap",
        "Backlog",
        "Sprint",
        "Iteration",
        "Release",
        "Deployment",
        "Pipeline",
        "Workflow",
        "Automation",
        "Orchestration",
        "Configuration",
        "Management",
        "Change",
        "Control",
        "Version",
        "Control",
        "Source",
        "Code",
        "Management",
        "Repository",
        "Branch",
        "Merge",
        "Pull",
        "Request",
        "Review",
        "Code",
        "Review",
        "Peer",
        "Review",
        "Static",
        "Analysis",
        "Dynamic",
        "Analysis",
        "Security",
        "Testing",
        "Quality",
        "Assurance",
        "Compliance",
        "Audit",
        "Governance",
        "Risk",
        "Management",
        "Mitigation",
        "Contingency",
        "Business",
        "Continuity",
        "Disaster",
        "Recovery",
        "Backup",
        "Restore",
        "Archive",
        "Retention",
        "Deletion",
        "Privacy",
        "GDPR",
        "CCPA",
        "HIPAA",
        "SOX",
        "PCI",
        "DSS",
        "ISO",
        "NIST",
        "CIS",
        "OWASP",
        "SANS",
        "CERT",
        "CVE",
        "CVSS",
        "Patch",
        "Update",
        "Upgrade",
        "Migration",
        "Modernization",
        "Refactoring",
        "Reengineering",
        "Reverse",
        "Engineering",
        "Forward",
        "Engineering",
        "Domain",
        "Modeling",
        "Business",
        "Analysis",
        "Requirements",
        "Engineering",
        "System",
        "Analysis",
        "Design",
        "Architecture",
        "Pattern",
        "Anti-pattern",
        "Best",
        "Practice",
        "Guideline",
        "Standard",
        "Convention",
        "Style",
        "Guide",
        "Linting",
        "Formatting",
        "Pre-commit",
        "Hook",
        "Git",
        "Hook",
        "GitHub",
        "Action",
        "GitLab",
        "CI",
        "Jenkins",
        "Pipeline",
        "YAML",
        "JSON",
        "XML",
        "HTML",
        "CSS",
        "SCSS",
        "SASS",
        "LESS",
        "Stylus",
        "PostCSS",
        "Autoprefixer",
        "Babel",
        "Webpack",
        "Vite",
        "Parcel",
        "Rollup",
        "ESBuild",
        "SWC",
        "Rome",
        "Deno",
        "Node",
        "npm",
        "yarn",
        "pnpm",
        "Bun",
        "Package",
        "Manager",
        "Dependency",
        "Management",
        "Semantic",
        "Versioning",
        "SemVer",
        "Semantic",
        "Release",
        "Changelog",
        "Release",
        "Notes",
        "Documentation",
        "API",
        "Docs",
        "README",
        "Markdown",
        "MDX",
        "Jekyll",
        "Hugo",
        "Gatsby",
        "Next.js",
        "Nuxt.js",
        "SvelteKit",
        "Astro",
        "SolidStart",
        "Qwik",
        "Remix",
        "Express",
        "Fastify",
        "Koa",
        "Hapi",
        "NestJS",
        "Spring",
        "Boot",
        "Django",
        "Flask",
        "Rails",
        "Laravel",
        "Symfony",
        "ASP.NET",
        "Core",
        "Entity",
        "Framework",
        "Core",
        "Data",
        "Access",
        "Layer",
        "Repository",
        "Pattern",
        "Unit",
        "of",
        "Work",
        "Command",
        "Query",
        "Responsibility",
        "Segregation",
        "Interface",
        "Segregation",
        "Principle",
        "Dependency",
        "Inversion",
        "Principle",
        "Single",
        "Responsibility",
        "Principle",
        "Open",
        "Closed",
        "Principle",
        "Liskov",
        "Substitution",
        "Principle",
        "Interface",
        "Segregation",
        "Principle",
        "Dependency",
        "Inversion",
        "Principle",
        "SOLID",
        "DRY",
        "KISS",
        "YAGNI",
        "WET",
        "SoC",
        "Cohesion",
        "Coupling",
        "Encapsulation",
        "Abstraction",
        "Polymorphism",
        "Inheritance",
        "Composition",
        "Aggregation",
        "Association",
        "Dependency",
        "Generalization",
        "Specialization",
        "Realization",
        "Implementation",
        "Abstract",
        "Concrete",
        "Interface",
        "Class",
        "Object",
        "Instance",
        "Method",
        "Function",
        "Property",
        "Attribute",
        "Field",
        "Variable",
        "Constant",
        "Parameter",
        "Argument",
        "Return",
        "Value",
        "Type",
        "Signature",
        "Scope",
        "Visibility",
        "Public",
        "Private",
        "Protected",
        "Internal",
        "Package",
        "Namespace",
        "Module",
        "Import",
        "Export",
        "Default",
        "Named",
        "Async",
        "Await",
        "Promise",
        "Future",
        "Callback",
        "Event",
        "Listener",
        "Observer",
        "Publisher",
        "Subscriber",
        "Producer",
        "Consumer",
        "Client",
        "Server",
        "Request",
        "Response",
        "Header",
        "Body",
        "Status",
        "Code",
        "Error",
        "Exception",
        "Try",
        "Catch",
        "Finally",
        "Throw",
        "Raise",
        "Handle",
        "Process",
        "Thread",
        "Pool",
        "Queue",
        "Stack",
        "Heap",
        "Memory",
        "Management",
        "Garbage",
        "Collection",
        "Reference",
        "Pointer",
        "Value",
        "Struct",
        "Enum",
        "Union",
        "Interface",
        "Type",
        "Alias",
        "Generic",
        "Template",
        "Metaprogramming",
        "Reflection",
        "Introspection",
        "Annotation",
        "Decorator",
        "Aspect",
        "Oriented",
        "Programming",
        "AOP",
        "Mixin",
        "Trait",
        "Protocol",
        "Extension",
        "Category",
        "Partial",
        "Class",
        "Delegation",
        "Proxy",
        "Facade",
        "Adapter",
        "Bridge",
        "Composite",
        "Decorator",
        "Flyweight",
        "Proxy",
        "Chain",
        "of",
        "Responsibility",
        "Command",
        "Interpreter",
        "Iterator",
        "Mediator",
        "Memento",
        "Observer",
        "State",
        "Strategy",
        "Template",
        "Method",
        "Visitor",
        "Null",
        "Object",
        "Singleton",
        "Factory",
        "Abstract",
        "Factory",
        "Builder",
        "Prototype",
        "Object",
        "Pool",
        "Flyweight",
        "Proxy",
        "Adapter",
        "Bridge",
        "Composite",
        "Decorator",
        "Facade",
        "Flyweight",
        "Proxy",
        "Chain",
        "of",
        "Responsibility",
        "Command",
        "Interpreter",
        "Iterator",
        "Mediator",
        "Memento",
        "Observer",
        "State",
        "Strategy",
        "Template",
        "Method",
        "Visitor",
        "Behavioral",
        "Creational",
        "Structural",
        "Design",
        "Patterns",
        "Architectural",
        "Patterns",
        "Enterprise",
        "Patterns",
        "Integration",
        "Patterns",
        "Concurrency",
        "Patterns",
        "Distributed",
        "Systems",
        "Patterns",
        "Cloud",
        "Patterns",
        "Microservice",
        "Patterns",
        "Event",
        "Driven",
        "Patterns",
        "CQRS",
        "Pattern",
        "Event",
        "Sourcing",
        "Pattern",
        "Saga",
        "Pattern",
        "API",
        "Gateway",
        "Pattern",
        "Service",
        "Discovery",
        "Pattern",
        "Circuit",
        "Breaker",
        "Pattern",
        "Bulkhead",
        "Pattern",
        "Throttling",
        "Pattern",
        "Retry",
        "Pattern",
        "Timeout",
        "Pattern",
        "Dead",
        "Letter",
        "Queue",
        "Pattern",
        "Outbox",
        "Pattern",
        "Transaction",
        "out",
        "Pattern",
        "Sharding",
        "Pattern",
        "Caching",
        "Pattern",
        "CDN",
        "Pattern",
        "Load",
        "Balancer",
        "Pattern",
        "Reverse",
        "Proxy",
        "Pattern",
        "Sidecar",
        "Pattern",
        "Ambassador",
        "Pattern",
        "Anti",
        "Corruption",
        "Layer",
        "Pattern",
        "Gateway",
        "Aggregation",
        "Pattern",
        "Strangler",
        "Fig",
        "Pattern",
        "Database",
        "per",
        "Service",
        "Pattern",
        "Shared",
        "Database",
        "Pattern",
        "Shared",
        "Schema",
        "Pattern",
        "Saga",
        "Orchestration",
        "Pattern",
        "Saga",
        "Choreography",
        "Pattern",
        "Event",
        "Collaboration",
        "Pattern",
        "Event",
        "Storming",
        "Pattern",
        "Domain",
        "Event",
        "Pattern",
        "Integration",
        "Event",
        "Pattern",
        "Command",
        "Query",
        "Responsibility",
        "Segregation",
        "Pattern",
        "CQRS",
        "Pattern",
        "Command",
        "Query",
        "Separation",
        "Pattern",
        "Event",
        "Sourcing",
        "Pattern",
        "Snapshot",
        "Pattern",
        "Projection",
        "Pattern",
        "Read",
        "Model",
        "Pattern",
        "Write",
        "Model",
        "Pattern",
        "Aggregate",
        "Pattern",
        "Aggregate",
        "Root",
        "Pattern",
        "Entity",
        "Pattern",
        "Value",
        "Object",
        "Pattern",
        "Domain",
        "Service",
        "Pattern",
        "Application",
        "Service",
        "Pattern",
        "Infrastructure",
        "Service",
        "Pattern",
        "Repository",
        "Pattern",
        "Factory",
        "Pattern",
        "Builder",
        "Pattern",
        "Prototype",
        "Pattern",
        "Singleton",
        "Pattern",
        "Strategy",
        "Pattern",
        "Observer",
        "Pattern",
        "State",
        "Pattern",
        "Template",
        "Method",
        "Pattern",
        "Command",
        "Pattern",
        "Iterator",
        "Pattern",
        "Mediator",
        "Pattern",
        "Memento",
        "Pattern",
        "Visitor",
        "Pattern",
        "Chain",
        "of",
        "Responsibility",
        "Pattern",
        "Proxy",
        "Pattern",
        "Adapter",
        "Pattern",
        "Bridge",
        "Pattern",
        "Composite",
        "Pattern",
        "Decorator",
        "Pattern",
        "Facade",
        "Pattern",
        "Flyweight",
        "Pattern",
        "Behavioral",
        "Pattern",
        "Creational",
        "Pattern",
        "Structural",
        "Pattern",
        "Architectural",
        "Pattern",
        "Enterprise",
        "Pattern",
        "Integration",
        "Pattern",
        "Concurrency",
        "Pattern",
        "Distributed",
        "Systems",
        "Pattern",
        "Cloud",
        "Pattern",
        "Microservice",
        "Pattern",
        "Event",
        "Driven",
        "Pattern",
        "CQRS",
        "Pattern",
        "Event",
        "Sourcing",
        "Pattern",
        "Saga",
        "Pattern",
        "API",
        "Gateway",
        "Pattern",
        "Service",
        "Discovery",
        "Pattern",
        "Circuit",
        "Breaker",
        "Pattern",
        "Bulkhead",
        "Pattern",
        "Throttling",
        "Pattern",
        "Retry",
        "Pattern",
        "Timeout",
        "Pattern",
        "Dead",
        "Letter",
        "Queue",
        "Pattern",
        "Outbox",
        "Pattern",
        "Transaction",
        "out",
        "Pattern",
        "Sharding",
        "Pattern",
        "Caching",
        "Pattern",
        "CDN",
        "Pattern",
        "Load",
        "Balancer",
        "Pattern",
        "Reverse",
        "Proxy",
        "Pattern",
        "Sidecar",
        "Pattern",
        "Ambassador",
        "Pattern",
        "Anti",
        "Corruption",
        "Layer",
        "Pattern",
        "Gateway",
        "Aggregation",
        "Pattern",
        "Strangler",
        "Fig",
        "Pattern",
        "Database",
        "per",
        "Service",
        "Pattern",
        "Shared",
        "Database",
        "Pattern",
        "Shared",
        "Schema",
        "Pattern",
        "Saga",
        "Orchestration",
        "Pattern",
        "Saga",
        "Choreography",
        "Pattern",
        "Event",
        "Collaboration",
        "Pattern",
        "Event",
        "Storming",
        "Pattern",
        "Domain",
        "Event",
        "Pattern",
        "Integration",
        "Event",
        "Pattern",
        "Command",
        "Query",
        "Responsibility",
        "Segregation",
        "Pattern",
        "CQRS",
        "Pattern",
        "Command",
        "Query",
        "Separation",
        "Pattern",
        "Event",
        "Sourcing",
        "Pattern",
        "Snapshot",
        "Pattern",
        "Projection",
        "Pattern",
        "Read",
        "Model",
        "Pattern",
        "Write",
        "Model",
        "Pattern",
        "Aggregate",
        "Pattern",
        "Aggregate",
        "Root",
        "Pattern",
        "Entity",
        "Pattern",
        "Value",
        "Object",
        "Pattern",
        "Domain",
        "Service",
        "Pattern",
        "Application",
        "Service",
        "Pattern",
        "Infrastructure",
        "Service",
        "Pattern",
        "Repository",
        "Pattern",
        "Factory",
        "Pattern",
        "Builder",
        "Pattern",
        "Prototype",
        "Pattern",
        "Singleton",
        "Pattern",
        "Strategy",
        "Pattern",
        "Observer",
        "Pattern",
        "State",
        "Pattern",
        "Template",
        "Method",
        "Pattern",
        "Command",
        "Pattern",
        "Iterator",
        "Pattern",
        "Mediator",
        "Pattern",
        "Memento",
        "Pattern",
        "Visitor",
        "Pattern",
        "Chain",
        "of",
        "Responsibility",
        "Pattern",
        "Proxy",
        "Pattern",
        "Adapter",
        "Pattern",
        "Bridge",
        "Pattern",
        "Composite",
        "Pattern",
        "Decorator",
        "Pattern",
        "Facade",
        "Pattern",
        "Flyweight",
        "Pattern",
      ],
    ];

    // Extract skills using word boundaries
    for (const category of skillCategories) {
      for (const skill of category) {
        // Create regex with word boundaries for exact matching
        const regex = new RegExp(
          `\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "gi",
        );
        const matches = readme.match(regex);
        if (matches) {
          skills.push(skill);
        }
      }
    }

    // Remove duplicates and normalize
    return [...new Set(skills.map((s) => s.trim()))];
  }

  /**
   * Categorize skill based on name
   */
  private categorizeSkill(skillName: string): string {
    const name = skillName.toLowerCase();

    // Programming languages
    if (
      [
        "typescript",
        "javascript",
        "python",
        "java",
        "go",
        "rust",
        "c++",
        "c#",
        "php",
        "ruby",
        "swift",
        "kotlin",
        "scala",
        "dart",
        "r",
        "matlab",
      ].includes(name)
    ) {
      return "Language";
    }

    // Frontend frameworks
    if (
      [
        "react",
        "vue",
        "angular",
        "next.js",
        "svelte",
        "nuxt",
        "gatsby",
      ].includes(name)
    ) {
      return "Frontend";
    }

    // Backend frameworks
    if (
      [
        "express",
        "fastify",
        "koa",
        "nestjs",
        "spring",
        "django",
        "flask",
        "rails",
        "laravel",
        "symfony",
      ].includes(name)
    ) {
      return "Backend";
    }

    // Databases
    if (
      [
        "postgresql",
        "mysql",
        "mongodb",
        "redis",
        "elasticsearch",
        "cassandra",
        "dynamodb",
        "sqlite",
      ].includes(name)
    ) {
      return "Database";
    }

    // Cloud/DevOps
    if (
      [
        "docker",
        "kubernetes",
        "k8s",
        "terraform",
        "aws",
        "azure",
        "gcp",
        "jenkins",
        "circleci",
        "github actions",
      ].includes(name)
    ) {
      return "DevOps";
    }

    // Tools
    if (
      [
        "git",
        "github",
        "gitlab",
        "npm",
        "yarn",
        "webpack",
        "vite",
        "parcel",
      ].includes(name)
    ) {
      return "Tools";
    }

    return "Technical";
  }

  /**
   * Infer proficiency level based on skill usage patterns
   */
  private inferProficiency(skill: GitHubSkill): Proficiency {
    // High confidence + multiple repos = advanced
    if (skill.confidence >= 0.8 && skill.repositories.length >= 3) {
      return Proficiency.advanced;
    }

    // Medium confidence + several repos = intermediate
    if (skill.confidence >= 0.6 && skill.repositories.length >= 2) {
      return Proficiency.intermediate;
    }

    // Low confidence or single repo = beginner
    return Proficiency.beginner;
  }

  /**
   * Check if two skill names match (with precise fuzzy matching)
   */
  private isSkillMatch(skill1: string, skill2: string): boolean {
    // Exact match
    if (skill1 === skill2) return true;

    // Be more careful with contains matching - only allow if it's a meaningful substring
    if (skill1.includes(skill2) || skill2.includes(skill1)) {
      // Avoid matching short words that are substrings of longer words
      if (skill1.length < 3 || skill2.length < 3) return false;

      // Special case: avoid matching "go" as substring of "google" or "github"
      if (
        (skill1 === "go" && skill2.includes("google")) ||
        (skill2 === "go" && skill1.includes("google"))
      ) {
        return false;
      }

      // Only allow contains match if the shorter word is at least 4 characters
      const shorter = skill1.length < skill2.length ? skill1 : skill2;
      const longer = skill1.length >= skill2.length ? skill1 : skill2;

      if (shorter.length >= 4 && longer.includes(shorter)) {
        return true;
      }
    }

    // Common abbreviations and variations (be more specific)
    const variations: Record<string, string[]> = {
      javascript: ["js", "javascript"],
      typescript: ["ts", "typescript"],
      "node.js": ["node", "nodejs", "node.js"],
      nodejs: ["node", "nodejs", "node.js"],
      postgresql: ["postgres", "postgresql"],
      mysql: ["mysql", "mysql"],
      kubernetes: ["k8s", "kubernetes"],
      k8s: ["kubernetes", "k8s"],
      react: ["react", "reactjs", "react.js"],
      reactjs: ["react", "reactjs", "react.js"],
      vue: ["vue", "vuejs", "vue.js"],
      vuejs: ["vue", "vuejs", "vue.js"],
      angular: ["angular", "angularjs"],
      angularjs: ["angular", "angularjs"],
      aws: ["aws", "amazon web services", "amazon webservices"],
      "amazon web services": [
        "aws",
        "amazon web services",
        "amazon webservices",
      ],
      gcp: ["gcp", "google cloud platform", "google cloud"],
      "google cloud platform": ["gcp", "google cloud platform", "google cloud"],
      "google cloud": ["gcp", "google cloud platform", "google cloud"],
      azure: ["azure", "microsoft azure"],
      "microsoft azure": ["azure", "microsoft azure"],
      docker: ["docker", "docker containers"],
      git: ["git", "git version control"],
      github: ["github", "github.com"],
      gitlab: ["gitlab", "gitlab.com"],
      python: ["python", "python3"],
      java: ["java", "java se", "java ee"],
      "c++": ["c++", "cpp", "c plus plus"],
      cpp: ["c++", "cpp", "c plus plus"],
      "c#": ["c#", "csharp", "c sharp"],
      csharp: ["c#", "csharp", "c sharp"],
      "c sharp": ["c#", "csharp", "c sharp"],
    };

    for (const variants of Object.values(variations)) {
      if (variants.includes(skill1) && variants.includes(skill2)) {
        return true;
      }
    }

    return false;
  }
}

// Export singleton instance
export const gitHubSkillsService = new GitHubSkillsService(new PrismaClient());
