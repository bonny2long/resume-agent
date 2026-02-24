# Troubleshooting Guide

Common issues and how to fix them.

---

## Database Issues

### "Cannot connect to database"

**Error:**
```
Error: P1001: Can't reach database server
```

**Solution:**
1. Check PostgreSQL is running:
```bash
# macOS
brew services start postgresql

# Linux
sudo service postgresql start

# Windows
Start → Services → PostgreSQL
```

2. Verify DATABASE_URL in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/resume_agent"
```

3. Test connection:
```bash
psql -U resume_user -d resume_agent
```

---

### "Database does not exist"

**Solution:**
```bash
psql -U postgres -c "CREATE DATABASE resume_agent;"
```

---

### "Extension 'vector' does not exist"

**Solution:**
```bash
psql -U postgres -d resume_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

### "Table does not exist" / Migration Issues

**Solution:**
```bash
# Reset database (WARNING: loses all data)
npm run reset

# Or run migrations
npx prisma migrate dev
```

---

## API Key Issues

### "Credit balance is depleted"

**Error:**
```
Credit balance is depleted: purchase pre-paid credits
```

**Solution:**
1. Check which API key is depleted
2. Add credits to your account:
   - [Anthropic Console](https://console.anthropic.com)
   - [Google AI Studio](https://aistudio.google.com)
3. The system will automatically fall back to Gemini if Anthropic fails

---

### "API key not found"

**Error:**
```
API key is missing
```

**Solution:**
1. Check `.env` file exists in project root
2. Verify API keys are set:
```bash
# Check if keys are loaded
npm run dev -- status
```
3. Restart the dev server after updating `.env`

---

### "Invalid API key"

**Error:**
```
Invalid API key
```

**Solution:**
1. Double-check the key in your `.env`
2. Remove any extra spaces or quotes
3. Get fresh key from provider:
   - [Anthropic](https://console.anthropic.com)
   - [Google](https://aistudio.google.com/app/apikey)
   - [Cohere](https://dashboard.cohere.com/api-keys)

---

## LLM/AI Issues

### "Completion failed" / "Inference failed"

**Error:**
```
Failed to perform inference
```

**Solutions:**
1. **Check API credits** - You may have run out
2. **Try fallback** - System should auto-fallback to Gemini
3. **Check rate limits** - You may be throttled
4. **Retry** - Sometimes transient failures occur

---

### "Failed to parse response"

The AI returned invalid JSON or unexpected format.

**Solution:**
- Usually automatic, system has fallback parsing
- Try running the command again

---

### Embeddings Not Working

**Error:**
```
No embeddings found for experience
```

**Solution:**
```bash
# Generate embeddings for your resume
npm run dev -- tailor <job-id> --generate-embeddings
```

---

## CLI Issues

### "Command not found"

**Solution:**
```bash
# Make sure you're in the project directory
cd resume-agent

# Use npm run dev
npm run dev -- <command>
```

---

### "Module not found"

**Solution:**
```bash
# Rebuild the project
npm run build

# Install dependencies
npm install
```

---

## Web Scraping Issues

### "Failed to fetch job page"

**Solutions:**
1. **Job page requires login** - Some ATS systems need authentication
2. **Rate limiting** - Too many requests, wait and retry
3. **Invalid URL** - Check the job URL is correct
4. **Cloudflare protection** - Some companies use anti-bot protection

---

### "Failed to parse job details"

The scraper couldn't extract job information.

**Solution:**
1. Try running analyze again
2. Manually add job details via `jobs add` command
3. Report the issue if it's a common ATS system

---

## Document Generation Issues

### "Failed to generate DOCX"

**Solution:**
```bash
# Check document-generator service
npm run dev -- generate <job-id>
```

---

### "Resume looks wrong" / "Formatting issues"

**Solution:**
1. Check your master resume data is correct:
```bash
npm run dev -- resume list
```
2. Update experience/project data:
```bash
npm run dev -- resume add-experience
```

---

## GitHub Integration Issues

### "GitHub token invalid"

**Solution:**
1. Generate new token at: GitHub → Settings → Developer settings → Personal access tokens
2. Ensure token has `repo` scope
3. Update `GITHUB_TOKEN` in `.env`

---

### "No repositories found"

**Solution:**
1. Make sure you have public repos OR a valid GitHub token
2. Check your GitHub username is correct in your profile

---

## Performance Issues

### "Slow response times"

**Solutions:**
1. **Check API latency** - Some providers are slower than others
2. **Reduce max tokens** - Lower in `.env`:
   ```
   LLM_MAX_TOKENS=2000
   ```
3. **Use caching** - Enhanced pipeline results are cached in DB

---

## Reset Everything

If all else fails:

```bash
# 1. Reset database
npm run reset

# 2. Clear node_modules
rm -rf node_modules

# 3. Reinstall
npm install

# 4. Rebuild
npm run build

# 5. Reinitialize
npm run dev -- init
```

---

## Getting Help

1. **Check logs** - Error messages usually indicate the issue
2. **Run status** - `npm run dev -- status`
3. **Check Prisma Studio** - `npm run db:studio`
4. **Review docs** - `docs/README.md` and `docs/CLI_COMMANDS.md`
