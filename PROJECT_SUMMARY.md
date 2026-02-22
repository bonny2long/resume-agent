# Resume Agent - AI Workflow Orchestration System

## Project Overview

Resume Agent is a sophisticated multi-agent LLM orchestration system designed to automate and optimize the job application process. The system analyzes job descriptions, performs semantic retrieval using vector embeddings, researches companies, identifies hiring managers, and generates tailored application materials including resumes, cover letters, and LinkedIn outreach messages.

## Technical Architecture

### Multi-Agent Orchestration System

The system implements a coordinated multi-agent architecture where specialized agents work together to complete complex job application workflows:

- **Job Analyzer Agent**: Scrapes and parses job postings from various ATS (Applicant Tracking System) platforms including Workday, Greenhouse, Lever, iCIMS, and custom company websites. Extracts structured data including required skills, preferred skills, responsibilities, qualifications, experience level, and salary information.

- **Resume Tailor Agent**: Retrieves relevant experiences and projects from a master resume using retrieval augmented generation (RAG) with semantic embeddings. Optimizes achievements for ATS keyword matching while maintaining authenticity.

- **Company Researcher Agent**: Conducts comprehensive company research by scraping company websites, analyzing domain patterns, and generating insights about company culture, values, tech stack, and recent news.

- **Hiring Manager Finder Agent**: Identifies potential hiring managers through AI suggestions, company website analysis, and third-party contact databases (Hunter.io, Apollo). Ranks candidates by confidence and contact completeness.

- **Cover Letter Generator Agent**: Generates personalized cover letters tailored to specific job requirements and company culture. Supports multiple tones (professional, enthusiastic, friendly) and integrates career transition stories.

- **LinkedIn Message Generator Agent**: Creates connection requests and follow-up messages optimized for LinkedIn's character limits. Personalizes outreach based on hiring manager profiles and job context.

- **Email Agent**: Generates professional follow-up emails for various stages of the application process including initial follow-ups, post-interview communications, and check-ins.

### Retrieval Augmented Generation (RAG)

The system implements sophisticated RAG pipelines for contextual relevance:

- **Embedding-Based Retrieval**: Uses multiple embedding providers (Hugging Face, Google Gemini, Cohere) to generate vector representations of resume sections and job requirements.

- **Cosine Similarity Matching**: Performs semantic search to identify the most relevant experiences and projects for each job application.

- **Vector Storage**: Stores embeddings in PostgreSQL with pgvector extension for efficient similarity searches.

- **Fallback Mechanisms**: Implements graceful degradation when embedding services are unavailable, falling back to keyword-based selection.

### Tool Use Architecture

The system demonstrates advanced tool-calling capabilities:

- **Web Scraping Pipeline**: Custom web scraper service that handles both traditional websites and complex SPA/ATS platforms. Uses Puppeteer for JavaScript-rendered content and Cheerio for HTML parsing. Implements domain-specific extraction strategies for Workday, Greenhouse, Lever, and other common ATS systems.

- **Multi-Provider LLM Integration**: Unified LLM service that supports Anthropic Claude, Google Gemini, Cohere, and Hugging Face with automatic fallback chains. Implements retry logic with exponential backoff for rate limiting.

- **Database Integration**: Prisma ORM with PostgreSQL for persistent storage of resumes, jobs, applications, companies, and hiring manager information.

- **External API Integration**: Services for GitHub (repo metadata, skills extraction), contact finder APIs (Hunter.io, Apollo, RocketReach), and web research.

### Structured Evaluation

The system implements multiple evaluation mechanisms:

- **ATS Scoring**: Calculates keyword match scores, skill match percentages, experience relevance, and format scores to predict applicant tracking system success.

- **Humanness Validation**: Validates generated content to ensure it sounds authentic and avoids AI-generated patterns.

- **Confidence Scoring**: Hiring manager finder assigns confidence scores based on source verification, contact completeness, and data quality.

- **Match Score Calculation**: Job analyzer computes match scores between user skills and job requirements, identifying matched, missing, and extra skills.

### Embedding-Based Search

Semantic search capabilities power the resume tailoring process:

- **Experience Embedding**: Converts work experience descriptions into vector embeddings for similarity matching against job requirements.

- **Project Embedding**: Generates embeddings for portfolio projects to identify relevant demonstrations of skills.

- **Job Requirement Embedding**: Creates embeddings from job descriptions to enable cross-referencing with resume content.

- **Hybrid Retrieval**: Combines embedding-based similarity with keyword boosting for tech roles and recency sorting.

### Production-Grade Vector Database System

- **PostgreSQL + pgvector**: Production-ready vector storage using the pgvector extension for efficient nearest-neighbor searches.

- **Schema Design**: Comprehensive database schema with models for MasterResume, Experience, Achievement, Project, TechStack, Skill, Education, Certification, Company, Job, HiringManager, LinkedInMessage, EmailMessage, Application, and GitHubRepo.

- **Relationships**: Complex relational structure connecting resume sections, job applications, companies, and outreach activities.

- **Indexing**: Database indexes on frequently queried fields for performance optimization.

## Core Technical Capabilities

### Job Posting Analysis

- Parses job descriptions from 20+ ATS platform formats
- Extracts required vs preferred skills with confidence weighting
- Identifies experience level (entry, junior, mid, senior, staff, principal, executive)
- Detects remote/hybrid work arrangements
- Generates ATS-optimized keyword lists

### Resume Tailoring

- Selects 3 most relevant experiences using semantic similarity
- Identifies 2 most relevant projects
- Optimizes achievement descriptions with job-specific keywords
- Filters and orders skills by relevance
- Generates tailored professional summaries
- Extracts engineering skills from GitHub READMEs

### Company Research

- Domain-based company intelligence extraction
- Culture and values identification
- Tech stack detection from website content
- Recent news aggregation
- Industry classification

### Hiring Manager Identification

- AI-generated manager suggestions based on job titles
- Company website scraping for leadership information
- Third-party API integration (Hunter.io)
- Confidence-based ranking and deduplication
- LinkedIn profile URL generation

### Document Generation

- ATS-optimized resume generation with PDF/DOCX export
- Personalized cover letters with multiple tone options
- LinkedIn connection requests (under 300 characters)
- Professional follow-up emails

### GitHub Integration

- Automatic repository metadata synchronization
- Skills extraction from project descriptions
- README content analysis for engineering skills
- Technology stack detection

## Technology Stack

- **Language**: TypeScript / Node.js
- **Database**: PostgreSQL with pgvector
- **ORM**: Prisma
- **LLM Providers**: Anthropic Claude, Google Gemini, Cohere, Hugging Face
- **Embedding Models**: sentence-transformers, Gemini embeddings, Cohere embeddings
- **Web Scraping**: Puppeteer, Cheerio, Axios
- **CLI Framework**: Commander.js, Inquirer.js
- **Document Generation**: docx, pdf-lib, Handlebars
- **Testing**: Vitest with coverage reporting
- **Code Quality**: ESLint, Prettier

## Key Implementation Patterns

### Agent Communication

Agents communicate through well-defined interfaces with typed response objects:
```
{ success: boolean, data?: T, error?: string, metadata?: {...} }
```

### Fallback Chains

Multiple fallback mechanisms ensure system resilience:
- LLM provider fallback (primary -> secondary -> tertiary)
- Embedding provider fallback
- Scraping method fallback (HTTP -> Puppeteer)
- Content extraction fallback (structured data -> heuristics)

### Error Handling

Comprehensive error handling with graceful degradation:
- Failed AI parsing falls back to regex extraction
- Missing optional data uses intelligent defaults
- Network failures trigger retry with exponential backoff

### Configuration Management

Centralized configuration with environment variable support:
- API keys for all external services
- Provider selection and model configuration
- Feature flags and feature toggles
- Rate limiting parameters

## System Scale

- Supports unlimited job applications with full tracking
- Master resume with unlimited experiences, projects, and skills
- Company database with research history
- Hiring manager database with outreach history
- Application status tracking with timestamps and notes
