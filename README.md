# File Auto Organizer - Next.js 版

基于 AI 的智能文件整理工具，自动分析文件内容并分类归档。Next.js 全栈应用，提供友好的 Web 界面。

## ✨ 特性

- 🤖 **AI 智能分类**: 使用 OpenAI API 分析文件内容，自动决定文件归属
- ⚡ **相似度匹配**: 优先通过文件名相似度快速匹配，减少 AI 调用
- 🌐 **Web 界面**: 基于 Next.js 的现代化管理界面
- 📊 **实时统计**: 查看文件处理历史、AI 使用情况等数据
- ⏰ **定时任务**: 支持自动定时整理
- 📝 **详细日志**: 完整的操作记录和错误追踪

## 🚀 快速开始

### 使用 Docker Compose（推荐）

1. **克隆项目**

   ```bash
   git clone <repository-url>
   cd file-auto-organizer
   ```

2. **配置 API Key**

   ```bash
   cp config.yaml.example config.yaml
   # 编辑 config.yaml，填入你的 OpenAI API Key
   ```

3. **启动服务**

   ```bash
   docker-compose up -d
   ```

4. **访问应用**
   - 打开浏览器访问: http://localhost:8080

### 本地开发

1. **安装依赖**

   ```bash
   npm install
   ```

2. **配置环境变量**

   ```bash
   cp config.yaml.example config.yaml
   # 编辑配置文件
   ```

3. **启动开发服务器**

   ```bash
   npm run dev
   ```

4. **访问应用**
   - 开发环境: http://localhost:8080
   - 生产环境: http://localhost:3000

## 📁 配置说明

主要配置项 `config.yaml`:

```yaml
openai:
  api_key: 'your-openai-api-key' # 必填：OpenAI API Key
  model: 'gpt-4o-mini' # 可选：AI 模型
  base_url: 'https://api.openai.com/v1' # 可选：自定义 API 端点

directories:
  root_dir: '/data/分类库' # 分类后的文件存放位置
  incoming_dir: '/data/待分类' # 需要整理的文件目录

cron:
  enabled: true # 是否启用定时任务
  schedule: '0 */6 * * *' # cron 表达式（每6小时执行一次）
```

## 🎯 工作流程

1. **扫描文件**: 监控指定目录下的新文件
2. **相似度匹配**: 优先通过文件名相似度快速匹配已有分类
3. **AI 分析**: 对无法匹配的文件调用 AI 分析内容
4. **自动分类**: 移动文件到对应的分类目录
5. **记录日志**: 详细记录每个操作步骤
6. **更新统计**: 更新文件处理统计信息

## 📊 功能模块

- **🏠 仪表板**: 系统状态和文件统计概览
- **📈 统计信息**: AI 使用情况、文件处理趋势等数据分析
- **📝 日志查看**: 详细的操作日志和错误追踪
- **⚡ 手动触发**: 立即执行文件整理任务
- **⚙️ 配置管理**: 在线修改系统配置
- **📜 任务历史**: 查看历史执行记录

## 🔧 技术栈

- **前端**: Next.js 16 + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes + Node.js
- **UI 组件**: shadcn/ui + Radix UI
- **数据获取**: SWR
- **文件处理**: exiftool-vendored
- **容器化**: Docker + Docker Compose

## 📝 开发指南

### 项目结构

```
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API 路由
│   │   ├── logs/           # 日志页面
│   │   ├── stats/          # 统计页面
│   │   └── config/         # 配置页面
│   ├── components/         # React 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── lib/               # 工具库
│   └── types/             # TypeScript 类型
├── public/                # 静态资源
├── data/                  # 持久化数据（统计、任务记录）
├── logs/                  # 日志文件（可清理）
└── config.yaml           # 配置文件
```

### 添加新功能

1. API 路由添加到 `src/app/api/`
2. 页面组件添加到 `src/app/[页面名]/`
3. 共享组件添加到 `src/components/`
4. 工具函数添加到 `src/lib/`

### 部署

#### Docker 部署

```bash
# 构建镜像
docker build -t file-auto-organizer .

# 运行容器
docker run -d \
  -p 8080:8080 \
  -v ~/Downloads:/data:rw \
  -v ./data:/app/data:rw \
  -v ./logs:/app/logs:rw \
  -v ./config.yaml:/app/config.yaml:ro \
  file-auto-organizer
```

#### 环境变量

- `NODE_ENV`: 运行环境（development/production）
- `PORT`: 服务端口（默认 8080）
- `LOG_LEVEL`: 日志级别（trace/debug/info/warn/error，默认 info）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
