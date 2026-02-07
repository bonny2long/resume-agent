# 📋 Resume Agent CLI Commands

A concise reference for all available commands, grouped by category.

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

## 📄 Document Generation

**Purpose:** Generate professional ATS-friendly resume documents from tailored data.

| Command                                                | Description                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `npm run dev -- generate [job-id]`                      | Generate resume document (interactive job selection if no ID).  |
| `npm run dev -- generate <job-id> --format docx`       | Generate DOCX resume for a specific job.                       |
| `npm run dev -- generate <job-id> --format pdf`         | Generate PDF resume (not yet implemented, returns DOCX).        |
| `npm run dev -- generate <job-id> --template modern`   | Generate using modern template (default, ATS-friendly).        |
| `npm run dev -- generate <job-id> --template traditional` | Generate using traditional template (conservative style).      |
| `npm run dev -- generate <job-id> --template minimal`  | Generate using minimal template (simple, clean).               |

**Usage Examples:**
```bash
# Interactive job selection
npm run dev generate

# Generate for specific job with options
npm run dev generate 507ce59b-70be-478f-8789-ca3c45347ac4 --format docx --template modern

# Try different templates
npm run dev generate <job-id> --template traditional
```

---

## ⚙️ System & Utilities

**Purpose:** Setup, reset, and system monitoring.

| Command                  | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run dev -- init`    | Initialize the database and set up your profile for the first time. |
| `npm run dev -- reset`   | Clear the database (options to clear only data or everything).      |
| `npm run dev -- credits` | View remaining API credits for third-party services.                |
