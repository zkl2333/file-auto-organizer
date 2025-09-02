# File Auto Organizer

自动整理文件的工具，通过AI分析文件内容来决定放在哪个文件夹。

## 解决什么问题

文件夹总是很乱？下载文件夹、桌面、工作目录到处都是文件？这个工具会自动帮你整理。

它会：
- 读取文件内容，判断这是什么类型的文件
- 参考已有的文件夹结构，或者自动创建合适的分类
- 自动移动文件到对应位置
- 如果文件名很相似，直接匹配，不浪费AI调用

## 工作流程

1. 扫描待分类目录（可以是下载文件夹、桌面等任意位置）
2. 分析现有的分类目录结构，如果有的话
3. 优先用文件名相似度快速匹配
4. 无法匹配的文件交给AI分析内容，自动创建合适的分类
5. 移动文件到对应位置
6. 记录处理日志

## 快速开始

建议用Docker，比较省事：

### 需要准备
- Docker 和 Docker Compose
- OpenAI API Key

### 部署步骤

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
     file-classifier:
       image: docker.io/zkl2333/file-auto-organizer:latest
       container_name: file-classifier
       restart: unless-stopped
       volumes:
         - ~/Downloads:/data
         - ./logs:/app/logs
         - ./config.yaml:/app/config.yaml
   ```

4. **启动**
   ```bash
   docker compose up -d
   ```

5. **开始使用**
   - 把要分类的文件丢到 `~/Downloads/待分类/` 
   - 程序会自动分析并创建合适的分类结构
   - 也可以预先建立文件夹，程序会参考已有结构
   - 程序每小时自动跑一次

### 使用示例

**方式1：自动创建分类**
直接把文件丢到 `~/Downloads/待分类/`，程序会分析内容并自动创建类似这样的结构：
```
~/Downloads/分类库/
├── 工作文档/
├── 学习资料/
└── 个人文件/
```

**方式2：参考已有分类**
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
# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止
docker compose down

# 重启
docker compose restart
```

## 配置说明

主要配置项：

```yaml
openai:
  api_key: "your-api-key"              # 必填
  model: "gpt-5-nano"                  # AI模型
  base_url: ""                         # 兼容其他API服务，可选

directories:
  root_dir: "./分类库"                  # 分类后文件存储位置
  incoming_dir: "./待分类"              # 待分类文件位置

cron:
  schedule: "0 * * * *"                # 定时规则（每小时）
  # "*/5 * * * *" - 每5分钟
  # "0 0 * * *" - 每天午夜

logging:
  level: "info"                        # debug, info, warn, error
  dir: "./logs"                        # 日志目录

scan:
  max_depth: 3                         # 扫描深度
  similarity_threshold: 0.65           # 相似度阈值

ai:
  batch_size: 5                        # 批量处理数量
```

**不同使用场景的目录配置：**
- 下载文件夹：`incoming_dir: "C:/Users/username/Downloads"`
- 桌面整理：`incoming_dir: "C:/Users/username/Desktop"`


## 开发

如果要改代码：

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 测试运行（不移动文件）
npm run dry

# 单次运行
npm run once
```
