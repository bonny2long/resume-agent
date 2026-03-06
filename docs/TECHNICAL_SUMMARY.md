# Resume Agent - Technical Summary

## Project Overview

Resume Agent is a sophisticated multi-agent LLM orchestration system designed to automate and optimize the job application process. The system analyzes job descriptions, performs semantic retrieval using vector embeddings, researches companies, identifies hiring managers, and generates tailored application materials.

## Architecture

### Monorepo Structure

The project uses Turborepo for monorepo management:

```
resume-agent/
├── packages/
│   └── shared/           # Shared utilities and types
├── src/
│   ├── agents/           # AI agent implementations
│   ├── services/         # Core business logic
│   ├── cli/              # CLI command handlers
│   ├── database/         # Prisma client and repositories
│   ├── orchestrator/     # Workflow orchestration
│   ├── config/           # Configuration and prompts
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── prisma/               # Database schema
└── docs/                 # Documentation
```

## Core Technologies

### LLM Service Architecture

The system implements a unified LLM service with multi-provider support:

```typescript
// src/services/llm.service.ts
export class LLMService {
  private anthropicClient?: Anthropic;
  private cohereClient?: CohereClientV2;
  private geminiClient?: GoogleGenerativeAI;
  private huggingFaceClient?: InferenceClient;
  
  private provider: "anthropic" | "cohere" | "gemini" | "huggingface";
  
  async complete(prompt: string, options: CompletionOptions): Promise<AgentResponse<string>> {
    // Primary provider with automatic fallback
    if (this.provider === "huggingface" && this.huggingFaceClient) {
      // Try Hugging Face first
    }
    // Fallback chain: HuggingFace -> Gemini -> Cohere
  }
}
```

Key features:
- Automatic provider detection based on available API keys
- Fallback chain for resilience (primary -> secondary -> tertiary)
- Retry logic with exponential backoff for rate limiting
- Token usage tracking and cost estimation
- JSON structured output support

### Embeddings Service

Vector embeddings for semantic search:

```typescript
// src/services/embeddings.service.ts
export class EmbeddingsService {
  async generateEmbedding(text: string): Promise<number[]> {
    // 1. Try Hugging Face (Primary)
    // 2. Try Gemini (Secondary)
    // 3. Try Cohere (Tertiary)
  }
  
  async searchSimilarExperiences(query: string, limit: number) {
    const queryEmbedding = await this.generateEmbedding(query);
    // pgvector similarity search
  }
}
```

### Database Layer

PostgreSQL with Prisma ORM and pgvector:

```typescript
// src/database/client.ts
export function getPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error"],
  });
}
```

Schema includes:
- MasterResume, Experience, Achievement, Project, Skill, Education
- Job, Company, Application
- HiringManager, LinkedInMessage, EmailMessage
- QuantifiedAchievement, EnhancedSummary, ATSAnalysis, STARStory

## Multi-Agent System

### Agent Types

1. **Job Analyzer**: Parses job postings from ATS platforms (Workday, Greenhouse, Lever, iCIMS)
2. **Resume Tailor**: RAG-based retrieval for relevant experiences
3. **Company Researcher**: Domain intelligence and tech stack detection
4. **Hiring Manager Finder**: Contact discovery via Hunter.io, Apollo, RocketReach
5. **Cover Letter Generator**: Personalized generation with tone options
6. **LinkedIn Message Generator**: Character-optimized outreach

### Agent Communication Pattern

```typescript
// Typed agent responses
interface AgentResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    confidence?: number;
    provider?: string;
  };
}
```

## RAG Pipeline

### Semantic Resume Tailoring

1. **Embedding Generation**: Convert job requirements to vectors
2. **Similarity Search**: Find relevant experiences using pgvector
3. **Content Retrieval**: Get top 3 experiences, 2 projects
4. **Tailored Generation**: Re-write with job-specific keywords

```typescript
// Resume tailoring workflow
async function tailorResume(jobId: string, resumeId: string) {
  const job = await jobRepository.findById(jobId);
  const jobEmbedding = await embeddings.generateEmbedding(job.description);
  
  const experiences = await prisma.experience.findMany({
    where: { resumeId },
    orderBy: { similarity: 'desc' } // pgvector
  });
  
  const tailored = await llm.complete(
    tailorPrompt(job, experiences.slice(0, 3))
  );
}
```

## Web Scraping

Custom scraper for job postings:

```typescript
// src/services/web-scraper.service.ts
class WebScraperService {
  async scrapeJobPosting(url: string): Promise<JobPosting> {
    // Try HTTP request first (Cheerio)
    // Fall back to Puppeteer for SPA/ATS platforms
    // Extract structured data based on platform type
  }
}
```

## External Integrations

### Contact Finder Services
- Hunter.io for email discovery
- Apollo for company contacts
- RocketReach for comprehensive lookup

### GitHub Integration
- Repository metadata synchronization
- Skills extraction from READMEs
- Technology stack detection

## CLI Architecture

Commander.js-based command system:

```typescript
// src/cli/commands/apply.ts
program
  .command('apply <job-url>')
  .description('Full application workflow')
  .option('--enhanced', 'Enhanced pipeline with all features')
  .action(async (jobUrl, options) => {
    const orchestrator = new ApplicationOrchestrator();
    await orchestrator.runFullWorkflow(jobUrl, options);
  });
```

Available commands:
- init, resume, analyze, jobs, tailor, generate
- cover-letter, find-manager, linkedin-message, email
- enhance (quantify, ats, summary, interview, linkedin, salary, brand, pivot)
- apply, status, credits

## Security Features

- API keys stored in environment variables only
- Rate limiting on external APIs
- Input sanitization for all user inputs
- SQL injection prevention via Prisma parameterized queries

## Skills Demonstrated

- TypeScript / Node.js development
- Multi-provider LLM integration (Anthropic, Gemini, Cohere, Hugging Face)
- Vector database (pgvector) and semantic search
- RAG (Retrieval Augmented Generation) patterns
- Web scraping (Puppeteer, Cheerio)
- Prisma ORM and PostgreSQL
- Monorepo architecture (Turborepo)
- CLI application design
- API integration (GitHub, Hunter, Apollo, RocketReach)
- Document generation (DOCX, PDF)
- Error handling and fallback patterns
- Exponential backoff retry logic
