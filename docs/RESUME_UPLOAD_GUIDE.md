# Resume Upload Feature - Complete Guide 📄

## What We Just Built

A complete resume upload system that:

- ✅ Parses PDF and DOCX files
- ✅ Uses Claude AI to intelligently extract all data
- ✅ Previews before saving
- ✅ Saves to database automatically
- ✅ Handles validation and errors

## 📁 New Files Created

### Parser Services (3 files)

1. **`src/services/pdf-parser.service.ts`** (4.1KB)
   - Extracts text from PDF files
   - Gets word count, file size, metadata
   - Validates PDF files

2. **`src/services/docx-parser.service.ts`** (5.2KB)
   - Extracts text from DOCX files
   - Preserves formatting
   - Extracts images

3. **`src/services/resume-parser.service.ts`** (8.7KB)
   - AI-powered parsing with Claude
   - Extracts experiences, projects, skills, education
   - Validates parsed data
   - Calculates statistics

### CLI Command (1 file)

4. **`src/cli/commands/upload.ts`** (7.5KB)
   - Interactive upload flow
   - File detection (uploads/, Downloads/, Documents/)
   - Preview before saving
   - Database integration

### Updated Files

5. **`src/cli/index.ts`** - Added upload command
6. **`package.json`** - Added pdf-parse, mammoth

---

## 🚀 How to Use

### Step 1: Install New Dependencies

```bash
npm install
```

This installs:

- `pdf-parse` - PDF text extraction
- `mammoth` - DOCX text extraction

### Step 2: Put Your Resume in Uploads Folder

```bash
# Create uploads folder if needed
mkdir -p data/uploads

# Copy your resume
cp ~/Documents/my-resume.pdf data/uploads/
```

Or use any location!

### Step 3: Upload Your Resume

```bash
# From uploads/ folder (easiest)
npm run dev upload resume.pdf

# Or from any location
npm run dev upload ~/Documents/resume.pdf
npm run dev upload "C:\Users\You\Documents\resume.docx"
```

---

## 📊 Complete Example

```bash
$ npm run dev upload resume.pdf

╔══════════════════════════════════════════════════════════════════════╗
║            AI-Powered Resume & Application Agent                     ║
╚══════════════════════════════════════════════════════════════════════╝

Resume Upload
─────────────

📁 File: resume.pdf
📏 Size: 245.3 KB
📄 Type: PDF

? Parse this file? Yes

✓ Extracted 1,245 words

Parsing with AI...
✓ Parsing complete!

Preview - Personal Info
──────────────────────────
  John Doe
  john.doe@email.com
  (555) 123-4567
  LinkedIn: linkedin.com/in/johndoe
  GitHub: github.com/johndoe

Preview - Work Experience
──────────────────────────
  1. Senior Software Engineer at Google (Current)
     2020-01-15 - Present
     • Led team of 5 engineers to build new feature...

  2. Software Engineer at Microsoft
     2018-06-01 - 2020-01-01
     • Built cloud infrastructure automation tools...

  3. Junior Developer at Startup
     2016-08-15 - 2018-05-30
     • Developed RESTful APIs for mobile app...

  ... and 1 more

Preview - Projects
──────────────────
  1. AI Resume Agent
     Built AI-powered resume tailoring system...
     Tech: TypeScript, Claude API, PostgreSQL

  2. E-commerce Platform
     Full-stack e-commerce solution with payment...
     Tech: React, Node.js, Stripe, MongoDB

  3. Mobile Fitness App
     React Native fitness tracking application...
     Tech: React Native, Firebase, Redux

  ... and 3 more

Preview - Skills
────────────────
  JavaScript, TypeScript, Python, Java, React, Node.js, Express, PostgreSQL, MongoDB, AWS, Docker, Kubernetes, Git, CI/CD, Agile

? Save this data to your master resume? Yes

Saving to database...
✓ Saved to database!

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              Master Resume Created! ✓                        ║
║                                                              ║
║  Personal Info: John Doe                                     ║
║  Email: john.doe@email.com                                   ║
║                                                              ║
║  Data Imported:                                              ║
║  • 4 work experiences                                        ║
║  • 6 projects                                                ║
║  • 25 skills                                                 ║
║  • 2 education entries                                       ║
║  • 3 certifications                                          ║
║                                                              ║
║  Years of Experience: 8.2 years                              ║
║                                                              ║
║  Next steps:                                                 ║
║    1. Review: npm run dev resume list                        ║
║    2. Edit: npm run dev resume edit [id]                     ║
║    3. Apply: npm run dev apply <job-url>                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🎯 What Gets Extracted

### Personal Information

- ✅ Full name
- ✅ Email address
- ✅ Phone number
- ✅ Location
- ✅ LinkedIn URL
- ✅ GitHub URL
- ✅ Portfolio URL

### Work Experience

For each job:

- ✅ Company name
- ✅ Job title
- ✅ Location
- ✅ Start date (auto-formatted to YYYY-MM-DD)
- ✅ End date (or "Current")
- ✅ Description
- ✅ Achievements with metrics ("Increased revenue by 40%")
- ✅ Technologies used
- ✅ Impact level (high/medium/low)

### Projects

For each project:

- ✅ Project name
- ✅ Description
- ✅ Your role
- ✅ Technologies used
- ✅ Achievements
- ✅ GitHub URL (if present)
- ✅ Live URL (if present)
- ✅ Dates

### Skills

Automatically categorized into:

- ✅ Programming languages
- ✅ Frameworks
- ✅ Tools
- ✅ Databases
- ✅ Cloud platforms
- ✅ Soft skills

### Education

- ✅ Institution name
- ✅ Degree
- ✅ Field of study
- ✅ Dates
- ✅ GPA (if mentioned)

### Certifications

- ✅ Certification name
- ✅ Issuing organization
- ✅ Issue date
- ✅ Expiry date (if applicable)
- ✅ Credential ID
- ✅ URL

---

## 🧠 AI Parsing Intelligence

Claude AI automatically:

### ✅ Date Parsing

```
"Jan 2020 - Present"        → startDate: 2020-01-01, endDate: null
"June 2018 to Dec 2020"     → startDate: 2018-06-01, endDate: 2020-12-01
"2019 - 2022"               → startDate: 2019-01-01, endDate: 2022-01-01
"Summer 2020"               → startDate: 2020-06-01, endDate: 2020-08-31
```

### ✅ Metric Extraction

```
"Increased revenue by 40%"           → metrics: "40%"
"Led team of 5 engineers"            → metrics: "5 engineers"
"Reduced latency from 2s to 200ms"   → metrics: "90% reduction"
"Generated $2M in sales"             → metrics: "$2M"
```

### ✅ Technology Detection

```
"Built with React, Node.js, and PostgreSQL"
  → technologies: ["React", "Node.js", "PostgreSQL"]

"Used Python for data analysis"
  → technologies: ["Python"]
```

### ✅ Impact Classification

```
"Led team of 10, increased revenue by 50%"  → impact: high
"Fixed bug in login system"                 → impact: medium
"Updated documentation"                     → impact: low
```

---

## 🔧 Supported File Types

### ✅ PDF Files

- `.pdf`
- Any size
- Multi-page support
- Extracts all text content

### ✅ Word Documents

- `.docx` (Word 2007+)
- `.doc` (limited support)
- Preserves formatting
- Extracts images

### ❌ Not Supported (Yet)

- `.txt` (plain text - could add)
- `.rtf` (rich text format)
- Images of resumes (OCR - could add)
- LinkedIn profile exports (could add)

---

## 🛡️ Validation & Error Handling

### Errors (Will block save)

- ❌ Missing full name
- ❌ Missing company name in experience
- ❌ Missing job title in experience
- ❌ Invalid dates

### Warnings (Won't block save)

- ⚠️ Missing email
- ⚠️ Missing phone
- ⚠️ No work experience found
- ⚠️ No skills found

### Example with Warnings:

```
⚠️  Warnings:
  • Missing phone number
  • No certifications found

? Warnings found. Continue anyway? Yes
```

---

## 📂 File Finding Logic

The upload command searches in this order:

1. **Absolute path** - If you provide full path

   ```bash
   npm run dev upload /Users/you/Documents/resume.pdf
   ```

2. **data/uploads/** - Recommended location

   ```bash
   npm run dev upload resume.pdf
   # Automatically checks data/uploads/resume.pdf
   ```

3. **Current directory**

   ```bash
   npm run dev upload ./resume.pdf
   ```

4. **Common locations** - Downloads, Documents folders
   ```bash
   # Automatically checks:
   # - ~/Downloads/resume.pdf
   # - ~/Documents/resume.pdf
   ```

---

## 💾 What Gets Saved

All data goes into PostgreSQL:

### Tables Updated:

- ✅ `master_resumes` - Your basic info
- ✅ `experiences` - Work history
- ✅ `achievements` - Bullet points with metrics
- ✅ `projects` - Your projects
- ✅ `education` - Degrees
- ✅ `certifications` - Certificates
- ✅ `tech_stack` - Technologies (linked to experiences/projects)

### View Your Data:

```bash
# Open Prisma Studio
npx prisma studio

# Or use CLI (coming in Week 2)
npm run dev resume list
```

---

## 🔄 Uploading Again (Overwrite)

If you already have a master resume:

```bash
$ npm run dev upload new-resume.pdf

? Master resume already exists. Overwrite with new data? (y/N)
```

Options:

- **Yes** - Replaces all data
- **No** - Cancels upload (keeps existing)

---

## 🎨 Example Resumes to Test

### Test with Sample Resume:

```bash
# Create a test resume
cat > data/uploads/test-resume.txt << 'EOF'
JOHN DOE
john.doe@email.com | (555) 123-4567 | San Francisco, CA
LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe

PROFESSIONAL SUMMARY
Senior Full Stack Engineer with 8+ years building scalable web applications.
Expert in React, Node.js, and cloud technologies.

EXPERIENCE

Senior Software Engineer | Google | Mountain View, CA
Jan 2020 - Present
• Led team of 5 engineers to build new search feature, increasing user engagement by 40%
• Optimized database queries, reducing latency from 2s to 200ms (90% improvement)
• Technologies: TypeScript, React, Node.js, PostgreSQL, Kubernetes

Software Engineer | Microsoft | Seattle, WA
Jun 2018 - Dec 2019
• Built cloud infrastructure automation tools using Python and Azure
• Implemented CI/CD pipelines, reducing deployment time by 60%
• Technologies: Python, Azure, Docker, Terraform

PROJECTS

AI Resume Agent
Built AI-powered resume tailoring system using Claude API
Technologies: TypeScript, PostgreSQL, Claude API
GitHub: github.com/user/resume-agent

E-commerce Platform
Full-stack e-commerce solution with Stripe integration
Technologies: React, Node.js, MongoDB, Stripe

SKILLS
Languages: JavaScript, TypeScript, Python, Java
Frameworks: React, Node.js, Express, Next.js
Databases: PostgreSQL, MongoDB, Redis
Cloud: AWS, Azure, GCP, Kubernetes, Docker

EDUCATION
Bachelor of Science in Computer Science
Stanford University | 2014 - 2018 | GPA: 3.8

CERTIFICATIONS
AWS Certified Solutions Architect
Amazon Web Services | Jan 2022
EOF

# Convert to PDF or use as TXT
# Then upload
npm run dev upload test-resume.txt
```

---

## ⚡ Quick Tips

### Tip 1: Best File Location

```bash
# Always keep resumes in data/uploads/
data/uploads/
├── resume-current.pdf
├── resume-2023.pdf
├── resume-technical.pdf
└── resume-with-courses.pdf
```

### Tip 2: Multiple Versions

```bash
# Upload different versions
npm run dev upload resume-current.pdf
npm run dev upload resume-with-courses.pdf
```

### Tip 3: Check Before Upload

```bash
# Make sure file exists
ls data/uploads/resume.pdf

# Check file size
du -h data/uploads/resume.pdf
```

### Tip 4: Fix Bad Parses

If AI misses something:

```bash
# Upload to get most data
npm run dev upload resume.pdf

# Then manually add missing items
npm run dev resume add-experience
npm run dev resume add-project
```

---

## 🐛 Troubleshooting

### Error: "File not found"

```bash
# Check file exists
ls data/uploads/resume.pdf

# Or provide full path
npm run dev upload ~/Documents/resume.pdf
```

### Error: "Unsupported file type"

```bash
# Only PDF and DOCX supported
# Convert your file first:
# - Pages → Export as PDF
# - Google Docs → Download as PDF/DOCX
```

### Error: "Failed to parse PDF"

```bash
# PDF might be corrupted or encrypted
# Try:
# 1. Open in PDF viewer and "Save As" new file
# 2. Export as DOCX instead
# 3. Print to PDF
```

### Warning: "No work experience found"

```bash
# Resume format might be unusual
# Try:
# 1. Upload anyway - check what was parsed
# 2. Manually add missing experiences
# 3. Reformat resume to standard format
```

---

## 📊 What's Next?

Now that you can upload your resume:

### ✅ You Can Do:

1. **Upload your current resume** - Get all data in 5 minutes
2. **View your data** - `npx prisma studio`
3. **Start applying** - Once Week 3-4 are built

### 🚧 Coming in Week 2:

- `resume list` - View all data
- `resume add-experience` - Add manually
- `resume edit [id]` - Edit entries
- `github sync` - Import GitHub projects

### 📅 Coming in Week 3-4:

- `apply <job-url>` - Generate tailored resume
- Resume generation from your data
- ATS optimization

---

## 🎯 Ready to Test?

1. **Copy the new files** to your project
2. **Install dependencies**: `npm install`
3. **Put your resume** in `data/uploads/`
4. **Run upload**: `npm run dev upload resume.pdf`

**That's it!** Your entire resume will be in the database, ready to use for tailored applications! 🚀
