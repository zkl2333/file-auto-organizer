# 定时任务遗漏问题 - 快速修复指南

## 问题现象

日志中出现：
```
[NODE-CRON] [WARN] missed execution at ... GMT+0800
```

## 根本原因

**容器在定时任务执行时被暂停或休眠**，不是代码问题。

证据：
- ❌ 没有"定时任务开始执行"日志
- ⚠️ 每天固定时间报告错过
- 🔄 容器可能被 Docker/系统暂停

## 立即修复（3 个方案）

### 方案 1: 使用外部调度器（最推荐）⭐

**适用场景**：所有 Docker 环境

```bash
# 1. 停止当前服务
docker-compose down

# 2. 使用新配置启动
docker-compose -f docker-compose.external-cron.yaml up -d

# 3. 查看日志
docker logs file-classifier-scheduler
```

**优势**：
- ✅ 调度器独立运行，不受应用容器影响
- ✅ 容器重启也不影响定时任务
- ✅ 完全避免休眠问题

---

### 方案 2: 使用宿主机 crontab（简单可靠）

**适用场景**：单台服务器/个人电脑

```bash
# 1. 修改应用为按需模式（容器保持运行）
# 编辑 docker-compose.yaml，添加 command: sleep infinity

# 2. 配置宿主机定时任务
crontab -e

# 3. 添加定时执行（每天凌晨 4 点）
0 4 * * * docker exec file-classifier bun run dist/index.js --once >> /path/to/logs/cron.log 2>&1

# 4. 验证 crontab
crontab -l
```

**优势**：
- ✅ 最简单可靠
- ✅ 不依赖容器内调度
- ✅ 系统级保证

---

### 方案 3: 添加监控和健康检查（辅助）

**适用场景**：配合方案 1 或 2 使用

```bash
# 使用带监控的配置
docker-compose -f docker-compose.monitoring.yaml up -d

# 查看健康状态
docker ps
```

**优势**：
- ✅ 及时发现容器异常
- ✅ 自动重启不健康容器
- ✅ 资源限制防止被暂停

---

## 诊断工具

### 运行诊断脚本

```bash
chmod +x diagnose.sh
./diagnose.sh
```

诊断脚本会检查：
1. ✅ 容器运行状态和时间
2. ✅ 容器重启次数
3. ✅ Docker 事件历史
4. ✅ 进程状态
5. ✅ 创建心跳监控

### 手动检查

```bash
# 查看容器启动时间
docker inspect file-classifier | grep StartedAt

# 查看最近的 Docker 事件
docker events --since 48h --filter 'container=file-classifier'

# 测试立即执行
docker exec file-classifier bun run dist/index.js --once

# 查看容器重启次数
docker inspect file-classifier | grep RestartCount
```

---

## 验证修复

### 1. 检查调度器状态（方案 1）

```bash
# 查看 Ofelia 日志
docker logs file-classifier-scheduler -f

# 应该看到类似输出：
# [Job] file-classifier-job scheduled for 0 4 * * *
```

### 2. 检查 crontab（方案 2）

```bash
# 查看 cron 日志
sudo grep CRON /var/log/syslog | grep file-classifier

# 或查看指定的日志文件
tail -f /path/to/logs/cron.log
```

### 3. 等待下次执行时间

在下次计划执行时间后，检查：

```bash
# 查看应用日志
docker logs file-classifier --tail=50

# 应该看到：
# "定时任务开始执行"
# "定时任务执行完成"
```

---

## 推荐配置

### 生产环境

```
方案 1 (Ofelia) + 方案 3 (监控)
```

### 个人电脑

```
方案 2 (crontab) + 定期检查日志
```

### 云服务器

```
方案 1 (Ofelia) 或使用云平台的定时任务服务
```

---

## 预防措施

1. **定期查看日志**：
   ```bash
   docker logs file-classifier --tail=100
   ```

2. **设置日志告警**（可选）：
   监控日志中的 `missed execution` 关键词

3. **使用心跳监控**：
   诊断脚本会自动创建心跳文件，定期检查是否有断层

4. **避免宿主机休眠**：
   如果是个人电脑，检查电源设置

---

## 常见问题

**Q: 为什么会发生容器休眠？**

A: 可能原因：
- 宿主机休眠/待机
- Docker Desktop 资源管理策略
- 云服务器省电模式
- 容器编排调度策略

**Q: 方案 1 和方案 2 哪个更好？**

A: 
- 方案 1 更专业，适合生产环境
- 方案 2 更简单，适合个人使用
- 两者都很可靠，根据场景选择

**Q: 修复后还会出现问题吗？**

A: 使用外部调度（方案 1 或 2）后，基本不会再出现此问题。

---

## 需要帮助？

查看详细文档：
- [CONTAINER_SLEEP_ISSUE.md](./CONTAINER_SLEEP_ISSUE.md) - 完整诊断和解决方案
- [README.md](./README.md) - 项目使用文档

或运行诊断脚本：
```bash
./diagnose.sh
```
