# Environment Variables Reference

All configuration for Resume Agent is managed through environment variables.

## Required Variables

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/resume_agent` |

### LLM Providers (At Least One Required)

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Yes (primary) |
| `GEMINI_API_KEY` | Google Gemini API key | For embeddings |
| `COHERE_API_KEY` | Cohere API key | For embeddings |

## Optional Variables

### GitHub Integration

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | No |

Get a token at: GitHub → Settings → Developer settings → Personal access tokens

### Contact Finding Services

| Variable | Description | Required |
|----------|-------------|----------|
| `HUNTER_API_KEY` | Hunter.io API key | No |
| `APOLLO_API_KEY` | Apollo.io API key | No |
| `ROCKETREACH_API_KEY` | RocketReach API key | No |

### LLM Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `anthropic` | Primary LLM: `anthropic`, `cohere`, `gemini` |
| `LLM_MODEL` | `claude-3-sonnet-20240229` | Model to use |
| `LLM_MAX_TOKENS` | `4000` | Max tokens per response |
| `LLM_TEMPERATURE` | `0.7` | Creativity level (0-1) |

### Embeddings Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDINGS_PROVIDER` | `gemini` | Provider: `cohere`, `gemini` |
| `GEMINI_EMBEDDING_MODEL` | `text-embedding-004` | Gemini embedding model |
| `COHERE_EMBEDDING_MODEL` | `embed-english-v3.0` | Cohere embedding model |

## Getting API Keys

### Anthropic (Required)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / Log in
3. Navigate to API Keys
4. Create a new key
5. Add credits to your account

### Google Gemini (Recommended for Embeddings)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with Google account
3. Get API key from AI Studio
4. Enable Gemini API in Google Cloud Console

### Cohere (Free Tier for Embeddings)
1. Go to [cohere.com](https://cohere.com)
2. Sign up for free account
3. Go to Dashboard → API Keys
4. Free tier: 1000 embeddings calls/month

### GitHub (Optional)
1. Go to GitHub Settings
2. Developer settings → Personal access tokens
3. Generate new token (classic)
4. Select `repo` scope

### Hunter.io (Optional)
1. Go to [hunter.io](https://hunter.io)
2. Sign up for free account
3. API key in dashboard

### Apollo.io (Optional)
1. Go to [apollo.io](https://apollo.io)
2. Sign up for free account
3. API key in settings

## Setting Up

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` with your values:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/resume_agent"
ANTHROPIC_API_KEY="sk-ant-..."
GEMINI_API_KEY="AIza..."
```

3. Verify in database:
```bash
npm run dev -- status
```

## Provider Priority

The system uses this fallback chain:

1. **Primary LLM**: Anthropic Claude (best quality)
2. **Fallback**: Google Gemini (if Anthropic fails)
3. **Embeddings**: Gemini (default) → Cohere (fallback)

## Rate Limits

| Provider | Limit | Notes |
|----------|-------|-------|
| Anthropic | Varies | Depends on tier |
| Gemini | 1500 req/min | Generous free tier |
| Cohere | 1000/mo | Free tier |
| GitHub | 5000/hr | Authenticated |
