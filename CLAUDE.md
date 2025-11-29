# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目状态

**⚠️ 项目迁移中**

这是一个正在从 React Router + Fastify 架构迁移到 Next.js 全栈应用的项目。当前处于 `nextjs-migration` 分支。在每次提交前规划下一步并更新备忘录，提交后读取备忘录来跟踪进度。

### 迁移策略

采用 **"先复制再修改跑通"** 的迁移方式：

1. **复制**: 从原项目复制代码文件到 Next.js 对应目录
2. **修改**: 适配 Next.js 的 API Routes 和 App Router 结构
3. **跑通**: 确保功能完全正常后再继续下一个模块
4. **测试**: 使用 MCP (Model Context Protocol) 工具进行功能测试验证

### 测试工具

项目集成了多种 MCP 工具用于开发和测试：

- **devtools**: 浏览器自动化测试，支持页面交互和截图
- **playwright**: 端到端测试，模拟用户操作流程
- **sequential-thinking**: 复杂问题分析和解决
- **shadcn**: UI 组件测试和验证

**迁移备忘录**: 详细的迁移进度和计划请查看 [MIGRATION_MEMO.md](./MIGRATION_MEMO.md)

## 开发命令

```bash
# 开发环境（使用自定义服务器）
npm run dev

# 开发环境（使用默认 Next.js 服务器）
npm run dev:default

# 构建生产版本
npm run build

# 生产环境启动
npm start

# 生产环境启动（默认 Next.js）
npm run start:default

# 代码检查
npm run lint
```

## 项目架构

这是一个基于 Next.js 16 的 AI 文件自动整理工具，从原有的后端服务迁移为全栈 Next.js 应用。

### 核心特性

- **AI 智能分类**: 使用 OpenAI API 分析文件内容并自动分类
- **相似度匹配**: 通过文件名相似度快速匹配，减少 AI 调用成本
- **定时任务**: 支持自动定时整理文件
- **实时统计**: 文件处理历史、AI 使用情况等数据可视化

### 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由（按功能模块组织）
│   │   ├── config/        # 配置管理 API
│   │   ├── task/          # 任务执行 API
│   │   ├── trigger/       # 手动触发 API
│   │   ├── logs/          # 日志查询 API
│   │   ├── stats/         # 统计数据 API
│   │   └── system/        # 系统状态 API
│   ├── logs/              # 日志查看页面
│   ├── stats/             # 统计信息页面
│   ├── config/            # 配置管理页面
│   └── task-history/      # 任务历史页面
├── components/            # React 组件
│   └── ui/               # shadcn/ui 基础组件
├── lib/                  # 工具库和核心逻辑
│   ├── logger.ts         # 日志系统（基于 pino）
│   ├── log-config.ts     # 日志配置
│   ├── file-organizer/   # 文件整理核心逻辑
│   └── config.ts         # 配置文件管理
├── hooks/               # 自定义 React Hooks
└── types/               # TypeScript 类型定义
```

### 技术栈

- **前端**: Next.js 16 + TypeScript + Tailwind CSS
- **UI 组件**: shadcn/ui + Radix UI
- **状态管理**: SWR (数据获取) + React Context
- **日志系统**: pino + rotating-file-stream
- **文件处理**: exiftool-vendored
- **AI 集成**: OpenAI API
- **定时任务**: node-cron

### 配置管理

项目使用 `config.yaml` 作为主配置文件，包含：

- OpenAI API 配置（支持自定义端点）
- 目录路径设置
- 定时任务配置
- 日志级别设置
- 文件扫描参数

### 日志系统

采用多层级日志结构：

- **全局日志**: 按模块分类，按天轮转，保留30天
- **任务日志**: 每个任务独立日志文件，便于追踪特定执行过程
- **日志模块**: system、main、file-scan、file-info、file-move、ai

### API 设计

所有 API 遵循 RESTful 设计，按功能模块组织在 `src/app/api/` 下：

- 错误处理统一，返回标准错误格式
- 支持任务上下文追踪（通过 taskId）
- 集成日志记录和错误追踪

### 开发注意事项

1. **配置文件**: 开发时需要复制 `config.yaml.example` 为 `config.yaml` 并填入相应配置
2. **日志初始化**: 在 `layout.tsx` 中初始化日志系统，确保服务端日志正常工作
3. **任务上下文**: 使用 `setCurrentTaskId()` 设置任务上下文，确保日志正确关联到特定任务
4. **文件操作**: 所有文件操作都应考虑重试机制和错误处理
5. **AI 调用**: 注意控制 API 调用频率，优先使用相似度匹配减少成本

### 迁移开发流程

1. **模块迁移顺序**: 按照 MIGRATION_MEMO.md 中的计划逐个迁移页面和 API
2. **测试验证**: 每完成一个模块，使用以下工具进行功能测试：
   - **API 测试**: 使用 `curl` 或 `fetch` 测试 API 端点响应
   - **页面测试**: 使用 `mcp__devtools` 进行页面交互测试
   - **端到端测试**: 使用 `mcp__playwright` 进行完整用户流程测试
3. **代码质量**: 确保迁移后的代码符合 Next.js 最佳实践

### API 测试示例

```bash
# 健康检查
curl http://localhost:8080/api/health

# 获取系统状态
curl http://localhost:8080/api/status

# 获取配置信息
curl http://localhost:8080/api/config

# 获取统计数据
curl http://localhost:8080/api/stats

# 获取使用统计
curl http://localhost:8080/api/usage-stats

# 获取日志列表
curl http://localhost:8080/api/logs

# 手动触发任务
curl -X POST http://localhost:8080/api/trigger \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'
```

### 部署相关

- **开发环境**: 默认运行在 8080 端口
- **生产环境**: 默认运行在 3000 端口
- **Docker 部署**: 使用自定义服务器配置，支持目录映射和配置文件挂载
- **日志目录**: `./logs` （在 Docker 中需要映射到宿主机）
