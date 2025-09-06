# File Auto Organizer

自动整理文件的工具，通过 AI 分析文件内容来决定放在哪个文件夹。

## 解决什么问题

文件夹总是很乱？下载文件夹、桌面、工作目录到处都是文件？这个工具会自动帮你整理。

它会：

- 读取文件内容，判断这是什么类型的文件
- 参考已有的文件夹结构，或者自动创建合适的分类
- 自动移动文件到对应位置
- 如果文件名很相似，直接匹配，不浪费 AI 调用

## 工作流程

1. 扫描待分类目录（可以是下载文件夹、桌面等任意位置）
2. 分析现有的分类目录结构，如果有的话
3. 优先用文件名相似度快速匹配
4. 无法匹配的文件交给 AI 分析内容，自动创建合适的分类
5. 移动文件到对应位置
6. 记录处理日志

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

最简单的方式，支持所有平台：

#### 需要准备

- Docker 和 Docker Compose
- OpenAI API Key

#### 部署步骤

1. **创建工作目录**

   ```bash
   mkdir file-auto-organizer
   cd file-auto-organizer
   ```

2. **创建配置文件 config.yaml**

   ```yaml
   openai:
     api_key: "your-openai-api-key-here"
     model: "gpt-5-nano"

   directories:
     root_dir: "/data/分类库"
     incoming_dir: "/data/待分类"

   cron:
     schedule: "0 * * * *"
   ```

3. **创建 docker-compose.yaml**

   ```yaml
   services:
     file-organizer:
       image: docker.io/zkl2333/file-auto-organizer:latest
       container_name: file-organizer
       restart: unless-stopped
       volumes:
         - ~/Downloads:/data:rw
         - ./logs:/app/logs:rw
         - ./config.yaml:/app/config.yaml:ro
   ```

4. **启动服务**

   ```bash
   docker compose up -d
   ```

5. **查看运行状态**

   ```bash
   # 查看日志
   docker compose logs -f

   # 查看服务状态
   docker compose ps
   ```

### 方式二：本地运行

适合需要自定义配置的用户：

#### 环境要求

- [Bun](https://bun.sh/) 1.0+
- OpenAI API Key

#### 安装步骤

1. **安装 Bun**

   ```bash
   # macOS/Linux
   curl -fsSL https://bun.sh/install | bash

   # Windows (PowerShell)
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```

2. **克隆项目**

   ```bash
   git clone https://github.com/zkl2333/file-auto-organizer.git
   cd file-auto-organizer
   ```

3. **安装依赖**

   ```bash
   bun install
   ```

4. **配置应用**

   ```bash
   # 复制配置示例
   cp config.yaml.example config.yaml

   # 编辑配置文件，设置你的 API Key 和目录
   ```

5. **运行应用**

   ```bash
   # 单次运行
   bun run once

   # 模拟运行（不实际移动文件）
   bun run dry
   ```

### 使用示例

**方式 1：自动创建分类**
直接把文件丢到 `~/Downloads/待分类/`，程序会分析内容并自动创建类似这样的结构：

```
~/Downloads/分类库/
├── 工作文档/
├── 学习资料/
└── 个人文件/
```

**方式 2：参考已有分类**
如果你已经有文件夹结构，程序会优先匹配到现有分类：

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

**灵活配置目录**
不只是下载文件夹，你可以整理任意目录：

- 桌面文件：`Desktop` → `Desktop/整理后`
- 工作目录：`~/Documents/乱七八糟` → `~/Documents/分类库`

### 常用命令

```bash
# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新镜像
docker compose pull && docker compose up -d
```

### 本地运行命令

```bash
# 单次运行
bun run once

# 模拟运行（不移动文件，用于测试）
bun run dry

# 后台运行（定时模式）
bun start
```

## 配置说明

主要配置项：

```yaml
openai:
  api_key: "your-api-key" # 必填
  model: "gpt-5-nano" # AI模型
  base_url: "" # 兼容其他API服务，可选

directories:
  root_dir: "./分类库" # 分类后文件存储位置
  incoming_dir: "./待分类" # 待分类文件位置

cron:
  schedule: "0 * * * *" # 定时规则（每小时）
  # "*/5 * * * *" - 每5分钟
  # "0 0 * * *" - 每天午夜

logging:
  level: "info" # debug, info, warn, error
  dir: "./logs" # 日志目录

scan:
  max_depth: 3 # 扫描深度
  similarity_threshold: 0.65 # 相似度阈值

ai:
  batch_size: 5 # 批量处理数量
```

**不同使用场景的目录配置：**

- 下载文件夹：`incoming_dir: "C:/Users/username/Downloads"`
- 桌面整理：`incoming_dir: "C:/Users/username/Desktop"`

## 📋 常见问题

### Q: 支持哪些文件类型？

A: 支持几乎所有常见文件类型，包括：

- 文档：PDF, Word, Excel, PowerPoint, TXT, Markdown 等
- 图片：JPG, PNG, GIF, SVG, WebP 等
- 视频：MP4, AVI, MOV, MKV 等
- 音频：MP3, WAV, FLAC 等
- 压缩包：ZIP, RAR, 7Z 等
- 代码文件：JS, TS, Python, Java 等

### Q: AI 分类准确吗？

A: AI 会分析文件名、内容和元数据来做出分类决策。对于无法确定的文件，会优先使用文件名相似度匹配，确保分类的准确性。

### Q: 会移动重要文件吗？

A: 程序只会移动指定 `incoming_dir` 目录中的文件，不会触碰其他位置的文件。建议先使用 `--dry-run` 模式测试。

### Q: 如何自定义分类规则？

A: 可以预先创建文件夹结构，程序会优先匹配到现有分类。也可以通过修改 AI 提示词来调整分类策略。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
