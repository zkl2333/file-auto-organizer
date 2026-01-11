# File Auto Organizer v0.2.0 实施计划

## 执行摘要

**目标**: 修复所有测试、提升覆盖率至80%+、添加鉴权、重构复杂组件

**当前状态**:

- 测试通过率: 95% (96/101)
- 测试覆盖率: ~36%
- 代码质量问题: 4处(console.log: 3, @ts-ignore: 1)
- 未测试服务: 9个
- API鉴权: 0/11

**预计总工时**: 约48小时

---

## P0 任务（必须完成）

### TASK-001: 修复失败的测试

- **优先级**: P0
- **预估时间**: 2小时
- **前置任务**: 无
- **风险**: 低

**具体步骤**:

1. 修复 `file-move.service.test.ts:98` 正则表达式 `/file1\(\d+)\.txt$/` → `/file1\(\d+\)\.txt$/`
2. 修复 `file-scan.service.test.ts` 中4个跨平台路径测试（Windows `\` vs `/`）
3. 修复 `file-reader.service.test.ts` 流读取逻辑失败
4. 运行完整测试套件验证所有修复
5. 提交前运行 `npm run lint`

**验收标准**:

- [ ] 101个测试全部通过
- [ ] 无 lint 错误

---

### TASK-002: 修复代码质量问题

- **优先级**: P0
- **预估时间**: 1小时
- **前置任务**: 无
- **风险**: 低

**具体步骤**:

1. 替换 `src/lib/config.ts:104,113` 的 console.log 为 logger.debug
2. 替换 `src/components/TriggerView.tsx:44` 的 console.log 为 logger.debug 或 UI 反馈
3. 移除 `src/lib/task-manager/task-executor.ts:45` 的 @ts-ignore，修复类型错误
4. 修复 `src/lib/config.ts:87` 路径连接问题：`+ '/config.yaml'` → `path.join(CONFIG_DIR(), 'config.yaml')`
5. 运行 `npm run lint` 验证

**验收标准**:

- [ ] 0处 console.log
- [ ] 0处 @ts-ignore
- [ ] 0处 @ts-expect-error
- [ ] lint 通过

---

### TASK-003: 配置 Vitest 覆盖率阈值

- **优先级**: P0
- **预估时间**: 0.5小时
- **前置任务**: 无
- **风险**: 无

**具体步骤**:

1. 修改 `vitest.config.ts`，添加覆盖率配置：
   ```typescript
   coverage: {
     provider: 'v8',
     reporter: ['text', 'json', 'html'],
     exclude: [
       'node_modules/',
       'tests/',
       '**/*.d.ts',
       '**/*.config.*',
       '**/dist/**',
       '**/build/**',
     ],
     thresholds: {
       lines: 80,
       functions: 80,
       branches: 80,
       statements: 80,
     },
   }
   ```
2. 验证配置：`npm run test:coverage`

**验收标准**:

- [ ] 覆盖率阈值配置为 80%
- [ ] 配置文件语法正确

---

### TASK-004: 实现基础 JWT 鉴权（后端）

- **优先级**: P0
- **预估时间**: 3小时
- **前置任务**: 无
- **风险**: 中（环境变量管理）

**具体步骤**:

1. 安装依赖：`npm install jsonwebtoken bcryptjs`
2. 安装类型：`npm install -D @types/jsonwebtoken @types/bcryptjs`
3. 创建 `src/lib/auth.ts`：
   - `generateToken(payload, secret, options)`
   - `verifyToken(token, secret)`
   - `hashPassword(password)`
   - `comparePassword(password, hash)`
4. 创建环境变量支持：
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`（bcrypt hash）
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `JWT_EXPIRY` (默认 '24h')
5. 创建 `src/app/api/auth/login/route.ts`：
   - POST 处理登录
   - 验证凭证
   - 返回 access_token + refresh_token
6. 创建 `src/app/api/auth/refresh/route.ts`：
   - POST 处理刷新令牌
   - 验证 refresh_token
   - 返回新 access_token
7. 创建 `src/app/api/auth/logout/route.ts`：
   - POST 处理登出（客户端清除令牌）

**验收标准**:

- [ ] 登录返回有效 JWT
- [ ] 刷新令牌功能正常
- [ ] 密码使用 bcrypt 哈希
- [ ] 环境变量配置完整

---

### TASK-005: 实现 JWT 鉴权中间件

- **优先级**: P0
- **预估时间**: 2小时
- **前置任务**: TASK-004
- **风险**: 中（路由保护逻辑）

**具体步骤**:

1. 创建 `src/middleware.ts`：
   - 从 Authorization header 提取 Bearer token
   - 验证 token
   - 拒绝未授权请求（401）
   - 排除白名单路由：/api/auth/login, /api/auth/refresh
2. 配置受保护路由：/api/\*（排除 auth 路由）
3. 测试中间件：
   - 有效 token 通过
   - 无效 token 拒绝
   - 缺失 token 拒绝

**验收标准**:

- [ ] 中间件保护所有 API 路由（除 auth）
- [ ] 有效 token 通过验证
- [ ] 无效/缺失 token 返回 401

---

### TASK-006: 前端登录 UI 和认证状态管理

- **优先级**: P0
- **预估时间**: 2小时
- **前置任务**: TASK-004
- **风险**: 低

**具体步骤**:

1. 创建 `src/components/LoginView.tsx`：
   - 用户名/密码表单
   - "记住我" 复选框
   - 错误提示
2. 创建 `src/lib/auth-client.ts`：
   - `login(username, password, rememberMe)`
   - `logout()`
   - `refreshToken()`
   - `getAccessToken()`
3. 实现 localStorage 令牌存储：
   - access_token（内存或 session）
   - refresh_token（记住我时持久化）
4. 创建 `src/app/page.tsx` 重定向逻辑：
   - 未认证 → 登录页
   - 已认证 → 主应用

**验收标准**:

- [ ] 登录表单功能正常
- [ ] 令牌正确存储
- [ ] 未认证用户重定向到登录页

---

### TASK-007: 前端令牌自动刷新

- **优先级**: P0
- **预估时间**: 1.5小时
- **前置任务**: TASK-006
- **风险**: 低

**具体步骤**:

1. 创建 `src/lib/api-client.ts` 拦截器：
   - 拦截所有 API 请求
   - 添加 Authorization header
   - 401 响应时自动刷新 token
   - 刷新失败时重定向到登录
2. 实现令牌刷新队列（避免并发刷新）
3. 测试场景：
   - 过期 token 自动刷新
   - 刷新失败后登出
   - 并发请求正确处理

**验收标准**:

- [ ] 过期 token 自动刷新
- [ ] 刷新失败后正确登出
- [ ] 并发请求无冲突

---

### TASK-008: 为 AIClassificationService 添加测试

- **优先级**: P0
- **预估时间**: 2小时
- **前置任务**: TASK-001, TASK-003
- **风险**: 中（需要 mock OpenAI API）

**具体步骤**:

1. 创建 `tests/services/ai-classification.service.test.ts`
2. Mock OpenAI API 调用（使用 vi.mock）
3. 测试场景：
   - 批量分类功能
   - API 错误处理
   - 重试逻辑
   - 空输入处理
4. 运行测试：`npx vitest run tests/services/ai-classification.service.test.ts`
5. 验证覆盖率提升

**验收标准**:

- [ ] 至少 10 个测试用例
- [ ] Mock 正确工作
- [ ] 覆盖率 ≥ 80%

---

### TASK-009: 为 TaskManager 添加测试

- **优先级**: P0
- **预估时间**: 2.5小时
- **前置任务**: TASK-001, TASK-003
- **风险**: 低

**具体步骤**:

1. 创建 `tests/task-manager/task-manager.test.ts`
2. 测试场景：
   - 任务创建和状态管理
   - 并发任务处理
   - 任务取消
   - 错误处理
   - 任务历史记录
3. 创建测试 fixtures（模拟任务数据）
4. 运行测试验证

**验收标准**:

- [ ] 至少 15 个测试用例
- [ ] 覆盖率 ≥ 80%
- [ ] 所有状态转换测试通过

---

### TASK-010: 为 StatsService 添加测试

- **优先级**: P0
- **预估时间**: 1.5小时
- **前置任务**: TASK-001, TASK-003
- **风险**: 低

**具体步骤**:

1. 创建 `tests/services/stats.service.test.ts`
2. 测试场景：
   - 统计数据计算
   - 时间范围过滤
   - 空数据处理
   - 聚合函数
3. Mock 文件系统和时间
4. 运行测试验证

**验收标准**:

- [ ] 至少 8 个测试用例
- [ ] 覆盖率 ≥ 80%

---

### TASK-011: 为 FileInfoService 添加测试

- **优先级**: P0
- **预估时间**: 1.5小时
- **前置任务**: TASK-001, TASK-003
- **风险**: 低

**具体步骤**:

1. 创建 `tests/services/file-info.service.test.ts`
2. 测试场景：
   - 文件信息提取
   - 元数据解析
   - 批量处理
   - 错误处理
3. Mock 文件系统
4. 运行测试验证

**验收标准**:

- [ ] 至少 8 个测试用例
- [ ] 覆盖率 ≥ 80%

---

### TASK-012: 为 LogService 添加测试

- **优先级**: P0
- **预估时间**: 1.5小时
- **前置任务**: TASK-001, TASK-003
- **风险**: 低

**具体步骤**:

1. 创建 `tests/services/log.service.test.ts`
2. 测试场景：
   - 日志读取
   - 日志过滤
   - 日志分页
   - 空日志处理
3. Mock 日志文件
4. 运行测试验证

**验收标准**:

- [ ] 至少 8 个测试用例
- [ ] 覆盖率 ≥ 80%

---

### TASK-013: 为 FileStatusService 添加测试

- **优先级**: P0
- **预估时间**: 1.5小时
- **前置任务**: TASK-001, TASK-003
- **风险**: 低

**具体步骤**:

1. 创建 `tests/services/file-status.service.test.ts`
2. 测试场景：
   - 状态跟踪
   - 状态更新
   - 批量状态查询
3. Mock 数据存储
4. 运行测试验证

**验收标准**:

- [ ] 至少 6 个测试用例
- [ ] 覆盖率 ≥ 80%

---

### TASK-014: 为 FileMoveProcessorService 添加测试

- **优先级**: P0
- **预估时间**: 2小时
- **前置任务**: TASK-001, TASK-003
- **风险**: 中（文件操作）

**具体步骤**:

1. 创建 `tests/services/file-move-processor.service.test.ts`
2. 测试场景：
   - 批量文件移动
   - 错误恢复
   - 重试逻辑
   - 进度跟踪
3. 使用临时目录测试
4. 运行测试验证

**验收标准**:

- [ ] 至少 10 个测试用例
- [ ] 覆盖率 ≥ 80%

---

### TASK-015: 验证整体测试覆盖率

- **优先级**: P0
- **预估时间**: 0.5小时
- **前置任务**: TASK-008~014
- **风险**: 无

**具体步骤**:

1. 运行完整覆盖率测试：`npm run test:coverage`
2. 检查覆盖率报告
3. 识别未达标模块
4. 如需调整，补充测试

**验收标准**:

- [ ] 整体覆盖率 ≥ 80%
- [ ] 所有服务覆盖率 ≥ 80%

---

## P1 任务（重要但非阻塞）

### TASK-101: 为 AIProcessorService 添加测试

- **优先级**: P1
- **预估时间**: 1.5小时
- **前置任务**: TASK-001
- **风险**: 低

**具体步骤**:

1. 创建 `tests/services/ai-processor.service.test.ts`
2. Mock AI 服务调用
3. 测试处理逻辑和错误处理
4. 运行测试验证

**验收标准**:

- [ ] 至少 6 个测试用例
- [ ] 覆盖率 ≥ 80%

---

### TASK-102: 重构 TaskDetailView 组件

- **优先级**: P1
- **预估时间**: 4小时
- **前置任务**: 无
- **风险**: 中（复杂度拆分）

**具体步骤**:

1. 分析 `TaskDetailView.tsx`（922 行）的职责：
   - 任务状态展示
   - 文件列表
   - 进度跟踪
   - 错误处理
2. 拆分为子组件：
   - `TaskStatusBadge` - 状态徽章
   - `TaskProgress` - 进度条
   - `TaskFileList` - 文件列表
   - `TaskErrorPanel` - 错误面板
   - `TaskActions` - 操作按钮
3. 提取自定义 hooks：
   - `useTaskDetail` - 任务数据获取
   - `useTaskActions` - 任务操作
4. 运行 `npm run lint` 验证

**验收标准**:

- [ ] 主组件 ≤ 300 行
- [ ] 子组件职责单一
- [ ] 所有测试通过
- [ ] 无 lint 错误

---

### TASK-103: 优化 StatsView 组件

- **优先级**: P1
- **预估时间**: 3小时
- **前置任务**: TASK-010
- **风险**: 低

**具体步骤**:

1. 分析 `StatsView.tsx`（663 行）的职责
2. 拆分子组件：
   - `StatsCard` - 统计卡片
   - `StatsChart` - 图表组件
   - `StatsFilters` - 过滤器
3. 提取自定义 hooks：
   - `useStatsData` - 数据获取
   - `useStatsFilters` - 过滤状态
4. 运行 `npm run lint` 验证

**验收标准**:

- [ ] 主组件 ≤ 300 行
- [ ] 子组件职责单一
- [ ] 所有测试通过

---

### TASK-104: 添加 API 速率限制

- **优先级**: P1
- **预估时间**: 2小时
- **前置任务**: TASK-005
- **风险**: 低

**具体步骤**:

1. 安装依赖：`npm install express-rate-limit` 或使用内存实现
2. 创建 `src/lib/rate-limit.ts`
3. 在 `middleware.ts` 中集成速率限制
4. 配置限制规则：
   - 100 请求/分钟/IP
   - 1000 请求/小时/IP
5. 添加响应头：X-RateLimit-\*, Retry-After

**验收标准**:

- [ ] 超限请求返回 429
- [ ] 正确设置响应头
- [ ] 管理员不受限（可选）

---

### TASK-105: 添加审计日志

- **优先级**: P1
- **预估时间**: 3小时
- **前置任务**: TASK-005
- **风险**: 低

**具体步骤**:

1. 扩展 `src/lib/logger.ts` 添加审计日志级别
2. 创建 `src/lib/audit.ts`：
   - `logAction(user, action, details)`
   - `logAccess(user, endpoint, method)`
   - `logError(user, error)`
3. 在关键位置添加审计日志：
   - 用户登录/登出
   - 文件操作
   - 配置更改
   - API 访问
4. 创建审计日志 API: `/api/audit-logs`
5. 添加审计日志查看 UI（仅管理员）

**验收标准**:

- [ ] 所有关键操作记录
- [ ] 审计日志可查询
- [ ] 日志格式规范

---

### TASK-106: 添加会话管理

- **优先级**: P1
- **预估时间**: 2.5小时
- **前置任务**: TASK-005
- **风险**: 低

**具体步骤**:

1. 创建 `src/lib/session.ts`：
   - 会话存储（内存或 Redis）
   - 会话 CRUD 操作
   - 会话过期清理
2. 创建 `/api/sessions` (GET, DELETE)
3. 在登录时创建会话记录
4. 在登出时删除会话
5. 添加会话列表 UI（仅管理员）
6. 支持强制登出指定会话

**验收标准**:

- [ ] 会话正确创建和销毁
- [ ] 过期会话自动清理
- [ ] 管理员可查看/终止会话

---

## P2 任务（优化和增强）

### TASK-201: 添加 Docker 支持

- **优先级**: P2
- **预估时间**: 2小时
- **前置任务**: 无
- **风险**: 低

**具体步骤**:

1. 创建 `Dockerfile`（多阶段构建）
2. 创建 `docker-compose.yml`
3. 创建 `.dockerignore`
4. 创建 Docker 环境变量模板
5. 编写 Docker 使用文档
6. 测试构建和运行

**验收标准**:

- [ ] Docker 镜像成功构建
- [ ] docker-compose 启动正常
- [ ] 数据持久化配置正确

---

### TASK-202: 添加 CI/CD 配置

- **优先级**: P2
- **预估时间**: 2小时
- **前置任务**: TASK-003, TASK-015
- **风险**: 低

**具体步骤**:

1. 创建 `.github/workflows/ci.yml`：
   - Node.js 测试（lint, test, coverage）
   - 覆盖率阈值检查（80%）
   - 构建验证
2. 创建 `.github/workflows/release.yml`（可选）：
   - 自动发布
   - Docker 镜像构建
3. 添加 badge 到 README
4. 测试工作流

**验收标准**:

- [ ] CI 工作流通过
- [ ] 覆盖率低于 80% 失败
- [ ] 构建成功

---

### TASK-203: 添加性能监控

- **优先级**: P2
- **预估时间**: 2小时
- **前置任务**: 无
- **风险**: 低

**具体步骤**:

1. 添加性能日志（请求时间，文件处理时间）
2. 创建 `/api/performance-metrics` 端点
3. 添加性能指标 UI：
   - API 响应时间
   - 文件处理速度
   - 错误率
4. 实现性能告警（可选）

**验收标准**:

- [ ] 性能指标正确记录
- [ ] 可视化展示
- [ ] 历史趋势可查询

---

### TASK-204: 添加健康检查端点

- **优先级**: P2
- **预估时间**: 0.5小时
- **前置任务**: 无
- **风险**: 无

**具体步骤**:

1. 创建 `/api/health` 端点
2. 检查项：
   - 数据库连接（如使用）
   - 文件系统访问
   - OpenAI API（可选）
   - 配置加载
3. 返回状态码和详情

**验收标准**:

- [ ] 健康状态正确返回
- [ ] 依赖项检查完整

---

### TASK-205: 添加单元测试文档

- **优先级**: P2
- **预估时间**: 1.5小时
- **前置任务**: TASK-015
- **风险**: 无

**具体步骤**:

1. 创建 `tests/README.md`
2. 编写测试指南：
   - 测试结构
   - Mock 策略
   - 最佳实践
   - 运行命令
3. 为每个测试文件添加 JSDoc 注释

**验收标准**:

- [ ] 文档完整清晰
- [ ] 示例代码可运行

---

### TASK-206: 添加用户设置持久化

- **优先级**: P2
- **预估时间**: 2小时
- **前置任务**: TASK-006
- **风险**: 低

**具体步骤**:

1. 创建用户设置 schema
2. 添加设置 API: `/api/settings`
3. 前端设置页面：
   - 主题切换
   - 通知偏好
   - 默认视图
4. 使用 localStorage 持久化

**验收标准**:

- [ ] 设置正确保存
- [ ] 设置页面可访问
- [ ] 默认值合理

---

### TASK-207: 添加错误报告功能

- **优先级**: P2
- **预估时间**: 2小时
- **前置任务**: TASK-105
- **风险**: 低

**具体步骤**:

1. 创建错误上报机制
2. 在客户端捕获未处理错误
3. 创建错误详情页面
4. 添加错误导出功能（CSV/JSON）
5. 实现错误分类和筛选

**验收标准**:

- [ ] 错误正确捕获
- [ ] 错误详情可查看
- [ ] 支持导出

---

### TASK-208: 添加文件操作预览

- **优先级**: P2
- **预估时间**: 3小时
- **前置任务**: TASK-102
- **风险**: 中（UI 复杂度）

**具体步骤**:

1. 创建预览 API: `/api/files/preview`
2. 添加文件预览 UI：
   - 文本文件：直接展示
   - 图片：缩略图
   - 其他：元数据
3. 在任务详情中集成预览
4. 添加批量预览功能

**验收标准**:

- [ ] 预览功能正常
- [ ] 支持常见文件类型
- [ ] 性能可接受

---

## 执行时间线

### 第 1 周（P0 任务）

| 天    | 任务                                           |
| ----- | ---------------------------------------------- |
| Day 1 | TASK-001, TASK-002, TASK-003                   |
| Day 2 | TASK-004（JWT 后端）                           |
| Day 3 | TASK-005（中间件）+ TASK-006（登录 UI）        |
| Day 4 | TASK-007（令牌刷新）+ TASK-008（AI 分类测试）  |
| Day 5 | TASK-009（任务管理测试）+ TASK-010（统计测试） |

### 第 2 周（P0 任务）

| 天       | 任务                                           |
| -------- | ---------------------------------------------- |
| Day 6    | TASK-011（文件信息测试）+ TASK-012（日志测试） |
| Day 7    | TASK-013（状态测试）+ TASK-014（移动处理测试） |
| Day 8    | TASK-015（覆盖率验证）+ 缓冲时间               |
| Day 9-10 | P0 问题修复 + 文档更新                         |

### 第 3 周（P1 任务）

| 天        | 任务                                             |
| --------- | ------------------------------------------------ |
| Day 11-12 | TASK-102（TaskDetailView 重构）                  |
| Day 13-14 | TASK-103（StatsView 优化）+ TASK-104（速率限制） |
| Day 15    | TASK-105（审计日志）+ TASK-106（会话管理）       |

### 第 4 周（P2 任务）

| 天        | 任务                                       |
| --------- | ------------------------------------------ |
| Day 16-17 | TASK-201（Docker）+ TASK-202（CI/CD）      |
| Day 18    | TASK-203（性能监控）+ TASK-204（健康检查） |
| Day 19-20 | TASK-205~208（文档、设置、错误报告、预览） |

---

## 里程碑

### Milestone 1: 基础稳固（Day 5）

- [ ] 所有测试通过
- [ ] 代码质量问题修复
- [ ] 覆盖率阈值配置完成
- [ ] JWT 基础功能实现

### Milestone 2: 鉴权完成（Day 8）

- [ ] 完整鉴权系统上线
- [ ] 所有核心服务测试完成
- [ ] 覆盖率达到 80%+

### Milestone 3: 代码质量提升（Day 15）

- [ ] 复杂组件重构完成
- [ ] 安全功能增强（速率限制、审计日志）
- [ ] 会话管理完善

### Milestone 4: 生产就绪（Day 20）

- [ ] Docker 支持
- [ ] CI/CD 配置
- [ ] 监控和日志完善
- [ ] 文档完整

---

## 风险管理

| 风险             | 影响 | 概率 | 缓解措施                         |
| ---------------- | ---- | ---- | -------------------------------- |
| 测试覆盖未达 80% | 高   | 中   | 优先测试核心服务，必要时降低阈值 |
| OpenAI API 变化  | 中   | 低   | 封装 API 调用，隔离变化          |
| 跨平台兼容性问题 | 中   | 低   | 使用 path.join，统一测试         |
| 环境变量泄露     | 高   | 低   | 文档明确要求，运行时验证         |
| 并发任务冲突     | 中   | 中   | 实现任务队列，添加锁机制         |

---

## 验收标准总览

### P0 验收标准

- [ ] 101 个测试全部通过
- [ ] 测试覆盖率 ≥ 80%
- [ ] 0 处 console.log
- [ ] 0 处 @ts-ignore
- [ ] JWT 鉴权完整实现
- [ ] 11 个 API 路由受保护
- [ ] 令牌自动刷新正常
- [ ] 无 lint 错误

### P1 验收标准

- [ ] TaskDetailView ≤ 300 行
- [ ] StatsView ≤ 300 行
- [ ] 速率限制功能正常
- [ ] 审计日志完整记录
- [ ] 会话管理功能完善

### P2 验收标准

- [ ] Docker 镜像可用
- [ ] CI/CD 工作流通过
- [ ] 性能监控正常
- [ ] 健康检查端点可用
- [ ] 文档完整

---

## 注意事项

1. **提交规范**: 每完成一个任务创建一次 commit
2. **测试优先**: 修改代码前先运行相关测试
3. **文档同步**: 代码修改同步更新相关文档
4. **环境隔离**: 使用环境变量管理敏感配置
5. **跨平台**: 始终使用 `path.join` 处理路径
6. **日志规范**: 使用 logger 替代 console
7. **类型安全**: 避免 @ts-ignore，修复类型错误
8. **代码审查**: P1+ 任务完成后进行代码审查
