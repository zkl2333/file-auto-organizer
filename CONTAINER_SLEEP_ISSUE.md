# 容器休眠导致定时任务错过问题

## 问题诊断

### 日志分析

```
启动: 2025-11-17 02:19:58 UTC (上海 10:19)
计划: 每天 20:00 UTC (上海次日 04:00)
```

**关键证据**:
1. ❌ **没有任务执行日志** - 没有"定时任务开始执行"
2. ⚠️ **警告时间规律** - 每天 20:00 UTC 统一报告错过
3. 🔄 **启动后立即报错** - 进程启动不久就报告错过未来任务

**结论**: 容器/进程在执行时间(04:00)被暂停，在晚上(20:00)恢复

## 可能原因

### 1. Docker Desktop 资源限制 (最可能)
- Windows/Mac 的 Docker Desktop 可能有自动暂停策略
- 宿主机休眠时容器暂停
- 内存/CPU 限制导致容器被暂停

### 2. 云服务器自动停机
- 按量付费实例的自动停机策略
- 省电模式/调度策略
- Spot 实例被回收

### 3. Docker Swarm/Kubernetes 调度
- 健康检查失败导致重启
- 资源调度导致容器迁移
- 定时缩容策略

### 4. 宿主机休眠
- 个人电脑晚上休眠
- 服务器节能模式

## 诊断方法

### 1. 检查容器运行时间

```bash
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
```

如果 `Up time` 经常重置，说明容器被重启

### 2. 查看 Docker 事件日志

```bash
# 查看过去24小时的容器事件
docker events --since 24h --filter 'container=file-classifier'
```

查找 `pause`, `stop`, `kill`, `restart` 事件

### 3. 检查宿主机日志

```bash
# Linux
journalctl -u docker --since "2 days ago" | grep file-classifier

# Mac
log show --predicate 'process == "Docker"' --last 2d
```

### 4. 添加心跳监控

在容器内添加定时心跳检测：

```bash
# 每分钟记录一次心跳
docker exec file-classifier sh -c 'while true; do echo "$(date +%s) heartbeat" >> /app/logs/heartbeat.log; sleep 60; done' &
```

然后检查 `heartbeat.log`，看是否有时间断层

### 5. 使用 healthcheck

在 `docker-compose.yaml` 添加：

```yaml
services:
  file-classifier:
    healthcheck:
      test: ["CMD", "sh", "-c", "test -f /app/logs/system.log"]
      interval: 1m
      timeout: 10s
      retries: 3
      start_period: 10s
```

## 解决方案

### 方案 1: 添加容器心跳日志

```yaml
# docker-compose.yaml
services:
  file-classifier:
    image: docker.io/zkl2333/file-auto-organizer:latest
    container_name: file-classifier
    restart: unless-stopped
    
    # 添加健康检查
    healthcheck:
      test: ["CMD", "sh", "-c", "ps aux | grep -v grep | grep -q 'bun'"]
      interval: 30s
      timeout: 10s
      retries: 3
    
    # 添加资源限制（防止被系统暂停）
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M
    
    volumes:
      - ~/Downloads:/data:rw
      - ./logs:/app/logs:rw
      - ./config.yaml:/app/config.yaml:ro
    working_dir: /app
    
    # 添加日志驱动配置
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 方案 2: 修改代码添加进程活跃监控

创建心跳文件：

```typescript
// src/heartbeat.ts
import fs from "node:fs";
import path from "node:path";
import { systemLogger } from "./logger.js";

export class Heartbeat {
  private heartbeatFile: string;
  private intervalId?: NodeJS.Timeout;

  constructor(logDir: string = "./logs") {
    this.heartbeatFile = path.join(logDir, "heartbeat.txt");
  }

  start(intervalMs: number = 60000) {
    this.intervalId = setInterval(() => {
      const timestamp = new Date().toISOString();
      fs.writeFileSync(this.heartbeatFile, timestamp);
      systemLogger.debug({ timestamp }, "心跳");
    }, intervalMs);
    
    systemLogger.info({ interval: intervalMs }, "心跳监控已启动");
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      systemLogger.info("心跳监控已停止");
    }
  }
}
```

### 方案 3: 使用外部定时器 (推荐)

不依赖容器内的 node-cron，改用宿主机的 crontab 或外部调度器：

**选项 A: 宿主机 crontab**

```bash
# 编辑 crontab
crontab -e

# 添加
0 4 * * * docker exec file-classifier bun run dist/index.js --once >> /path/to/logs/cron.log 2>&1
```

**选项 B: 使用 Ofelia (Docker 定时任务工具)**

```yaml
# docker-compose.yaml
services:
  file-classifier:
    # 移除内部 cron，改为 CMD ["sleep", "infinity"]
    command: sleep infinity
    labels:
      ofelia.enabled: "true"
      ofelia.job-exec.file-classifier.schedule: "0 4 * * *"
      ofelia.job-exec.file-classifier.command: "bun run dist/index.js --once"

  ofelia:
    image: mcuadros/ofelia:latest
    depends_on:
      - file-classifier
    command: daemon --docker
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

**选项 C: Kubernetes CronJob**

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: file-classifier-job
spec:
  schedule: "0 20 * * *"  # UTC 20:00 = 上海 04:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: file-classifier
            image: docker.io/zkl2333/file-auto-organizer:latest
            command: ["bun", "run", "dist/index.js", "--once"]
          restartPolicy: OnFailure
```

### 方案 4: 防止宿主机休眠

**Windows:**
```powershell
# 禁用休眠
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

**Mac:**
```bash
# 禁用睡眠（需要sudo）
sudo pmset -a disablesleep 1
```

**Linux:**
```bash
# 禁用休眠
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

## 推荐方案

### 短期方案 (立即实施)
1. 添加健康检查和资源配置 (方案1)
2. 检查宿主机是否有休眠/暂停设置

### 长期方案 (生产环境)
- **个人电脑**: 使用方案3A (宿主机 crontab)
- **单台服务器**: 使用方案3B (Ofelia)  
- **Kubernetes**: 使用方案3C (CronJob)

## 立即执行的检查

```bash
# 1. 查看容器启动时间
docker inspect file-classifier | grep StartedAt

# 2. 查看容器重启次数
docker inspect file-classifier | grep RestartCount

# 3. 查看 Docker 事件
docker events --since 48h --filter 'container=file-classifier' > docker-events.log

# 4. 测试容器是否能正常运行
docker exec file-classifier bun run dist/index.js --once

# 5. 检查宿主机定时任务
crontab -l
```
