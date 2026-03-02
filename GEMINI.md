# Gemini Project Context: AI Resume Agent

This document provides a comprehensive overview of the "AI Resume Agent" project to be used as a primary context for Gemini.

## Project Overview

Resume Agent is a sophisticated, multi-agent LLM orchestration system designed to automate and optimize the job application process. It leverages a suite of specialized AI agents to analyze job descriptions, tailor resumes, research companies, find hiring managers, and generate application materials like cover letters and outreach messages.

The system is architected as a TypeScript monorepo using pnpm workspaces and Turborepo for build orchestration. It includes a core CLI application, a server, and a client package, though the primary interface appears to be the CLI.

### Core Features

*   **Multi-Agent Orchestration:** Specialized agents for job analysis, resume tailoring, company research, and more, work in concert.
*   **Retrieval Augmented Generation (RAG):** Uses vector embeddings (via PostgreSQL with `pgvector`) and semantic search to find the most relevant experiences from a master resume.
*   **Advanced Tool-Calling:** Integrates with various tools and services, including a custom web scraping pipeline (Puppeteer/Cheerio), multiple LLM providers (Anthropic, Gemini, Cohere), and external APIs (GitHub, Hunter.io, Apollo).
*   **Comprehensive CLI:** A rich set of commands to manage the entire job application lifecycle, from initial analysis to follow-up emails.
*   **Data Persistence:** Uses Prisma ORM with a PostgreSQL database to store all relevant data, including resumes, jobs, companies, and applications.
*   **Enhanced Career Tools:** Includes advanced features inspired by elite consulting firms for resume quantification, ATS optimization, interview prep, and personal branding.

## Technology Stack

*   **Language:** TypeScript
*   **Monorepo/Build:** pnpm Workspaces, Turborepo
*   **Database:** PostgreSQL with `pgvector`
*   **ORM:** Prisma
*   **Primary Interface:** Node.js CLI (Commander.js, Inquirer.js)
*   **LLM Providers:** Anthropic Claude, Google Gemini, Cohere, Hugging Face
*   **Web Scraping:** Puppeteer, Cheerio
*   **Testing:** Vitest
*   **Code Quality:** ESLint, Prettier

## Project Structure

The project is a monorepo with the following key directories:

*   `src/`: Contains the source code for the main CLI application, including agents, services, and command definitions.
*   `packages/`: Houses shared code (`shared`), a `server` component, and a `client` (Next.js) component.
*   `data/`: Contains user-specific data like resumes, skills databases, and generated outputs.
*   `docs/`: Extensive project documentation, including architecture summaries and command references.
*   `prisma/`: Contains the Prisma schema and migration files.
*   `scripts/`: Utility scripts for database checks and other tasks.

## Building and Running

The project uses `pnpm` as the package manager and `turbo` for running tasks across the monorepo.

### Key Commands

The main entry point for development is `npm run dev --`, which is an alias for the CLI.

*   **Install dependencies:**
    ```bash
    pnpm install
    ```

*   **Run the CLI (Development):**
    All commands are run through the `dev` script.
    ```bash
    npm run dev -- <command>
    ```
    *Example:*
    ```bash
    npm run dev -- apply <job-url>
    npm run dev -- jobs list
    npm run dev -- enhance quantify
    ```

*   **Build the project:**
    ```bash
    pnpm build
    ```

*   **Run linters:**
    ```bash
    pnpm lint
    ```

*   **Run tests:**
    ```bash
    pnpm test
    ```

A comprehensive list of all CLI commands can be found in `docs/CLI_COMMANDS.md`.

## Development Conventions

*   **Monorepo Structure:** Code is organized into packages and a main `src` directory. `turbo` orchestrates the dependencies and build process between them.
*   **TypeScript:** The entire codebase is written in TypeScript.
*   **Database:** All database interactions are managed through the Prisma ORM. The schema is defined in `prisma/schema.prisma`.
*   **Agents:** The core logic is encapsulated in "agents" found in `src/agents`. These agents are specialized for specific tasks.
*   **CLI Commands:** New CLI commands are added in the `src/cli/commands` directory.
*   **Data:** User-specific, modifiable data (like resume stories and skills) is stored in the `data/` directory, which is under gitignore.
