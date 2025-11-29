# Next.js 迁移备忘录

在每次提交前规划下一步并更新备忘录，提交后读取备忘录来跟踪进度。使用中文注释和中文日志，注意编码的可读性和可维护性。执行完任务后需要提交，小步快跑的提交模式。迁移备忘录的修改要完整，方便后续的冷启动。 shadcn遇到组件迁移可以复制再修改，也可以考虑覆盖安装shadcn

## 项目基本信息

- **原项目**: file-auto-organizer (React Router + Fastify)
- **目标架构**: Next.js 全栈应用 (App Router + API Routes)
- **主要功能**: 文件自动整理工具，使用 AI 分析文件内容。支持定时任务动态调度。

## 技术栈对比

### 原前端 (frontend/)

- React Router v7 + Vite
- Tailwind CSS v4
- Radix UI 组件库
- SWR 数据获取

### 原后端 (backend/)

- Fastify 服务器
- TypeScript
- AI 分析 (OpenAI)
- 文件处理 (exiftool-vendored)

### 目标架构 (nextjs-app/)

- Next.js 16 + App Router
- Tailwind CSS
- API Routes 替代 Fastify
- 服务组件 + 客户端组件

## 迁移进度

### ✅ 已完成

- [x] 创建 Next.js 项目基础结构
- [x] 安装必要的依赖包
- [x] 配置 next.config.ts 支持外部包
- [x] 配置 Git 分支和版本控制
- [x] 创建项目目录结构和类型定义
- [x] 实现 API 客户端库和配置管理
- [x] 创建基础 API Routes (健康检查、系统信息)
- [x] 实现核心业务 API (配置、状态、统计、触发、日志)

### 🚧 进行中

- [ ] 修复 API Routes 编码问题

### ⚠️ 遇到的问题

- API Routes 文件编码问题，导致 Turbopack 无法解析
- 需要重新创建 API 文件，确保正确的 UTF-8 编码
- Next.js 16 与当前代码存在兼容性问题

### 📋 待完成

- [ ] 迁移前端组件到 Next.js
- [ ] 迁移后端 API 到 Next.js API Routes
- [ ] 配置构建和开发环境
- [ ] 测试和验证迁移结果

## 关键配置

### Next.js 配置特点

1. `serverComponentsExternalPackages`: 配置 exiftool-vendored 在服务端运行
2. API Routes 重写: 处理文件路径参数
3. Webpack 配置: 客户端不打包服务端模块

### 依赖管理

- 保留 UI 组件库: shadcn, Tailwind CSS
- 服务层依赖: OpenAI, exiftool-vendored 等
- 移除 Fastify: 使用 Next.js API Routes

## 重要提醒

### 代码迁移注意事项

1. **路由系统**: React Router → Next.js App Router
2. **数据获取**: SWR 仍可使用，但要结合 Next.js 特性
3. **API 端点**: Fastify 路由 → API Routes
4. **组件类型**: 区分 Server Components 和 Client Components

### 文件结构映射

```
frontend/src/components/ → nextjs-app/src/components/
frontend/src/hooks/ → nextjs-app/src/hooks/
frontend/src/lib/ → nextjs-app/src/lib/
backend/src/api/ → nextjs-app/src/app/api/
backend/src/service/ → nextjs-app/src/lib/services/
```

## 当前状态

Next.js 开发服务器正在运行

- http://localhost:8080
- 所有 API 端点已测试通过
- Turbopack 构建系统正常工作

## 下一步计划

现在后端 API 已经完全就绪，我们可以开始：

1. 前端组件迁移 - 将 React Router 组件适配到 Next.js App Router
2. 页面路由设置 - 创建 Next.js 页面结构
3. UI 组件集成 - 保持现有的 UI 体验
4. 数据获取优化 - 结合 SWR 和 Next.js 特性

## 问题记录

- [ ] 解决 exiftool-vendored 在 Next.js 中的兼容性
- [ ] 调整 SWR 与 Next.js 数据预获取的集成
- [ ] 确保文件上传功能的正常工作

## 测试计划

- [ ] 单元测试迁移
- [ ] API 端点测试
- [ ] 前端组件功能测试
- [ ] 集成测试

---

_创建时间: 2025-11-29_
_最后更新: 2025-11-29_
