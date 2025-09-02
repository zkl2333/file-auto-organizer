# 智能文件自动分类器 (File Auto Organizer)

一个基于 AI 的智能文件分类工具，能够自动分析文件内容并将其归类到合适的目录结构中。

## 🚀 核心功能

### 智能文件分类
- **AI 内容分析**：使用 OpenAI GPT 模型分析文件内容，理解文件性质和用途
- **智能目录映射**：根据文件内容自动匹配到现有的目录结构
- **相似度匹配**：通过文件名相似度算法，避免重复的 AI 调用，提高效率
- **批量处理**：支持批量处理多个文件，智能控制 AI 调用频率

### 自动化运行
- **定时任务**：支持 Cron 表达式配置，自动定期扫描和分类文件
- **单次运行**：支持手动触发单次分类任务
- **干预模式**：提供 dry-run 模式，预览分类结果不实际移动文件

### 完善的日志系统
- **分模块日志**：系统、AI、文件操作等各模块独立日志记录
- **详细追踪**：记录每个文件的分类过程和决策依据
- **错误监控**：完整的错误捕获和恢复机制

## 🔧 工作原理

1. **文件扫描**：扫描指定的"待分类"目录，发现新文件
2. **目录结构分析**：分析现有的"分类库"目录结构，了解分类体系
3. **相似度匹配**：首先通过文件名相似度算法尝试快速匹配
4. **AI 智能分析**：对无法匹配的文件，使用 AI 分析内容并推荐分类
5. **安全移动**：将文件移动到推荐的目录，如目录不存在则自动创建
6. **日志记录**：记录整个处理过程，便于审计和调试

## ✨ 主要特性

- **🤖 智能分类**：基于文件内容而非仅仅文件名进行分类
- **⚡ 高效算法**：相似度匹配 + AI 分析的混合策略，减少 API 调用
- **🔄 自动化**：无人值守的定时任务，持续维护文件组织
- **🛡️ 安全可靠**：完善的错误处理和文件安全移动机制
- **📊 可观测性**：详细的日志记录和处理统计
- **🐳 容器化**：支持 Docker 部署，开箱即用
- **⚙️ 灵活配置**：丰富的配置选项，适应不同使用场景

## 🚀 快速开始（推荐 Docker）

**强烈推荐使用 Docker 部署**，开箱即用，稳定可靠：

### 环境要求
- Docker & Docker Compose
- OpenAI API Key（或兼容的 API 服务）

### 一键部署

1. **创建工作目录**
   ```bash
   mkdir file-auto-organizer
   cd file-auto-organizer
   ```

2. **创建配置文件**
   
   创建 `config.yaml`：
   ```yaml
   # config.yaml
   openai:
     api_key: "your-openai-api-key-here"
     model: "gpt-5-nano"

   directories:
     root_dir: "/data/分类库"
     incoming_dir: "/data/待分类"

   cron:
     schedule: "0 * * * *"

   logging:
     level: "info"
     dir: "/app/logs"
   ```

3. **创建 Docker Compose 配置**
   
   创建 `docker-compose.yaml`：
   ```yaml
   version: "3.9"

   services:
     file-classifier:
       image: docker.io/zkl2333/file-auto-organizer:latest
       container_name: file-classifier
       restart: unless-stopped
       volumes:
         # 宿主机下载目录挂载到容器内 /data
         - ~/Downloads:/data:rw
         # 日志输出目录
         - ./logs:/app/logs:rw
         # 配置文件挂载
         - ./config.yaml:/app/config.yaml:ro
       working_dir: /app
   ```

4. **启动容器**
   ```bash
   docker compose up -d
   ```

5. **使用**
   - 将待分类文件放入 `~/Downloads/待分类/` 目录
   - 在 `~/Downloads/分类库/` 中创建你的分类结构
   - 程序会自动运行，每小时处理一次

### 使用示例

在 `~/Downloads/分类库/` 中创建你想要的分类结构：
```
~/Downloads/分类库/
├── 工作文档/
│   ├── 会议记录/
│   └── 项目资料/
├── 学习资料/
│   ├── 编程/
│   └── 设计/
└── 个人文件/
    ├── 照片/
    └── 账单/
```

然后将需要分类的文件放入 `~/Downloads/待分类/` 目录，AI 会自动分析内容并移动到合适的位置。

### 管理容器

```bash
# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看详细日志文件
ls ./logs/
```

### Docker Compose 配置说明

**卷挂载：**
- `~/Downloads:/data:rw` - 将宿主机的下载目录挂载到容器，用于文件分类
- `./logs:/app/logs:rw` - 日志输出目录，便于查看运行日志
- `./config.yaml:/app/config.yaml:ro` - 配置文件只读挂载

**容器设置：**
- `restart: unless-stopped` - 容器异常退出时自动重启
- `container_name: file-classifier` - 容器名称，便于管理

## ⚙️ 详细配置

### 完整配置文件示例

```yaml
# 文件自动分类器配置文件
# OpenAI API 配置
openai:
  api_key: "your-openai-api-key-here"  # 您的OpenAI API密钥
  model: "gpt-5-nano"  # 使用的模型
  base_url: ""  # 自定义API基础URL（可选）

# 目录配置
directories:
  root_dir: "./分类库"     # 分类库根目录
  incoming_dir: "./待分类" # 待分类目录

# 定时任务配置
cron:
  schedule: "0 * * * *"  # Cron表达式（Unix格式：分 时 日 月 星期）
  # 常用表达式示例：
  # "*/5 * * * *"   - 每5分钟执行一次
  # "0 * * * *"     - 每小时执行一次
  # "0 0 * * *"     - 每天午夜执行一次
  # "0 0 * * 0"     - 每周日午夜执行一次

# 日志配置
logging:
  level: "info"          # 日志级别: debug, info, warn, error
  dir: "./logs"          # 日志目录

# 扫描配置
scan:
  max_depth: 3                    # 最大扫描深度
  similarity_threshold: 0.65      # 相似度阈值 (0.0-1.0)

# AI 配置
ai:
  batch_size: 5  # AI批量处理文件数量，建议5个以内避免AI出错
```

### 配置项说明

**OpenAI API 配置：**
- `openai.api_key`: OpenAI 或兼容服务的 API Key
- `openai.base_url`: 可选，自定义 OpenAI 兼容服务 base URL
- `openai.model`: 使用的模型，默认 `gpt-5-nano`

**目录配置：**
- `directories.root_dir`: 分类库根目录（默认 `./分类库`）
- `directories.incoming_dir`: 待分类目录（默认 `./待分类`）

**定时任务配置：**
- `cron.schedule`: 定时规则（默认每小时 `0 * * * *`）

**日志配置：**
- `logging.level`: 日志级别（默认 `info`）
- `logging.dir`: 日志目录（默认 `./logs`）

**扫描配置：**
- `scan.similarity_threshold`: 相似度阈值，命中则不走 AI（默认 `0.65`）
- `scan.max_depth`: 目录/文件扫描深度（默认 `3`）

## 🛠️ 开发指南

仅供开发者参考，用户可忽略此部分。

### 开发命令

```bash
# 开发模式（TypeScript 直接运行）
npm run dev

# 构建项目
npm run build

# 测试命令
npm run dry   # 预览模式，不实际移动文件
npm run once  # 单次运行模式
```

### 项目结构

```
src/
├── config.ts                        # 配置管理
├── logger.ts                        # 分模块日志系统
├── index.ts                         # 主入口
├── process-manager.ts               # 进程生命周期管理
└── service/
    ├── main.service.ts              # 主服务逻辑
    ├── ai-classification.service.ts # AI分类服务
    ├── file-info.service.ts         # 文件信息解析
    ├── file-move.service.ts         # 文件移动服务
    └── file-scan.service.ts         # 文件扫描服务
```
