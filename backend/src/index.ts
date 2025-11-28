import cron, { ScheduledTask } from "node-cron";
import { systemLogger as logger, cleanupLogFiles } from "./logger.js";
import { config, getConfigSnapshot } from "./config.js";
import { MainService } from "./service/main.service.js";
import { StatsService } from "./service/stats.service.js";
import { cleanupFileInfo, cleanupFileInfoSync } from "./service/file-info.service.js";
import { processManager } from "./process-manager.js";
import { startServer } from "./server.js";

const { OPENAI_API_KEY, CRON_SCHEDULE } = config;

// 全局定时任务实例和当前调度表达式
let cronTask: ScheduledTask | null = null;
let currentSchedule: string = CRON_SCHEDULE;

/**
 * 注册所有清理函数到进程管理器
 */
function setupProcessCleanup(cronTask?: ScheduledTask) {
  // 如果有定时任务，注册停止函数
  if (cronTask) {
    processManager.registerCleanup(() => {
      logger.info("正在停止定时任务...");
      cronTask.stop();
    }, "停止定时任务");
  }

  // 注册服务清理函数
  processManager.registerCleanup(cleanupFileInfo, "清理文件信息服务");
  processManager.registerCleanup(cleanupLogFiles, "清理日志文件");
  processManager.registerCleanup(cleanupFileInfoSync, "同步清理文件信息服务");

  // 初始化进程管理器
  processManager.init();
}

/**
 * 验证并获取 cron 表达式
 */
function validateCronSchedule(schedule: string): void {
  if (!cron.validate(schedule)) {
    throw new Error(
      `无效的 cron 表达式: ${schedule}\n` +
        `node-cron 使用标准 Unix cron 格式（5个字段）：分 时 日 月 星期\n` +
        `示例：\n` +
        `  "*/5 * * * *" - 每5分钟\n` +
        `  "0 * * * *"   - 每小时\n` +
        `  "0 0 * * *"   - 每天\n` +
        `请勿使用 Quartz 格式（6个字段，包含秒）`
    );
  }
}

/**
 * 创建定时任务执行函数
 */
function createCronHandler(statsService: StatsService, mainService: MainService) {
  return async () => {
    // 每次执行时获取最新配置快照
    const configSnapshot = getConfigSnapshot();
    
    // 检查 schedule 是否变更
    if (configSnapshot.CRON_SCHEDULE !== currentSchedule) {
      logger.info(
        { oldSchedule: currentSchedule, newSchedule: configSnapshot.CRON_SCHEDULE },
        "检测到 cron 表达式变更，将在下次任务后重建调度器"
      );
      currentSchedule = configSnapshot.CRON_SCHEDULE;
      // 标记需要重建，在当前任务执行完后重建
      setImmediate(() => rebuildCronTask(statsService, mainService));
    }
    
    // 检查定时任务是否启用
    if (!configSnapshot.CRON_ENABLED) {
      logger.debug("定时任务已禁用，跳过执行");
      return;
    }

    try {
      logger.info("定时任务开始执行");
      const stats = await mainService.runOnce();
      
      // 记录统计数据
      const aiCalls = stats.aiClassified > 0 ? 1 : 0;
      statsService.recordTaskStats({
        taskId: stats.taskId,
        startTime: new Date(Date.now() - stats.duration).toISOString(),
        endTime: new Date().toISOString(),
        duration: stats.duration,
        aiCalls,
        tokensUsed: stats.tokensUsed,
        filesProcessed: stats.totalProcessed,
        similarityMatched: stats.similarityMatched,
        aiClassified: stats.aiClassified,
        fileTypes: stats.fileTypes,
        status: stats.status,
        errorMessage: stats.errorMessage,
        dryRun: false,
      });
      
      logger.info("定时任务执行完成");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "定时任务执行失败"
      );
    }
  };
}

/**
 * 重建 cron 调度器（schedule 变更时调用）
 */
function rebuildCronTask(statsService: StatsService, mainService: MainService) {
  if (cronTask) {
    logger.info("停止旧的定时任务调度器");
    cronTask.stop();
    cronTask = null;
  }

  // 验证新的 cron 表达式
  try {
    validateCronSchedule(currentSchedule);
  } catch (error) {
    logger.error(
      { schedule: currentSchedule, error: error instanceof Error ? error.message : String(error) },
      "新的 cron 表达式无效，保持旧调度器"
    );
    return;
  }

  // 创建新的调度器
  logger.info({ schedule: currentSchedule, timezone: process.env.TZ }, "创建新的定时任务调度器");
  
  cronTask = cron.schedule(
    currentSchedule,
    createCronHandler(statsService, mainService),
    { timezone: process.env.TZ }
  );
  
  logger.info("定时任务调度器已重建");
}

/**
 * 启动定时任务模式
 */
async function startScheduledMode(mainService: MainService): Promise<void> {
  logger.info(`正在启动定时任务，计划表达式: ${CRON_SCHEDULE}, 时区: ${process.env.TZ}`);

  // 验证 cron 表达式
  validateCronSchedule(CRON_SCHEDULE);

  const statsService = new StatsService();

  // 创建定时任务
  cronTask = cron.schedule(
    CRON_SCHEDULE,
    createCronHandler(statsService, mainService),
    { timezone: process.env.TZ }
  );

  logger.info("定时任务已启动，等待执行...");

  // 启动HTTP服务器
  const server = await startServer(mainService);

  // 设置清理逻辑
  setupProcessCleanup(cronTask);
  
  // 注册服务器关闭清理
  processManager.registerCleanup(async () => {
    logger.info("正在关闭HTTP服务器...");
    await server.close();
  }, "关闭HTTP服务器");
}

/**
 * 应用程序入口点
 */
async function main(): Promise<void> {
  // 检查 API Key
  if (!OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY 未设置，AI 分类将无法工作");
  }

  // 创建主服务实例
  const mainService = new MainService();

  try {
    await startScheduledMode(mainService);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        mode: "scheduled",
        cronSchedule: CRON_SCHEDULE,
        timezone: process.env.TZ,
      },
      "应用启动失败"
    );

    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  logger.error({ error }, "应用启动出现未捕获错误");
  process.exit(1);
});
