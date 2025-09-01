# file-auto-organizer

## 开发环境使用

1. 安装依赖

   ```bash
   npm install
   ```

2. 配置应用

   复制配置文件示例并编辑：

   ```bash
   cp config.example.yaml config.yaml
   ```

   然后编辑 `config.yaml` 文件，填写您的配置信息：

   ```yaml
   # OpenAI API 配置
   openai:
     api_key: "your-openai-api-key-here" # 您的OpenAI API密钥
     model: "gpt-4o-mini" # 使用的模型
     base_url: "" # 自定义API基础URL（可选）

   # 目录配置
   directories:
     root_dir: "./分类库" # 分类后的文件存储根目录
     incoming_dir: "./待分类" # 待分类文件目录

   # 其他配置...
   ```

3. 本地开发启动（TypeScript 直跑）

   ```bash
   npm run dev
   ```

4. 构建与运行（生成 dist 后运行）

   ```bash
   npm run build
   npm run start
   ```

5. 测试运行（不实际移动）

   - 单次 dry-run：
     ```bash
     npm run build && npm run dry
     ```
   - 单次真实运行（不进入定时）：
     ```bash
     npm run build && npm run once
     ```

6. 配置文件说明

   `config.yaml` 包含以下配置项：

   **OpenAI API 配置：**

   - `openai.api_key`: OpenAI 或兼容服务的 API Key
   - `openai.base_url`: 可选，自定义 OpenAI 兼容服务 base URL
   - `openai.model`: 使用的模型，默认 `gpt-4o-mini`

   **目录配置：**

   - `directories.root_dir`: 分类库根目录（默认 `./分类库`）
   - `directories.incoming_dir`: 待分类目录（默认 `./待分类`）

   **定时任务配置：**

   - `cron.schedule`: 定时规则（默认每小时 `0 * * * *`）

   **日志配置：**

   - `logging.level`: 日志级别（默认 `info`）
   - `logging.file`: 日志文件路径（默认 `./logs/app.log`）

   **扫描配置：**

   - `scan.similarity_threshold`: 相似度阈值，命中则不走 AI（默认 `0.65`）
   - `scan.max_depth`: 目录/文件扫描深度（默认 `3`）


7. Docker 方式

   **使用 Docker 前准备：**

   1. 配置应用（如果还没有配置）：

      ```bash
      cp config.example.yaml config.yaml
      ```

   2. 编辑配置文件，设置 Docker 环境下的路径：

      ```yaml
      # OpenAI API 配置
      openai:
        api_key: "your-openai-api-key-here"

      # 目录配置（Docker容器内路径）
      directories:
        root_dir: "/data/分类库" # 分类后的文件存储目录
        incoming_dir: "/data/待分类" # 待分类文件目录

      # 日志配置（Docker容器内路径）
      logging:
        file: "/app/logs/app.log"
      ```

   3. 启动 Docker 容器：
      ```bash
      docker compose up -d --build
      ```

   **Docker 配置说明：**

   - 配置文件通过卷挂载方式传入容器
   - 宿主机目录 `~/Downloads` 挂载到容器内 `/data`
   - 日志文件存储在 `./logs` 目录
   - 配置文件中的路径应使用容器内的绝对路径
