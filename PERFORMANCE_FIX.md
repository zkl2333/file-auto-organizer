# Node-Cron 任务遗漏问题修复

## 问题诊断

**现象**: 连续多天在凌晨 4 点错过定时任务执行
```
[NODE-CRON] [WARN] missed execution! Possible blocking IO or high CPU
```

**根本原因**:
1. 任务执行时间超过定时间隔（默认每小时一次）
2. 缺少并发控制，导致任务重叠
3. 无性能监控，无法识别瓶颈

## 修复方案

### 1. 添加任务运行状态管理 (`src/index.ts`)

**防止任务重叠**:
```typescript
let isRunning = false;

if (isRunning) {
  logger.warn("上次任务还在运行中，跳过本次执行");
  return;
}
```

**记录执行时间**:
- 任务开始时间
- 任务执行时长
- 失败时也记录时长

### 2. 添加详细性能监控 (`src/service/main.service.ts`)

**各阶段耗时统计**:
- **目录扫描**: 扫描多少目录，耗时多少
- **文件扫描**: 扫描多少文件，耗时多少
- **相似度匹配**: 处理多少文件，耗时多少
- **文件移动**: 移动多少文件，耗时多少
- **AI 分类**: 分批处理，每批耗时
- **总耗时**: 整个任务的完整执行时间

## 日志示例

```json
{
  "msg": "扫描已知文件完成",
  "fileCount": 1523,
  "duration": 2341,
  "durationReadable": "2.34s"
}

{
  "msg": "相似度匹配完成",
  "similarityCount": 5,
  "aiNeededCount": 3,
  "duration": 1234,
  "durationReadable": "1.23s"
}

{
  "msg": "定时任务执行完成",
  "duration": 45678,
  "durationReadable": "45.68s"
}
```

## 性能优化建议

### 1. 调整定时任务间隔

如果任务经常超过 1 小时，修改 `config.yaml`:

```yaml
cron:
  schedule: "0 */2 * * *"  # 每 2 小时执行一次
  # 或
  schedule: "0 0 * * *"     # 每天凌晨执行一次
```

### 2. 限制扫描深度

大量文件会导致扫描缓慢:

```yaml
scan:
  max_depth: 2  # 减少扫描深度（默认 3）
```

### 3. 优化 AI 批次大小

根据 API 限制和文件数量调整:

```yaml
ai:
  batch_size: 3  # 减少批次大小（默认 5）
```

### 4. 使用增量扫描（建议未来优化）

- 缓存已扫描的目录结构
- 只扫描有变化的目录
- 使用文件系统监听 (fs.watch)

### 5. 并行化相似度计算（建议未来优化）

当前是串行计算，可以并行处理:

```typescript
const results = await Promise.all(
  filesToProcess.map(f => this.findMostSimilarFile(f, knownFiles))
);
```

## 监控检查清单

运行任务后检查日志:

- [ ] 目录扫描耗时是否超过 5 秒？
- [ ] 文件扫描耗时是否超过 10 秒？
- [ ] 相似度匹配耗时是否超过 30 秒？
- [ ] AI 分类单批耗时是否超过 60 秒？
- [ ] 总耗时是否接近或超过定时间隔？
- [ ] 是否出现"上次任务还在运行中"警告？

## 下一步

1. 观察日志中的 `duration` 字段
2. 识别最耗时的环节
3. 根据实际情况调整配置或优化代码
4. 考虑实施上述性能优化建议
