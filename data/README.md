# Resume Agent Data Structure

This folder contains all the structured data used by the resume generation agent for creating personalized, compelling resumes.

## 📁 Folder Structure

### 📄 `/resumes/`
Contains all personal stories, achievements, and skills context for resume generation.

#### `/achievement-stories/`
Detailed project achievements with specific metrics and impact:
- `chef-bonbon.md` - AI recipe platform with 100+ users
- `united-airlines-ai-insights.md` - Enterprise AI platform (selected through RFP)
- `syncup-platform.md` - Collaboration platform (in development, Sept 2025 - Present)

#### `/skills-context/`
Technical expertise with specific examples and code snippets:
- `react-expertise.md` - React development with performance metrics
- `node-expertise.md` - Node.js backend with database integration
- *[Add more as needed for other technologies]*

#### `/transition-highlights/`
Career transition story and unique value proposition:
- `why-i-switched.md` - Motivation behind trades → tech transition
- `transferable-skills.md` - How trades skills translate to tech
- `unique-value-prop.md` - Competitive advantage and differentiation

#### `/PDF Resumes/`
Generated resume files for download and reference.

### 📁 `/skills/`
- `skills-database.json` - Comprehensive technical and soft skills database

### 📁 `/projects/`
- `project_metadata.json` - Project metadata with tech usage statistics

### 📁 `/outputs/`
Generated resumes and cover letters (auto-cleaned regularly)

### 📁 `/cache/`
System cache files (auto-managed)

## 🔄 How It Works

1. **Resume Tailor Agent** reads from achievement stories and skills context
2. **Career Story** is pulled from transition highlights
3. **Project Metrics** come from detailed achievement files
4. **Skills Database** provides comprehensive skill mapping
5. **Generated Content** is saved to outputs folder

## 📝 Adding New Content

### New Project Achievement
Create new file in `/resumes/achievement-stories/`:
```markdown
# Project Name

**Role**: Your Role  
**Timeline**: Month Year - Present  
**Team Size**: X developers  
**Status**: Development/Production

## Quantifiable Achievements
- **Metric**: Specific measurable result
- **Metric**: Another measurable result

## Technical Achievements
- **Technical**: Specific technical accomplishments
```

### New Skills Context
Add to `/resumes/skills-context/`:
```markdown
# Technology Name

## Core Skills
- List specific skills with examples
- Include code snippets
- Add performance metrics
```

## 🗑️ Maintenance

- Old output files are automatically cleaned monthly
- Keep achievement stories updated with latest metrics
- Add new skills as you learn them
- Update project statuses as they progress

## 📊 Data Quality

All content is designed to:
- ✅ Include specific metrics and numbers
- ✅ Demonstrate real-world impact
- ✅ Show technical depth with examples
- ✅ Tell authentic career transition story
- ✅ Align with ATS and human readers