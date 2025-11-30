# Next.js 迁移备忘录

## 项目状态

**🚧 迁移进行中 - 类型检查已通过，需功能测试**

项目正在从 React Router + Fastify 架构迁移到 Next.js 全栈应用。代码已通过严格类型检查并可成功构建，但需要完整的功能测试来验证运行时功能。

## 已修复问题

- ✅ TypeScript 编译错误：排除 `legacy-backup` 目录
- ✅ Logger 调用错误：修复 `file-status.service.ts` 中的 logger 调用方式
- ✅ 依赖安装：确保所有依赖已正确安装
- ✅ 启用严格类型检查：修复所有未使用的导入、变量和参数
- ✅ 修复函数返回值问题：确保所有代码路径都有返回值

## 当前状态

### ✅ 已完成

- [x] Next.js 项目基础结构
- [x] API 路由迁移（所有 API 端点）
- [x] 前端页面迁移（所有页面组件）
- [x] 日志系统迁移
- [x] 代码可成功构建
- [x] 启用严格 TypeScript 类型检查
- [x] 修复所有类型错误（未使用的导入、变量、参数等）

### 🚧 待测试和修复

- [ ] 运行时功能测试
- [ ] API 端点功能验证
- [ ] 页面交互功能验证
- [ ] 文件整理核心功能测试
- [ ] 定时任务功能测试
- [ ] 错误处理和边界情况

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
npm install          # 安装依赖
npm run dev          # 开发环境（端口 8080）
npm run build        # 构建生产版本
npm start            # 生产环境启动
npm run lint         # 代码检查
```

## 关键配置

### TypeScript 配置

- `tsconfig.json`: 已排除 `legacy-backup` 目录

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

## 已知问题

1. **构建警告**: baseline-browser-mapping 数据过期（可忽略，不影响功能）
2. **端口占用**: 开发服务器可能遇到端口占用问题（检查并释放端口）
3. **功能测试**: 需要完整的功能测试来验证迁移是否成功
4. **运行时错误**: 可能存在运行时错误，需要通过实际运行和测试来发现

## 下一步计划

### 立即任务

1. **功能测试**
   - [ ] 启动开发服务器并访问页面
   - [ ] 测试所有 API 端点
   - [ ] 测试页面交互功能
   - [ ] 测试文件整理核心功能

2. **问题修复**
   - [ ] 修复发现的运行时错误
   - [ ] 修复 API 数据格式问题
   - [ ] 修复页面显示问题

3. **优化改进**
   - [ ] 优化移动端响应式设计
   - [ ] 完善错误处理和加载状态
   - [ ] 添加实时更新功能

## 注意事项

1. **配置文件**: 开发时需要 `config.yaml` 文件
2. **日志初始化**: 在 `layout.tsx` 中初始化日志系统
3. **任务上下文**: 使用 `setCurrentTaskId()` 设置任务上下文
4. **文件操作**: 所有文件操作都有重试机制和错误处理
5. **AI 调用**: 优先使用相似度匹配减少成本

## 测试清单

### API 测试

```bash
# 健康检查
curl http://localhost:8080/api/health

# 获取系统状态
curl http://localhost:8080/api/status

# 获取配置信息
curl http://localhost:8080/api/config

# 获取统计数据
curl http://localhost:8080/api/stats

# 手动触发任务
curl -X POST http://localhost:8080/api/trigger \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'
```

### 页面测试

- [ ] 访问首页 `/`
- [ ] 访问统计页面 `/stats`
- [ ] 访问日志页面 `/logs`
- [ ] 访问配置页面 `/config`
- [ ] 访问触发页面 `/trigger`
- [ ] 访问任务历史页面 `/task-history`

---

_最后更新: 2025-11-30 (修复构建错误)_
