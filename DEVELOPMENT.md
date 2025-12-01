# 开发文档

## 技术栈

- **框架**: Next.js 16 + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **状态**: SWR
- **日志**: pino + rotating-file-stream
- **文件处理**: exiftool-vendored
- **AI**: OpenAI API
- **定时任务**: node-cron

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── config/        # 配置管理
│   │   ├── task/          # 任务执行
│   │   ├── trigger/       # 手动触发
│   │   ├── logs/          # 日志查询
│   │   ├── stats/         # 统计数据
│   │   └── system/        # 系统状态
│   ├── logs/              # 日志页面
│   ├── stats/             # 统计页面
│   ├── config/            # 配置页面
│   └── task-history/      # 任务历史
├── components/            # React 组件
│   └── ui/               # shadcn/ui 组件
├── lib/                  # 工具库
│   ├── logger.ts         # 日志系统
│   ├── config.ts         # 配置管理
│   ├── services/         # 业务服务
│   └── file-organizer/   # 文件整理核心
├── hooks/               # 自定义 Hooks
└── types/               # TypeScript 类型

data/                     # 持久化数据
├── stats.json           # 统计记录
└── tasks/{taskId}/
    └── files.json       # 任务文件详情

logs/                     # 日志文件
└── app-*.log            # 按天轮转
```

## 开发命令

```bash
npm install     # 安装依赖
npm run dev     # 开发环境 (端口 8080)
npm run build   # 构建
npm start       # 生产环境
npm run lint    # 代码检查
```

## API 测试

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/status
curl http://localhost:8080/api/config
curl http://localhost:8080/api/stats

curl -X POST http://localhost:8080/api/trigger \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

## 核心流程

1. **扫描**: 读取待分类目录和已有分类
2. **相似度匹配**: 通过文件名 Levenshtein 距离快速匹配
3. **AI 分类**: 未匹配文件调用 OpenAI 分析
4. **移动文件**: 移动到目标目录
5. **记录统计**: 更新统计数据

## 配置说明

`config.yaml` 主要配置项：

| 配置项                      | 说明             |
| --------------------------- | ---------------- |
| `openai.api_key`            | OpenAI API Key   |
| `openai.model`              | AI 模型          |
| `openai.base_url`           | API 端点         |
| `directories.root_dir`      | 分类库目录       |
| `directories.incoming_dir`  | 待分类目录       |
| `cron.enabled`              | 启用定时任务     |
| `cron.schedule`             | Cron 表达式      |
| `scan.similarity_threshold` | 相似度阈值 (0-1) |
| `ai.batch_size`             | AI 批处理数量    |

## 注意事项

1. **配置文件**: 需要 `config.yaml`
2. **日志级别**: 通过 `LOG_LEVEL` 环境变量控制
3. **文件操作**: 内置重试机制
4. **AI 调用**: 优先使用相似度匹配减少成本
