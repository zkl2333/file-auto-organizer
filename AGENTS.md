# AGENTS.md

本文件为 Qoder (qoder.com) 在本仓库中工作时提供指导。

## 项目概述

File Auto Organizer 是一个 Next.js 16 全栈应用，使用 AI 自动整理文件。它将前端 UI 和后端服务整合在一个单体仓库中。文件通过文件名相似度匹配（Levenshtein 距离）或 OpenAI API 进行基于内容的分类。

## 架构

### 项目结构

- **src/**: 源代码（前端 + 后端合并）
  - `app/`: Next.js App Router（页面、布局、API 路由）
  - `components/`: React 组件（UI 组件在 `ui/` 子目录中）
  - `lib/`: 共享服务和工具
    - `services/`: 后端服务（file-scan, file-info, ai-classification, file-move, stats, log）
    - `task-manager/`: 任务编排（task, task-executor, task-manager）
    - `utils/`: 辅助工具（similarity, file, task utilities）
    - `config.ts`: 配置加载器（基于 YAML，支持环境变量覆盖）
    - `paths.ts`: 跨平台路径管理（配置目录、数据目录）
    - `logger.ts`: 基于 Pino 的日志，每日轮转
    - `api-client.ts`: 使用 SWR 的前端 API 客户端
  - `types/`: TypeScript 类型定义
- **tests/**: Vitest 测试文件
- **logs/**: 应用日志（app-YYYY-MM-DD.log，每日轮转）

### 技术栈

- **前端**: React 19, TypeScript, Tailwind CSS 4, shadcn/ui 组件, Radix UI
- **后端**: Next.js API routes, node-cron, pino, rotating-file-stream
- **测试**: Vitest with v8 coverage provider
- **AI**: OpenAI API（支持兼容端点）

## 开发命令

```bash
# 开发
npm run dev              # 在 8080 端口启动 Next.js 开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器（端口 8080）

# 代码质量
npm run lint             # 运行 ESLint
npm run prepare          # 安装 husky git hooks

# 测试
npm run test             # 运行所有测试一次
npm run test:watch       # 在监听模式下运行测试
npm run test:coverage    # 运行测试并生成覆盖率报告

# 运行单个测试文件
npx vitest run <path-to-test>          # 运行指定测试文件
npx vitest run <path-to-test> --reporter=verbose  # 运行并显示详细输出
```

### 示例

```bash
# 运行特定服务测试
npx vitest run tests/services/file-scan.service.test.ts

# 按名称运行特定测试
npx vitest run -t "should scan directories"

# 在监听模式下运行特定文件的测试
npx vitest tests/services/file-scan.service.test.ts
```

## 代码风格指南

### 格式化

`.prettierrc` 中的配置：

- **分号**: 必需
- **引号**: 单引号
- **缩进**: 2 个空格
- **尾随逗号**: es5
- **打印宽度**: 100 字符
- **换行符**: LF
- **编辑器**: 使用 `.editorconfig` 保持一致设置

### TypeScript 规则

`tsconfig.json` 中的配置：

- **strict mode**: 启用
- **noImplicitAny**: 启用
- **noImplicitReturns**: 启用
- **noUnusedLocals**: 启用
- **noUnusedParameters**: 启用
- **target**: ES2017
- **module**: esnext
- **jsx**: react-jsx
- **Path aliases**: `@/*` → `./src/*`

### 导入风格

```typescript
// 1. Node.js 内置模块
import fs from 'node:fs';
import path from 'node:path';

// 2. 第三方库
import pino from 'pino';
import OpenAI from 'openai';

// 3. 内部模块（使用 @/* 别名）
import { logger } from '@/lib/logger';
import { getConfig } from '@/lib/config';
import { Card, CardContent } from '@/components/ui/card';
```

### 命名规范

```typescript
// 类: PascalCase
export class FileScanService {}
export class TaskManager {}
export class AIClassificationService {}

// 函数/方法: camelCase
export function scanFiles(rootDir: string): string[] {}
export function classifyFiles(files: FileInfo[]): Promise<ClassificationResult> {}
private calculateSimilarity(str1: string, str2: string): number {}

// 变量/常量: camelCase
const config = getConfig();
const maxDepth = 10;
const filesList = [];

// 真正不可变的常量: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 30000;
const SIMILARITY_THRESHOLD = 0.8;

// 接口: PascalCase
interface AppConfig {}
interface TaskStatus {}
interface ProcessedFile {}

// 类型: 联合类型/别名使用 PascalCase
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

// 枚举: PascalCase
enum TaskStage {
  SCAN = 'scan',
  ANALYZE = 'analyze',
  MOVE = 'move',
}

// 文件名: kebab-case
// file-scan.service.ts
// ai-classification.service.ts
// similarity-utils.ts

// 组件文件: PascalCase.tsx
// StatCard.tsx
// TriggerView.tsx
```

### 错误处理

```typescript
// Try-catch 配合类型化错误处理
async function processFile(filePath: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // 处理内容
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, filePath }, `Failed to process file: ${errorMessage}`);
    throw new Error(`File processing failed: ${errorMessage}`);
  }
}

// 验证错误
function validateConfig(config: Partial<AppConfig>): void {
  if (!config.openai?.api_key) {
    throw new Error('OpenAI API key is required');
  }
}

// API 路由错误响应
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

### 组件风格

```typescript
'use client'; // 客户端组件需要添加

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

### 服务模式

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
   * 扫描目录树，返回相对路径
   */
  scanDirs(rootDir: string): string[] {
    const result: string[] = [];

    function walk(dir: string, base: string = ''): void {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          // 处理条目
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

### 测试风格

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileScanService } from '@/lib/services/file-scan.service';

describe('FileScanService', () => {
  let service: FileScanService;

  beforeEach(() => {
    service = new FileScanService();
  });

  afterEach(() => {
    // 清理
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

## 配置

从 `config.yaml` 加载配置（如果缺失会自动创建）：

### 配置文件位置

默认配置文件位置使用跨平台路径（通过 `src/lib/paths.ts`）。

**基础配置目录（config_dir）根据操作系统和用户名变化：**

- **Linux**: `~/.config`（例如：`/home/Alice/.config`）
- **Windows**: `%APPDATA%`（例如：`C:\Users\Alice\AppData\Roaming`）
- **macOS**: `~/Library/Application Support`（例如：`/Users/Alice/Library/Application Support`）

**应用配置文件完整路径：**

- **Linux**: `~/.config/file-auto-organizer/config.yaml`
- **Windows**: `%APPDATA%\file-auto-organizer\config.yaml`
- **macOS**: `~/Library/Application Support/file-auto-organizer/config.yaml`

支持通过环境变量 `CONFIG_PATH` 覆盖配置文件路径。

#### Docker 环境

在 Docker 容器中，`HOME` 环境变量指定工作目录（例如 `/app`），`config_dir` 根据 `$HOME` 拼接为 `$HOME/.config`，配置和数据目录位于：

- **基础配置目录**: `$HOME/.config`（例如：`/app/.config`）
- **配置文件**: `$HOME/.config/config.yaml`
- **日志目录**: `$HOME/.config/logs/`

通过 docker-compose.yaml 挂载到宿主机 `./.config` 目录。注意：Docker 环境中去掉了应用名称层，路径更简洁。

### 日志目录

默认日志目录位置：

- **Windows**: `%LOCALAPPDATA%\file-auto-organizer\`
- **macOS**: `~/Library/Application Support/file-auto-organizer/`
- **Linux**: `~/.local/share/file-auto-organizer/`
- **Docker**: `/app/.config/file-auto-organizer/`（与配置目录合并）

日志文件格式：`app-YYYY-MM-DD.log`

### 配置项

- **openai**: API key, model, base_url
- **directories**: root_dir（已分类文件）, incoming_dir（待分类文件）
- **cron**: enabled, schedule（5 字段 Unix 格式）
- **logging**: level, dir
- **scan**: max_depth, similarity_threshold
- **ai**: batch_size
- **file_operations**: max_retries, retry_delay_base

支持环境变量覆盖（例如：`OPENAI_API_KEY`, `ROOT_DIR`, `LOG_LEVEL`）。

## 核心工作流程

1. **扫描**: 从 `incoming_dir` 和 `root_dir` 读取文件
2. **相似度匹配**: 计算文件名相似度匹配的 Levenshtein 距离
3. **AI 分类**: 对于低于阈值的文件，提取元数据并批量发送到 OpenAI
4. **移动**: 将文件移动到分类目录（按需创建目录）
5. **跟踪**: 通过 Pino logger 记录所有操作

## 日志

- **Logger**: Pino with rotating-file-stream
- **格式**: 每日轮转（app-YYYY-MM-DD.log），保留 30 天
- **输出**: 控制台 + 文件
- **级别**: trace, debug, info, warn, error, fatal

```typescript
import { logger } from '@/lib/logger';

logger.info('Task started');
logger.warn({ file: 'test.txt' }, 'File processing slow');
logger.error({ error }, 'Classification failed');
```

## 重要说明

- 使用 `npm` 作为包管理器
- 提交前始终运行 `npm run lint` 和 `npm run test`
- 前端组件在需要时使用 'use client' 指令
- API 路由使用 Next.js App Router (app/api/\*)
- 使用 `@/*` 路径别名进行内部导入
- 所有服务位于 `src/lib/services/`
- 类型定义在 `src/types/index.ts`
- 测试 fixtures 在 `tests/` 目录
- Cron 表达式使用 5 字段 Unix 格式（已验证）
- AI API 调用批量处理以避免速率限制
- 默认相似度阈值为 0.8
