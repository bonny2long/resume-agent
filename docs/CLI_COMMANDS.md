# 📋 Resume Agent CLI Commands

A concise reference for all available commands, grouped by category.

## 🚀 Complete Application Workflow

**Purpose:** Get everything you need for a job application in 6 steps.

# 1. Analyze job
npm run dev analyze <job-url> --save

# 2. Tailor resume
npm run dev tailor <job-id> --generate-embeddings

# 3. Generate resume
npm run dev generate <job-id>

# 4. Generate cover letter
npm run dev cover-letter <job-id>

# 5. Find hiring manager (NEW!)
npm run dev find-manager <job-id> --save

# 6. Generate LinkedIn message (NEW!)
npm run dev linkedin-message <job-id> --save

# Result:
# ✅ Tailored resume
# ✅ Cover letter
# ✅ Hiring manager contact
# ✅ LinkedIn connection message
# Ready to apply!

---

## 📝 Resume Management

**Purpose:** Manually view, edit, and manage your master resume data in the database.

| Command                                    | Description                                         |
| ------------------------------------------ | --------------------------------------------------- |
| `npm run dev -- resume list`               | View a summary of all your stored resume data.      |
| `npm run dev -- resume add-experience`     | Interactively add a work experience entry.          |
| `npm run dev -- resume add-project`        | Add a personal or professional project.             |
| `npm run dev -- resume add-skill`          | Add a skill with proficiency and category.          |
| `npm run dev -- resume add-education`      | Add an education entry.                             |
| `npm run dev -- resume edit <type> <id>`   | Edit an existing entry (experience, project, etc.). |
| `npm run dev -- resume delete <type> <id>` | Delete an entry from the database.                  |

---

## 📂 Import & Export

**Purpose:** Get data into and out of the system. Use these to load PDFs or restore backups.

| Command                        | Description                                                          |
| ------------------------------ | -------------------------------------------------------------------- |
| `npm run dev -- upload <file>` | Parse and import a single PDF or DOCX resume file.                   |
| `npm run dev -- upload-all`    | Batch process all PDFs/DOCXs found in `data/resumes/`.               |
| `npm run dev -- import`        | Interactive import from a JSON master resume file (restores backup). |
| `npm run dev -- export`        | Export your master resume to JSON (saved in `data/outputs/`).        |

---

## 🐙 GitHub & Skills

**Purpose:** Sync your coding history and verify your skills from actual code.

| Command                                   | Description                                                        |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev -- github sync`              | Connect to GitHub and fetch all your repositories.                 |
| `npm run dev -- github list`              | List synced repositories stored in the database.                   |
| `npm run dev -- github show <name>`       | View details of a specific repository.                             |
| `npm run dev -- extract-skills`           | Analyze high-quality repos to extract/verify skills automatically. |

---

## 💼 Job Applications & Analysis

**Purpose:** Analyze job postings and manage your applications.

| Command                                   | Description                                                |
| ----------------------------------------- | ---------------------------------------------------------- |
| `npm run dev -- list`                     | List various entities (jobs, applications, resumes, etc.). |
| `npm run dev -- list --type jobs`         | List analyzed job postings.                                |
| `npm run dev -- list --type applications` | List job applications.                                    |
| `npm run dev -- list --type resumes`      | List master resumes.                                       |
| `npm run dev -- list --type companies`    | List companies.                                            |
| `npm run dev -- list --type skills`       | List skills.                                               |
| `npm run dev -- jobs list`                | List all analyzed jobs in the database.                     |
| `npm run dev -- jobs show <job-id>`       | Show details of a specific job.                           |
| `npm run dev -- jobs search <query>`      | Search jobs by title or company.                          |
| `npm run dev -- jobs delete <job-id>`     | Delete an analyzed job.                                   |
| `npm run dev -- analyze <url>`            | Scrape a job posting and see how well your resume matches. |
| `npm run dev -- tailor <job-id>`          | Generate a tailored resume for a specific job.           |
| `npm run dev -- apply <url>`               | Start the application workflow for a specific job.        |
| `npm run dev -- research <company>`       | Scrape company website for culture and values.             |
| `npm run dev -- status`                   | View the status of your job applications.                  |

---

## 🔍 Hiring Manager & LinkedIn

**Purpose:** Find and connect with hiring managers for your job applications.

| Command                                                | Description                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `npm run dev -- find-manager [job-id]`                  | Find hiring manager for a specific job (interactive if no ID). |
| `npm run dev -- find-manager <job-id> --save`          | Find and save hiring manager to database.                     |
| `npm run dev -- linkedin-message [job-id]`              | Generate LinkedIn message for hiring manager.                 |
| `npm run dev -- linkedin-message <job-id> --type connection_request` | Generate connection request message (default).                |
| `npm run dev -- linkedin-message <job-id> --type initial_message` | Generate initial message after connecting.                     |
| `npm run dev -- linkedin-message <job-id> --type follow_up` | Generate follow-up message.                                    |
| `npm run dev -- linkedin-message <job-id> --tone professional` | Use professional tone (default).                               |
| `npm run dev -- linkedin-message <job-id> --tone enthusiastic` | Use enthusiastic tone.                                         |
| `npm run dev -- linkedin-message <job-id> --tone friendly` | Use friendly tone.                                             |
| `npm run dev -- linkedin-message <job-id> --no-story` | Exclude career transition story from message.                  |
| `npm run dev -- linkedin-message <job-id> --save`      | Save generated message to database.                            |

---

## 📄 Document Generation

**Purpose:** Generate professional ATS-friendly resume documents and cover letters from tailored data.

| Command                                                      | Description                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `npm run dev -- generate [job-id]`                            | Generate resume document (interactive job selection if no ID).  |
| `npm run dev -- generate <job-id> --format docx`             | Generate DOCX resume for a specific job.                       |
| `npm run dev -- generate <job-id> --format pdf`               | Generate PDF resume (not yet implemented, returns DOCX).        |
| `npm run dev -- generate <job-id> --template modern`         | Generate using modern template (default, ATS-friendly).        |
| `npm run dev -- generate <job-id> --template traditional`     | Generate using traditional template (conservative style).      |
| `npm run dev -- generate <job-id> --template minimal`        | Generate using minimal template (simple, clean).               |
| `npm run dev -- cover-letter [job-id]`                       | Generate cover letter (interactive job selection if no ID).     |
| `npm run dev -- cover-letter <job-id> --format docx`         | Generate DOCX cover letter for a specific job.                 |
| `npm run dev -- cover-letter <job-id> --format pdf`           | Generate PDF cover letter (not yet implemented, returns DOCX).  |
| `npm run dev -- cover-letter <job-id> --tone professional`   | Generate with professional tone (default).                    |
| `npm run dev -- cover-letter <job-id> --tone enthusiastic`  | Generate with enthusiastic tone.                               |
| `npm run dev -- cover-letter <job-id> --tone friendly`      | Generate with friendly tone.                                   |

**Resume Generation Examples:**
```bash
# Interactive job selection
npm run dev generate

# Generate for specific job with options
npm run dev generate 507ce59b-70be-478f-8789-ca3c45347ac4 --format docx --template modern

# Try different templates
npm run dev generate <job-id> --template traditional
```

**Cover Letter Generation Examples:**
```bash
# Interactive cover letter generation
npm run dev cover-letter

# Generate cover letter with specific tone
npm run dev cover-letter <job-id> --tone enthusiastic --format docx
```

---

## ⚙️ System & Utilities

**Purpose:** Setup, reset, and system monitoring.

| Command                           | Description                                                         |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev -- init`             | Initialize the database and set up your profile for the first time. |
| `npm run dev -- reset`            | Clear the database (options to clear only data or everything).      |
| `npm run dev -- reset-jobs`       | Delete all saved jobs and companies.                                |
| `npm run dev -- reset-jobs --force` | Delete jobs without confirmation prompt.                           |
| `npm run dev -- upload-all-fixed` | Upload and parse all resume files (fixed version).                  |
| `npm run dev -- upload-all-fixed --confirm` | Upload resumes without confirmation prompt.                       |
| `npm run dev -- credits`          | View remaining API credits for third-party services.                |
