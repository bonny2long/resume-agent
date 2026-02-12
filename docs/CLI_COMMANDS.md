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

# Show specific job details
npm run dev -- jobs show <job-id>

# Search jobs
npm run dev -- jobs search <query>

# Delete job
npm run dev -- jobs delete <job-id>

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

## 📧 **Email Follow-ups**

**Send professional follow-up emails**

```bash
# Generate follow-up email (will prompt for application selection)
npm run dev -- email

# Generate email for specific application
npm run dev -- email <application-id>

# Post-interview thank you email
npm run dev -- email <application-id> --type post_interview

# Check-in email (weeks later)
npm run dev -- email <application-id> --type check_in

# Save email to database
npm run dev -- email <application-id> --save

# Different tone
npm run dev -- email <application-id> --tone enthusiastic
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

# List GitHub repositories
npm run dev -- github list

# Show repository details
npm run dev -- github show <repo-name>

# Extract skills from GitHub
npm run dev -- extract-skills
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

## 📚 **Complete Command Reference**

| ✅ Status | Command | Description | Category |
|----------|---------|-------------|
| ✅ **READY** | `analyze <url>` | Analyze job posting from URL | 📊 Jobs |
| ✅ **READY** | `apply <url>` | Complete application workflow | 🚀 Applications |
| ✅ **READY** | `cover-letter [id]` | Generate cover letter | 📄 Documents |
| ✅ **READY** | `credits` | View API credits status | ⚙️ Utils |
| ✅ **READY** | `email [id]` | Generate follow-up email | 📧 Email |
| ✅ **READY** | `export` | Export resume data | 📁 Data |
| ✅ **READY** | `extract-skills` | Extract skills from GitHub | 📁 Data |
| ✅ **READY** | `find-manager [id]` | Find hiring manager | 🔍 Research |
| ✅ **READY** | `generate [id]` | Generate resume document | 📄 Documents |
| ✅ **READY** | `github list` | List GitHub repositories | 📁 Data |
| ✅ **READY** | `github show <repo>` | Show repository details | 📁 Data |
| ✅ **READY** | `github sync` | Sync GitHub repositories | 📁 Data |
| ✅ **READY** | `import` | Import resume data | 📁 Data |
| ✅ **READY** | `init` | Initialize system | ⚙️ Utils |
| ✅ **READY** | `jobs delete <id>` | Delete job | 📊 Jobs |
| ✅ **READY** | `jobs list` | List all jobs | 📊 Jobs |
| ✅ **READY** | `jobs search <query>` | Search jobs | 📊 Jobs |
| ✅ **READY** | `jobs show <id>` | Show job details | 📊 Jobs |
| ✅ **READY** | `linkedin-message [id]` | Generate LinkedIn message | 🔍 Research |
| ✅ **READY** | `list` | List master resumes | 📝 Resumes |
| ✅ **READY** | `research <company>` | Research company info | 🔍 Research |
| ✅ **READY** | `reset` | Reset database | ⚙️ Utils |
| ✅ **READY** | `reset-jobs` | Clear all jobs | ⚙️ Utils |
| ✅ **READY** | `resume` | Resume management commands | 📝 Resumes |
| ✅ **READY** | `status` | View system status | ⚙️ Utils |
| ✅ **READY** | `tailor <id>` | Tailor resume for job | 📊 Jobs |
| ✅ **READY** | `upload <file>` | Upload resume file | 📁 Data |
| ✅ **READY** | `upload-all` | Upload all resume files | 📁 Data |

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

**Follow-up Email:**
```bash
# After applying, follow up after a week
npm run dev -- email abc-123 --type initial_followup

# After interview, send thank you
npm run dev -- email abc-123 --type post_interview

# Check in if no response
npm run dev -- email abc-123 --type check_in
```

---

## 📄 **Document Generation Options**

**Resume Templates:**
- `--template modern` (default, ATS-friendly)
- `--template traditional` (conservative style)
- `--template minimal` (simple, clean)

**Cover Letter Tones:**
- `--tone professional` (default)
- `--tone enthusiastic`
- `--tone friendly`

**Formats:**
- `--format docx` (default)
- `--format pdf` (not yet implemented)

---

## 🔍 **LinkedIn Message Types**

**Message Types:**
- `--type connection_request` (default)
- `--type initial_message`
- `--type follow_up`

**Additional Options:**
- `--no-story` (exclude career transition story)
- `--save` (save to database)

---

## 📧 **Email Types**

**Follow-up Email Types:**
- `--type initial_followup` (default, after applying)
- `--type post_interview` (thank you after interview)
- `--type check_in` (weeks later, no response)

**Additional Options:**
- `--no-story` (exclude career transition story)
- `--save` (save to database)
- `--tone professional|enthusiastic|friendly`

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
- Always generate embeddings for better resume tailoring
- Use `--template modern` for ATS-friendly resumes
- Try different `--tone` options for cover letters

---

## 🚧 **Commands In Development**

These commands exist but may not be fully functional yet:

- (none currently - all core commands are implemented!)

---

**🆘 Need Help?**
- Run `npm run dev -- help` for command assistance
- Check `docs/CLI_COMMANDS.md` for detailed examples
- View `data/README.md` for data structure guide

---

## 📝 **Command Status Legend**

| ✅ Status | Meaning |
|----------|---------|
| ✅ **READY** | Fully functional and tested |
| 🚧 **IN DEV** | In development, may have limited functionality |
| 📋 **PLANNED** | Planned for future release |
| ⚠️ **DEPRECATED** | May be removed in future versions |