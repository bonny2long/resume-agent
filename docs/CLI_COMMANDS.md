# 📋 Resume Agent CLI Commands

> **💡 Quick Start:** Most commands are simple and intuitive. Just `npm run dev <command>` to get started!

---

## 🚀 **Complete Application Workflow**

**Get everything you need in one command!**

```bash
# Full application workflow (6 steps)
npm run dev -- apply <job-url>

# Step-by-step application
npm run dev -- analyze <job-url>
npm run dev -- tailor <job-id> 
npm run dev -- generate <job-id>
npm run dev -- cover-letter <job-id>
npm run dev -- find-manager <job-id>
```

**Result:** 
✅ Resume + Cover Letter + Hiring Manager + LinkedIn Message = Complete Application Package

---

## 📝 **Resume Management**

**Your master resume - keep it updated!**

```bash
# View your resume data
npm run dev -- resume list

# Add new experience
npm run dev -- resume add-experience

# Add a project
npm run dev -- resume add-project

# Add skills
npm run dev -- resume add-skill

# Import PDF resume
npm run dev -- upload resume.pdf
```

---

## 📊 **Job Analysis & Applications**

**Analyze jobs and track applications**

```bash
# List all jobs
npm run dev -- jobs list

# Analyze new job
npm run dev -- analyze <job-url>

# Tailor resume for job
npm run dev -- tailor <job-id>

# Generate documents
npm run dev -- generate <job-id> --template modern
```

---

## 🔍 **Company Research & LinkedIn**

**Find hiring managers and connect**

```bash
# Research company
npm run dev -- research <company-name>

# Find hiring manager
npm run dev -- find-manager <job-id>

# Generate LinkedIn message
npm run dev -- linkedin-message <job-id> --tone professional

# Send connection request
npm run dev -- linkedin-message <job-id> --type connection_request
```

---

## 📁 **Data Management**

**Keep your data organized**

```bash
# Export your data
npm run dev -- export

# Import backup
npm run dev -- import

# Sync GitHub projects
npm run dev -- github sync
```

---

## 🛠️ **Utilities & Setup**

**System management commands**

```bash
# Initialize system
npm run dev -- init

# View system status
npm run dev -- status

# Reset everything
npm run dev -- reset

# View API credits
npm run dev -- credits
```

---

## 📚 **Command Categories**

| Category | Commands | Description |
|----------|-----------|-------------|
| **🚀 Applications** | `apply`, `analyze`, `tailor`, `generate`, `cover-letter` | Complete job application workflow |
| **📝 Resumes** | `resume list`, `resume add-experience`, `add-project`, `add-skill` | Manage your master resume |
| **📊 Jobs** | `jobs list`, `jobs search`, `jobs show`, `jobs delete` | View and manage job postings |
| **🔍 Research** | `research`, `find-manager`, `linkedin-message` | Company research and networking |
| **📁 Data** | `export`, `import`, `github sync`, `upload` | Data import/export and backup |
| **⚙️ Utils** | `init`, `status`, `reset`, `credits` | System setup and management |

---

## 🎯 **Popular Command Examples**

**Complete Application:**
```bash
npm run dev -- apply https://careers.company.com/jobs/123
```

**Quick Resume Generation:**
```bash
npm run dev -- generate --template modern
```

**Find Hiring Manager:**
```bash
npm run dev -- find-manager abc-123 --save
```

**LinkedIn Connection:**
```bash
npm run dev -- linkedin-message abc-123 --save
```

---

## 💡 **Pro Tips**

**🔥 Save Time:**
- Use `npm run dev -- apply <url>` for complete workflow
- Save job analysis with `--save` flag
- Save hiring managers with `--save` flag

**📋 Data Organization:**
- Keep achievement stories updated in `data/resumes/achievement-stories/`
- Update career story in `data/resumes/transition-highlights/`
- Skills database in `data/skills/skills-database.json`

**🎯 Best Practices:**
- Always `--generate-embeddings` for better resume tailoring
- Use `--template modern` for ATS-friendly resumes
- Try different `--tone` options for cover letters

---

**🆘 Need Help?**
- Run `npm run dev -- help` for command assistance
- Check `docs/CLI_COMMANDS.md` for detailed examples
- View `data/README.md` for data structure guide

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
| ------------------------------------------ | -------------------------------------------------------------------- |
| `npm run dev -- find-manager [job-id]`                  | Find hiring manager for a specific job (interactive if no ID). |
| `npm run dev -- find-manager <job-id> --save`          | Find and save hiring manager to database.                     |
| `npm run dev -- find-manager --list`                     | List all saved hiring managers with details.                  |
| `npm run dev -- find-manager --help`                    | Show help for find-manager commands.                       |
| `npm run dev -- find-manager --list`                     | List all saved hiring managers with details.                  |
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
npm run dev -- generate

# Generate for specific job with options
npm run dev -- generate 507ce59b-70be-478f-8789-ca3c45347ac4 --format docx --template modern

# Try different templates
npm run dev -- generate <job-id> --template traditional
```

**Cover Letter Generation Examples:**
```bash
# Interactive cover letter generation
npm run dev -- cover-letter

# Generate cover letter with specific tone
npm run dev -- cover-letter <job-id> --tone enthusiastic --format docx
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
