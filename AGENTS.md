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

## Logging System

### Log Organization Strategy

The logging system uses a **layered separation** strategy to avoid duplicate records:

#### 1. Global Logs (`logs/global/`)

**Purpose**: Only records system-level and service-level general information, independent of specific tasks

**Log Files**:
- `system.log` - System startup, shutdown, scheduled task dispatching
- `server.log` - HTTP API request and response records

**Characteristics**:
- Continuously recorded throughout the service lifecycle
- Does not include detailed task execution processes
- Suitable for monitoring system operational status

#### 2. Task Logs (`logs/tasks/{taskId}/`)

**Purpose**: Records detailed processes of specific task execution, each task has an independent directory

**Log Files**:
- `main.log` - Task main process control (task start, end, statistics)
- `file-scan.log` - File scanning details (directory scanning, file discovery)
- `file-info.log` - File information parsing (EXIF, metadata extraction)
- `file-move.log` - File move operations (success, failure, retry)
- `ai.log` - AI classification call details (API calls, Token consumption, classification results)

**Characteristics**:
- Isolated by task ID for easy traceability of specific tasks
- Only recorded during task execution
- Contains complete task execution context

### Log Output Rules

| Log Module | Console | Global Log File | Task Log File | Description |
|-----------|---------|----------------|---------------|-------------|
| SYSTEM    | ✅ | ✅ | ❌ | System-level events |
| SERVER    | ✅ | ✅ | ❌ | HTTP requests |
| MAIN      | ✅ | ❌ | ✅ | Task main process |
| FILE_SCAN | ✅ | ❌ | ✅ | File scanning |
| FILE_INFO | ✅ | ❌ | ✅ | File parsing |
| FILE_MOVE | ✅ | ❌ | ✅ | File moving |
| AI        | ✅ | ❌ | ✅ | AI classification |

**Key Principle**: 
- ✅ All logs output to console (for real-time monitoring)
- ❌ Global logs and task logs are **mutually exclusive**, no duplicate recording

### Usage Examples

**Global Logs (System Events)**:
```typescript
import { systemLogger } from './logger.js';
systemLogger.info('Application started successfully');
```

**Global Logs (HTTP Requests)**:
```typescript
import { serverLogger } from './logger.js';
serverLogger.info({ method: 'GET', path: '/api/stats' }, 'API request');
```

**Task Logs (Requires Context)**:
```typescript
import { mainLogger, setCurrentTaskId } from './logger.js';

const taskId = 'task-2025-11-28-abc123';
setCurrentTaskId(taskId, false); // Enable task logging

mainLogger.info('Classification task started'); // Logs to logs/tasks/{taskId}/main.log

setCurrentTaskId(null); // Disable task logging
flushLogs(); // Ensure logs are written
```

### Log Level Guidelines

| Level | Purpose | Examples |
|-------|---------|----------|
| **fatal** | Fatal errors, service cannot continue | Database connection failure, critical config missing |
| **error** | Errors, but service can continue | Single file processing failure, API call failure |
| **warn** | Warnings, needs attention but doesn't affect functionality | Missing config uses default, retry operations |
| **info** | Key information points | Task start/end, file moved successfully |
| **debug** | Debug information | Detailed process, intermediate states |
| **trace** | Trace information | Most detailed execution details |

### Log Management

**Viewing Global Logs**:
```bash
# System startup and scheduling logs
tail -f logs/global/system.log

# HTTP API request logs
tail -f logs/global/server.log
```

**Viewing Task Logs**:
```bash
# List all tasks
ls logs/tasks/

# View specific task main process
tail -f logs/tasks/task-2025-11-28T14-00-00-abc123/main.log

# View specific task AI calls
tail -f logs/tasks/task-2025-11-28T14-00-00-abc123/ai.log
```

**Log Cleanup**:
```bash
# Delete task logs older than 30 days
find logs/tasks -type d -mtime +30 -exec rm -rf {} \;
```

### Key Functions

```typescript
// Set task context (enable task logging)
setCurrentTaskId(taskId: string, dryRun: boolean): void

// Clear task context (disable task logging)
setCurrentTaskId(null): void

// Get logger for specific module
getLogger(module: LogModule): pino.Logger

// Flush all logs to disk
flushLogs(): void

// Clean up log resources
cleanupLogFiles(): void
```

## Important Notes

- Both backend and frontend use **npm** as package manager
- Both backend and frontend use **Node.js** runtime
- Cron expressions must be 5-field Unix format (validated in `index.ts`)
- Files are processed in batches to avoid rate limits on AI API
- Similarity threshold of 0.65 is default for filename matching
- **Logging**: Global logs and task logs are mutually exclusive to avoid duplication
- **Task Context**: Must call `setCurrentTaskId()` before task execution and clear it after completion
