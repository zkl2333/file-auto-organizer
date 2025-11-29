# Next.js 迁移备忘录

## 项目状态

**✅ 迁移已完成**

项目已成功从 React Router + Fastify 架构迁移到 Next.js 全栈应用。所有核心功能已迁移并测试通过。

## 迁移成果

- ✅ 所有 API 路由已迁移到 Next.js API Routes
- ✅ 所有前端页面已迁移到 Next.js App Router
- ✅ 日志系统已完整迁移（全局日志 + 任务日志）
- ✅ 核心业务功能正常（文件整理、AI分类、定时任务等）

## 技术栈

- **框架**: Next.js 16 + App Router
- **UI**: shadcn/ui + Tailwind CSS
- **状态管理**: SWR
- **日志**: pino + rotating-file-stream
- **AI**: OpenAI API
- **定时任务**: node-cron

## 目录结构

```
src/
├── app/              # Next.js App Router
│   ├── api/         # API 路由
│   ├── stats/       # 统计页面
│   ├── logs/        # 日志页面
│   ├── config/      # 配置页面
│   ├── trigger/     # 手动触发页面
│   └── task-history/ # 任务历史页面
├── components/       # React 组件
├── lib/             # 工具库和服务
└── hooks/           # 自定义 Hooks
```

## 开发命令

```bash
npm run dev          # 开发环境（端口 8080）
npm run build        # 构建生产版本
npm start            # 生产环境启动
npm run lint         # 代码检查
```

## 关键配置

### Next.js 配置

- `serverComponentsExternalPackages`: 配置 exiftool-vendored 在服务端运行
- API Routes 支持文件路径参数处理

### 日志系统

- **全局日志**: `logs/global/` - 按模块分类，按天轮转，保留30天
- **任务日志**: `logs/tasks/{taskId}/` - 每个任务独立日志目录
- **日志模块**: system、main、file-scan、file-info、file-move、ai

### 配置文件

- 主配置: `config.yaml`（需从 `config.yaml.example` 复制）
- 包含: OpenAI API 配置、目录路径、定时任务配置、日志级别

## 待优化事项

- [ ] 优化移动端响应式设计
- [ ] 完善错误处理和加载状态显示
- [ ] 添加实时更新功能
- [ ] 性能优化和代码审查
- [ ] 添加单元测试和集成测试

## 注意事项

1. **配置文件**: 开发时需要 `config.yaml` 文件
2. **日志初始化**: 在 `layout.tsx` 中初始化日志系统
3. **任务上下文**: 使用 `setCurrentTaskId()` 设置任务上下文
4. **文件操作**: 所有文件操作都有重试机制和错误处理
5. **AI 调用**: 优先使用相似度匹配减少成本

---

_最后更新: 2025-11-30_
