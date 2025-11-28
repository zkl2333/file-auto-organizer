# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

File Auto Organizer is a monorepo project that automatically organizes files using AI. It analyzes file content and decides which folder to place files in, using either filename similarity matching or OpenAI API for content-based classification.

## Architecture

### Monorepo Structure

- **backend/**: Fastify server with scheduled cron jobs (Node.js + TypeScript)
- **frontend/**: React SPA with Vite (React 19 + TypeScript + Tailwind CSS)
- **Root**: Orchestration scripts for running both frontend and backend together

### Backend Architecture (backend/src/)

Core services located in `backend/src/service/`:

1. **main.service.ts**: Orchestrates the entire classification workflow
   - Scans incoming directory for files to classify
   - First attempts filename similarity matching using Levenshtein distance
   - Falls back to AI classification for unmatched files
   - Processes AI classification in configurable batches
   - Dynamically maintains known directory list during classification

2. **file-scan.service.ts**: Scans directories and files
3. **file-info.service.ts**: Extracts file metadata using exiftool-vendored
4. **ai-classification.service.ts**: Handles batch AI classification via OpenAI API
5. **file-move.service.ts**: Moves files to target directories with retry logic
6. **stats.service.ts**: Tracks classification statistics

Backend entry point: `backend/src/index.ts`
- Starts cron-based scheduler using node-cron
- Starts Fastify HTTP server for manual triggers and frontend API
- Registers cleanup handlers via process-manager.ts

### Frontend Architecture (frontend/src/)

Routes (using React Router):
- `/` - Dashboard overview
- `/stats` - Statistics page
- `/logs` - Log viewer
- `/trigger` - Manual trigger interface
- `/config` - Configuration management

UI built with shadcn/ui components and Radix UI primitives.

## Development Commands

### Root Directory

```bash
# Install dependencies for root orchestration
npm install

# Development - runs both frontend and backend concurrently
npm run dev

# Run only backend in dev mode
npm run dev:backend

# Run only frontend in dev mode
npm run dev:frontend

# Build both frontend and backend
npm run build

# Start production backend (assumes already built)
npm run start

# Run backend tests
npm run test

# Run backend tests with coverage
npm run test:coverage

# Run backend tests in watch mode
npm run test:watch
```

### Backend (cd backend/)

```bash
# Install dependencies (uses npm)
npm install

# Build TypeScript to dist/
npm run build

# Start development mode with auto-reload
npm run dev

# Start production mode
npm run start

# Run tests (Vitest)
npm run test

# Run tests in watch mode
npm run test:watch
```

### Frontend (cd frontend/)

```bash
# Install dependencies (uses npm)
npm install

# Start Vite dev server
npm run dev

# Build for production
npm run build

# Lint with ESLint
npm run lint

# Preview production build
npm run preview
```

## Configuration

Configuration is loaded from `config.yaml` (see `config.yaml.example`):

- **openai**: API key, model, and base_url for OpenAI-compatible endpoints
- **directories**: 
  - `root_dir` - where classified files are stored
  - `incoming_dir` - where files to be classified are located
- **cron.schedule**: Cron expression for scheduled execution (5-field Unix format, NOT Quartz)
- **scan.similarity_threshold**: Levenshtein similarity threshold (0-1) for filename matching
- **ai.batch_size**: Number of files to classify per AI API call

Configuration is read in `backend/src/config.ts`.

## Key Workflow

1. **Scan**: Read all files from `incoming_dir` and existing files in `root_dir`
2. **Similarity Match**: Calculate Levenshtein distance between incoming filenames and known files
3. **AI Classification**: For files below similarity threshold, extract metadata and send to OpenAI in batches
4. **Move**: Move files to classified directories (creates new directories as needed)
5. **Track**: Update known directory list dynamically and log all operations

## Docker Deployment

Build: `docker build -t file-auto-organizer .`

The Dockerfile uses Node.js 20 Alpine and:
- Installs Perl for exiftool-vendored
- Sets TZ=Asia/Shanghai
- Builds backend TypeScript
- Runs backend in production mode

See `docker-compose.yaml` for volume mount configuration.

## Testing

Backend uses Vitest framework. Test fixtures are in `backend/tests/fixtures/`.

Run tests with `npm run test` from root or backend directory.

## Important Notes

- Both backend and frontend use **npm** as package manager
- Both backend and frontend use **Node.js** runtime
- Cron expressions must be 5-field Unix format (validated in `index.ts`)
- Files are processed in batches to avoid rate limits on AI API
- Similarity threshold of 0.65 is default for filename matching
