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

### 准备工作

- Docker 和 Docker Compose
- OpenAI API Key 或兼容接口的 API Key

### 第一步：创建工作目录

```bash
mkdir file-auto-organizer
cd file-auto-organizer
mkdir logs
```

### 第二步：创建配置文件

创建 `config.yaml` 文件：

```yaml
# AI 配置
openai:
  api_key: "your-api-key-here"        # 请替换为你的 API Key
  model: "gpt-5-nano"                # 推荐模型，性价比高
  base_url: "https://aihubmix.com/v1"  # 推荐的兼容接口

# 目录配置  
directories:
  root_dir: "/data/分类库"             # 分类后文件存储位置
  incoming_dir: "/data/待分类"         # 待分类文件位置

# 定时任务配置
cron:
  schedule: "0 * * * *"               # 每小时执行一次

# 其他配置
logging:
  level: "info"
  dir: "/app/logs"

scan:
  max_depth: 3
  similarity_threshold: 0.65

ai:
  batch_size: 5
```

**OpenAI 兼容接口推荐：**
- 使用 `https://aihubmix.com/v1` 作为 `base_url`
- 一站式对接各种大模型。让开发更智能、更高效。
- 注册地址：[console.aihubmix.com](https://console.aihubmix.com?aff=SWnZ)

## Docker 运行方式

### 方式一：定时自动运行（推荐）

适合需要持续监控和整理文件的场景。

**创建 docker-compose.yaml：**

```yaml
services:
  file-organizer:
    image: docker.io/zkl2333/file-auto-organizer:latest
    container_name: file-organizer
    restart: unless-stopped
    volumes:
      # 文件目录挂载（根据实际情况修改路径）
      - ~/Downloads:/data:rw               # 下载文件夹
      - ./logs:/app/logs:rw                # 日志目录
      - ./config.yaml:/app/config.yaml:ro # 配置文件
    environment:
      - TZ=Asia/Shanghai                   # 时区设置
    working_dir: /app
```

**启动服务：**

```bash
# 启动定时服务
docker compose up -d

# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 查看最近日志
docker compose logs --tail=50
```

**服务管理：**

```bash
# 停止服务
docker compose down

# 重启服务  
docker compose restart

# 更新镜像
docker compose pull && docker compose up -d
```

### 方式二：单次手动运行

适合偶尔整理文件或测试效果的场景。

**使用专用配置文件（推荐）：**

项目提供了 `docker-compose.once.yaml` 文件：

```bash
# 立即执行一次整理
docker compose -f docker-compose.once.yaml up

# 模拟运行（不移动文件，查看分类效果）
docker compose -f docker-compose.once.yaml run --rm file-classifier-once \
  bun run dist/index.js --dry-run --once
```

**使用 docker run 命令：**

```bash
# 单次运行
docker run --rm \
  -v ~/Downloads:/data:rw \
  -v ./logs:/app/logs:rw \
  -v ./config.yaml:/app/config.yaml:ro \
  docker.io/zkl2333/file-auto-organizer:latest \
  bun run dist/index.js --once

# 模拟运行（推荐先用这个测试）
docker run --rm \
  -v ~/Downloads:/data:rw \
  -v ./logs:/app/logs:rw \
  -v ./config.yaml:/app/config.yaml:ro \
  docker.io/zkl2333/file-auto-organizer:latest \
  bun run dist/index.js --dry-run --once
```


**目录挂载示例：**

```bash
# 整理下载文件夹
-v ~/Downloads:/data:rw

# 整理桌面文件
-v ~/Desktop:/data:rw

# 整理指定目录
-v /path/to/your/files:/data:rw

# 多目录挂载（高级用法）
-v ~/Downloads:/data/downloads:rw \
-v ~/Desktop:/data/desktop:rw
```

## 使用建议

### 首次使用流程

1. **先模拟运行**：使用 `--dry-run` 参数查看分类效果
2. **检查日志**：确认分类逻辑符合预期  
3. **小范围测试**：先在少量文件上测试
4. **正式使用**：确认无误后进行正式整理

### 目录结构示例

**自动创建分类：**
```
~/Downloads/分类库/
├── 工作文档/
├── 学习资料/
└── 个人文件/
```

**参考已有分类：**
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

## 配置说明

### 目录配置

配置文件中的目录路径是相对于容器内的，需要与 Docker 挂载对应：

| Docker 挂载 | 配置文件路径 | 实际效果 |
|------------|-------------|---------|
| `~/Downloads:/data:rw` | `root_dir: "/data/分类库"` | 文件分类到 `~/Downloads/分类库/` |
| `~/Downloads:/data:rw` | `incoming_dir: "/data/待分类"` | 扫描 `~/Downloads/待分类/` 目录 |

### 定时任务配置

```yaml
cron:
  schedule: "0 * * * *"    # 每小时
  # schedule: "*/5 * * * *"  # 每5分钟
  # schedule: "0 2 * * *"    # 每天凌晨2点
  # schedule: "0 8,20 * * *" # 每天8点和20点
```

## 本地运行

如果需要本地开发或调试：

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 克隆项目
git clone https://github.com/zkl2333/file-auto-organizer.git
cd file-auto-organizer

# 安装依赖
bun install

# 配置文件
cp config.yaml.example config.yaml
# 编辑 config.yaml 设置你的 API Key

# 运行
bun run once    # 单次运行
bun run dry     # 模拟运行
bun start       # 后台定时运行
```

## 常见问题

### Q: 支持哪些文件类型？

A: 支持几乎所有常见文件类型，包括文档、图片、视频、音频、压缩包、代码文件等。

### Q: AI 分类准确吗？

A: AI 会分析文件名、内容和元数据来做出分类决策。对于无法确定的文件，会优先使用文件名相似度匹配，确保分类的准确性。

### Q: 会移动重要文件吗？

A: 程序只会移动指定 `incoming_dir` 目录中的文件，不会触碰其他位置的文件。建议先使用 `--dry-run` 模式测试。

### Q: 如何自定义分类规则？

A: 可以预先创建文件夹结构，程序会优先匹配到现有分类。也可以通过修改 AI 提示词来调整分类策略。

## 许可证

MIT License