# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

File Auto Organizer is a Next.js 16 full-stack application that automatically organizes files using AI. It combines frontend UI and backend services in a single monorepo. Files are classified using filename similarity matching (Levenshtein distance) or OpenAI API for content-based classification.

## Architecture

### Project Structure

- **src/**: Source code (frontend + backend combined)
  - `app/`: Next.js App Router (pages, layouts, API routes)
  - `components/`: React components (UI components in `ui/` subdirectory)
  - `lib/`: Shared services and utilities
    - `services/`: Backend services (file-scan, file-info, ai-classification, file-move, stats, log)
    - `task-manager/`: Task orchestration (task, task-executor, task-manager)
    - `utils/`: Helper utilities (similarity, file, task utilities)
    - `config.ts`: Configuration loader (YAML-based with env overrides)
    - `logger.ts`: Pino-based logging with daily rotation
    - `api-client.ts`: Frontend API client using SWR
  - `types/`: TypeScript type definitions
- **tests/**: Vitest test files
- **logs/**: Application logs (app-YYYY-MM-DD.log, rotated daily)

### Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, shadcn/ui components, Radix UI
- **Backend**: Next.js API routes, node-cron, pino, rotating-file-stream
- **Testing**: Vitest with v8 coverage provider
- **AI**: OpenAI API (compatible endpoints supported)

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server on port 8080
npm run build            # Build for production
npm run start            # Start production server (port 8080)

# Code Quality
npm run lint             # Run ESLint
npm run prepare          # Install husky git hooks

# Testing
npm run test             # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report

# Run single test file
npx vitest run <path-to-test>          # Run specific test file
npx vitest run <path-to-test> --reporter=verbose  # Run with detailed output
```

### Examples

```bash
# Run a specific service test
npx vitest run tests/services/file-scan.service.test.ts

# Run a specific test by name
npx vitest run -t "should scan directories"

# Run tests in watch mode for a specific file
npx vitest tests/services/file-scan.service.test.ts
```

## Code Style Guidelines

### Formatting

Configuration in `.prettierrc`:

- **Semicolons**: Required
- **Quotes**: Single quotes
- **Indentation**: 2 spaces
- **Trailing comma**: es5
- **Print width**: 100 characters
- **Line ending**: LF
- **Editor**: Use `.editorconfig` for consistent settings

### TypeScript Rules

Configuration in `tsconfig.json`:

- **strict mode**: Enabled
- **noImplicitAny**: Enabled
- **noImplicitReturns**: Enabled
- **noUnusedLocals**: Enabled
- **noUnusedParameters**: Enabled
- **target**: ES2017
- **module**: esnext
- **jsx**: react-jsx
- **Path aliases**: `@/*` → `./src/*`

### Import Style

```typescript
// 1. Node.js built-in modules
import fs from 'node:fs';
import path from 'node:path';

// 2. Third-party libraries
import pino from 'pino';
import OpenAI from 'openai';

// 3. Internal modules (use @/* alias)
import { logger } from '@/lib/logger';
import { getConfig } from '@/lib/config';
import { Card, CardContent } from '@/components/ui/card';
```

### Naming Conventions

```typescript
// Classes: PascalCase
export class FileScanService {}
export class TaskManager {}
export class AIClassificationService {}

// Functions/Methods: camelCase
export function scanFiles(rootDir: string): string[] {}
export function classifyFiles(files: FileInfo[]): Promise<ClassificationResult> {}
private calculateSimilarity(str1: string, str2: string): number {}

// Variables/Constants: camelCase
const config = getConfig();
const maxDepth = 10;
const filesList = [];

// Constants that are truly immutable: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 30000;
const SIMILARITY_THRESHOLD = 0.8;

// Interfaces: PascalCase
interface AppConfig {}
interface TaskStatus {}
interface ProcessedFile {}

// Types: PascalCase for unions/aliases
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

// Enums: PascalCase
enum TaskStage {
  SCAN = 'scan',
  ANALYZE = 'analyze',
  MOVE = 'move',
}

// File names: kebab-case
// file-scan.service.ts
// ai-classification.service.ts
// similarity-utils.ts

// Component files: PascalCase.tsx
// StatCard.tsx
// TriggerView.tsx
```

### Error Handling

```typescript
// Try-catch with typed error handling
async function processFile(filePath: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Process content
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, filePath }, `Failed to process file: ${errorMessage}`);
    throw new Error(`File processing failed: ${errorMessage}`);
  }
}

// Validation errors
function validateConfig(config: Partial<AppConfig>): void {
  if (!config.openai?.api_key) {
    throw new Error('OpenAI API key is required');
  }
}

// API route error responses
export async function GET() {
  try {
    const data = await fetchData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

### Component Style

```typescript
'use client'; // Add for client components

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onAction }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await onAction?.();
    } finally {
      setLoading(false);
    }
  }, [onAction]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleClick} disabled={loading}>
          {loading ? 'Loading...' : 'Action'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default MyComponent;
```

### Service Pattern

```typescript
import { logger } from '@/lib/logger';
import { getConfig } from '@/lib/config';

export class FileScanService {
  private maxDepth: number;

  constructor() {
    const config = getConfig();
    this.maxDepth = config.scan.max_depth;
  }

  /**
   * Scan directory tree, return relative paths
   */
  scanDirs(rootDir: string): string[] {
    const result: string[] = [];

    function walk(dir: string, base: string = ''): void {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          // Process entries
        }
      } catch (error) {
        logger.warn({ error, dir }, 'Failed to read directory');
      }
    }

    if (fs.existsSync(rootDir)) {
      walk(rootDir);
      logger.debug({ dirs: result.length }, 'Scan completed');
    }
    return result;
  }
}
```

### Testing Style

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileScanService } from '@/lib/services/file-scan.service';

describe('FileScanService', () => {
  let service: FileScanService;

  beforeEach(() => {
    service = new FileScanService();
  });

  afterEach(() => {
    // Cleanup
  });

  it('should scan directories correctly', () => {
    const result = service.scanDirs('/test/path');
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle non-existent directories', () => {
    const result = service.scanDirs('/nonexistent');
    expect(result).toEqual([]);
  });
});
```

## Configuration

Configuration loaded from `config.yaml` (created automatically if missing):

- **openai**: API key, model, base_url
- **directories**: root_dir (classified files), incoming_dir (files to classify)
- **cron**: enabled, schedule (5-field Unix format)
- **logging**: level, dir
- **scan**: max_depth, similarity_threshold
- **ai**: batch_size
- **file_operations**: max_retries, retry_delay_base

Environment overrides supported (e.g., `OPENAI_API_KEY`, `ROOT_DIR`, `LOG_LEVEL`).

## Key Workflow

1. **Scan**: Read files from `incoming_dir` and `root_dir`
2. **Similarity Match**: Calculate Levenshtein distance for filename matching
3. **AI Classification**: For files below threshold, extract metadata and send to OpenAI in batches
4. **Move**: Move files to classified directories (creates directories as needed)
5. **Track**: Log all operations via Pino logger

## Logging

- **Logger**: Pino with rotating-file-stream
- **Format**: Daily rotation (app-YYYY-MM-DD.log), 30-day retention
- **Output**: Console + file
- **Levels**: trace, debug, info, warn, error, fatal

```typescript
import { logger } from '@/lib/logger';

logger.info('Task started');
logger.warn({ file: 'test.txt' }, 'File processing slow');
logger.error({ error }, 'Classification failed');
```

## Important Notes

- Use `npm` as package manager
- Always run `npm run lint` and `npm run test` before committing
- Frontend components use 'use client' directive when needed
- API routes use Next.js App Router (app/api/\*)
- Use `@/*` path alias for internal imports
- All services are in `src/lib/services/`
- Type definitions in `src/types/index.ts`
- Test fixtures in `tests/` directory
- Cron expressions use 5-field Unix format (validated)
- AI API calls are batched to avoid rate limits
- Default similarity threshold is 0.8
