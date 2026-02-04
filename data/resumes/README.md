# Resume Upload Instructions

## Quick Upload Process

1. **Place your resume file** in `data/resumes/` folder
   - Supported formats: PDF, DOCX
   - Example: `data/resumes/my-resume.pdf`

2. **Run the upload command**:
   ```bash
   npm run dev upload data/resumes/my-resume.pdf
   ```

## Supported Files

- ✅ PDF (.pdf)
- ✅ Microsoft Word (.docx)
- ❌ Plain text (.txt) - not supported

## What Happens During Upload

- Resume is parsed using AI (Claude 4.5)
- Data is extracted and structured
- Saved to PostgreSQL database
- Experiences, projects, skills, certifications are all processed

## Example Usage

### Single File Upload

```bash
# Upload your resume
npm run dev upload data/resumes/john-doe-resume.pdf

# Upload from any location (full path)
npm run dev upload C:\Users\Bonny\Documents\resume.pdf

# Upload from current directory
npm run dev upload ./resume.pdf
```

### Bulk Upload (All Files)

```bash
# Upload ALL resume files from data/resumes/ folder
npm run dev upload-all

# Skip confirmation prompt
npm run dev upload-all --confirm
```

## After Upload

- Check database with: `npm run dev status`
- View parsed data in database tables
- Use `npm run dev list` to see all master resumes
