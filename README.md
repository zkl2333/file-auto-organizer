# File Auto Organizer

基于 AI 的智能文件整理工具，自动分析文件内容并分类归档。

## ✨ 特性

- 🤖 **AI 智能分类**: 使用 OpenAI API 分析文件内容，自动决定文件归属
- ⚡ **相似度匹配**: 优先通过文件名相似度快速匹配，减少 AI 调用
- 🌐 **Web 界面**: 现代化管理界面
- 📊 **实时统计**: 查看文件处理历史、AI 使用情况
- ⏰ **定时任务**: 支持自动定时整理

## 🚀 快速开始

### Docker 部署（推荐）

```bash
# 创建目录
mkdir -p file-auto-organizer && cd file-auto-organizer
mkdir -p data logs

# 下载配置模板
curl -O https://raw.githubusercontent.com/zkl2333/file-auto-organizer/main/config.yaml.example
mv config.yaml.example config.yaml
# 编辑 config.yaml，填入 OpenAI API Key

# 启动
docker run -d \
  --name file-auto-organizer \
  -p 8080:8080 \
  -v ~/Downloads:/data:rw \
  -v ./data:/app/data:rw \
  -v ./logs:/app/logs:rw \
  -v ./config.yaml:/app/config.yaml:ro \
  docker.io/zkl2333/file-auto-organizer:latest

# 访问 http://localhost:8080
```

## 📁 配置

编辑 `config.yaml`:

```yaml
openai:
  api_key: 'your-openai-api-key' # 必填
  model: 'gpt-5-nano' # 可选
  base_url: 'https://api.openai.com/v1' # 可选：自定义端点

directories:
  root_dir: '/data/分类库' # 分类后存放位置
  incoming_dir: '/data/待分类' # 待整理文件目录

cron:
  enabled: true
  schedule: '0 */6 * * *' # 每6小时执行
```

## 🐳 Docker Compose

```yaml
# docker-compose.yml
services:
  file-auto-organizer:
    image: zkl2333/file-auto-organizer:latest
    ports:
      - '8080:8080'
    volumes:
      - ~/Downloads:/data:rw
      - ./data:/app/data:rw
      - ./logs:/app/logs:rw
      - ./config.yaml:/app/config.yaml:ro
    restart: unless-stopped
```

```bash
docker-compose up -d
```

### 目录说明

| 目录               | 说明                 |
| ------------------ | -------------------- |
| `/data`            | 待分类和分类后的文件 |
| `/app/data`        | 统计数据和任务记录   |
| `/app/logs`        | 日志文件             |
| `/app/config.yaml` | 配置文件             |

### 环境变量

| 变量        | 说明     | 默认值 |
| ----------- | -------- | ------ |
| `PORT`      | 服务端口 | 8080   |
| `LOG_LEVEL` | 日志级别 | info   |

## 📄 许可证

MIT License
