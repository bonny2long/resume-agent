#!/bin/bash
# setup.sh - Automated setup script for Resume Agent

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║              Resume Agent - Setup Script                 ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo -e "${BLUE}Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be 18 or higher${NC}"
    echo "Current version: $(node -v)"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"

# Check if PostgreSQL is installed
echo -e "${BLUE}Checking PostgreSQL installation...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠ PostgreSQL is not installed or not in PATH${NC}"
    echo "Please install PostgreSQL 12+ from https://www.postgresql.org/download/"
    read -p "Press enter to continue if PostgreSQL is installed..."
else
    echo -e "${GREEN}✓ PostgreSQL is installed${NC}"
fi

# Check if .env exists
echo -e "${BLUE}Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "Creating .env from .env.example..."
    
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env file${NC}"
        echo -e "${YELLOW}⚠ Please edit .env and add your API keys${NC}"
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Install npm dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create data directories
echo -e "${BLUE}Creating data directories...${NC}"
mkdir -p data/outputs
mkdir -p data/cache
mkdir -p data/uploads
echo -e "${GREEN}✓ Data directories created${NC}"

# Check if database exists
echo -e "${BLUE}Checking database setup...${NC}"
read -p "Have you created the PostgreSQL database 'resume_agent'? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Please create the database first:${NC}"
    echo ""
    echo "  psql -U postgres"
    echo "  CREATE DATABASE resume_agent;"
    echo "  CREATE USER resume_user WITH PASSWORD 'your_password';"
    echo "  GRANT ALL PRIVILEGES ON DATABASE resume_agent TO resume_user;"
    echo "  \\q"
    echo ""
    echo "Then install pgvector extension:"
    echo "  psql -U postgres -d resume_agent -c \"CREATE EXTENSION IF NOT EXISTS vector;\""
    echo ""
    read -p "Press enter when done..."
fi

# Run Prisma migrations
echo -e "${BLUE}Running database migrations...${NC}"
npx prisma migrate dev --name init --skip-generate || {
    echo -e "${RED}❌ Migration failed${NC}"
    echo "Please ensure:"
    echo "  1. PostgreSQL is running"
    echo "  2. Database credentials in .env are correct"
    echo "  3. Database 'resume_agent' exists"
    exit 1
}

# Generate Prisma client
echo -e "${BLUE}Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"

# Build TypeScript
echo -e "${BLUE}Building TypeScript...${NC}"
npm run build || {
    echo -e "${YELLOW}⚠ Build failed, but you can still use 'npm run dev'${NC}"
}

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║                  Setup Complete! 🎉                        ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "  1. Edit .env and add your API keys:"
echo "     - ANTHROPIC_API_KEY (required)"
echo "     - GITHUB_TOKEN (optional)"
echo ""
echo "  2. Initialize your master resume:"
echo "     npm run dev init"
echo ""
echo "  3. Add your experience and projects:"
echo "     npm run dev resume add-experience"
echo "     npm run dev resume add-project"
echo ""
echo "  4. Apply for a job:"
echo "     npm run dev apply <job-url>"
echo ""
echo -e "${YELLOW}Need help getting API keys? See SETUP_GUIDE.md${NC}"
echo ""