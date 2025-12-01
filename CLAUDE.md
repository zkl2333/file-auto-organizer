# CLAUDE.md

AI 编码助手指南。详细开发文档见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

## 项目概述

基于 Next.js 16 的 AI 文件自动整理工具。

**技术栈**: Next.js + TypeScript + shadcn/ui + pino + OpenAI API

## 开发命令

```bash
npm run dev     # 开发环境 (端口 8080)
npm run build   # 构建
npm run lint    # 代码检查
```

## 目录结构

```
src/
├── app/api/          # API 路由
├── components/       # React 组件
├── lib/             # 工具库和服务
└── hooks/           # 自定义 Hooks

data/                 # 持久化数据 (stats.json, tasks/)
logs/                 # 日志文件 (按天轮转)
```

## 关键文件

| 文件                      | 说明         |
| ------------------------- | ------------ |
| `src/lib/config.ts`       | 配置管理     |
| `src/lib/logger.ts`       | 日志系统     |
| `src/lib/services/`       | 业务服务     |
| `src/lib/file-organizer/` | 文件整理核心 |

## 开发注意

1. 配置文件: `config.yaml`
2. 日志级别: 环境变量 `LOG_LEVEL`
3. 数据目录: `./data` (统计和任务数据)
4. 日志目录: `./logs`

## API 端点

- `GET /api/health` - 健康检查
- `GET /api/status` - 系统状态
- `GET /api/config` - 获取配置
- `POST /api/trigger` - 触发任务
- `GET /api/stats` - 统计数据
- `GET /api/logs` - 日志查询
