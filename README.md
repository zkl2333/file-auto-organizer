# file-auto-organizer

## 开发环境使用

1. 安装依赖
   
   ```bash
   npm install
   ```

2. 复制环境变量示例并填写
   
   ```bash
   cp .env.example .env
   # 编辑 .env 填写 OPENAI_API_KEY 等
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

5. 关键环境变量说明
   - `OPENAI_API_KEY`: OpenAI 或兼容服务的 API Key
   - `OPENAI_BASE_URL`: 可选，自定义 OpenAI 兼容服务 base URL
   - `OPENAI_MODEL`: 默认 `gpt-4o-mini`
   - `ROOT_DIR`: 分类库根目录（默认 `./分类库`）
   - `INCOMING_DIR`: 待分类目录（默认 `./待分类`）
   - `CRON_SCHEDULE`: 定时规则（默认每小时 `0 * * * *`）
   - `LOG_LEVEL`: 日志级别（默认 `info`）
   - `LOG_FILE`: 移动日志路径（默认 `./logs/move.log`）
   - `SIMILARITY_THRESHOLD`: 相似度阈值，命中则不走 AI（默认 `0.65`）
   - `MAX_SCAN_DEPTH`: 目录/文件扫描深度（默认 `3`）

6. Docker 方式
   
   ```bash
   docker compose up -d --build
   ```

   通过 `docker-compose.yaml` 可传入上述环境变量。