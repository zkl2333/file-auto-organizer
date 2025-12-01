import cron, { ScheduledTask } from 'node-cron';
import { systemLogger as logger, cleanupLogFiles } from './logger.js';
import { config, getConfigSnapshot } from './config.js';
import { MainService } from './service/main.service.js';
import { StatsService } from './service/stats.service.js';
import { cleanupFileInfo, cleanupFileInfoSync } from './service/file-info.service.js';
import { processManager } from './process-manager.js';
import { startServer } from './server.js';

// 设置时区：优先使用配置文件，其次使用环境变量，最后使用默认值
process.env.TZ = config.TIMEZONE || process.env.TZ || 'Asia/Shanghai';

const { OPENAI_API_KEY, CRON_SCHEDULE } = config;

// 全局定时任务实例和当前调度表达式
let cronTask: ScheduledTask | null = null;
let currentSchedule: string = CRON_SCHEDULE;

/**
 * 注册所有清理函数到进程管理器
 */
function setupProcessCleanup(cronTask?: ScheduledTask) {
  if (cronTask) {
    processManager.registerCleanup(() => {
      cronTask.stop();
    }, '停止定时任务');
  }

  processManager.registerCleanup(cleanupFileInfo, '清理文件信息服务');
  processManager.registerCleanup(cleanupLogFiles, '清理日志文件');
  processManager.registerCleanup(cleanupFileInfoSync, '同步清理文件信息服务');
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
    const configSnapshot = getConfigSnapshot();

    if (configSnapshot.CRON_SCHEDULE !== currentSchedule) {
      logger.info(
        { old: currentSchedule, new: configSnapshot.CRON_SCHEDULE },
        '检测到 cron 表达式变更'
      );
      currentSchedule = configSnapshot.CRON_SCHEDULE;
      setImmediate(() => rebuildCronTask(statsService, mainService));
    }

    if (!configSnapshot.CRON_ENABLED) {
      return;
    }

    try {
      const stats = await mainService.runOnce();

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
    } catch (error) {
      logger.error({ err: error }, '定时任务执行失败');
    }
  };
}

/**
 * 重建 cron 调度器（schedule 变更时调用）
 */
function rebuildCronTask(statsService: StatsService, mainService: MainService) {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  try {
    validateCronSchedule(currentSchedule);
  } catch (error) {
    logger.error({ schedule: currentSchedule, err: error }, '新的 cron 表达式无效');
    return;
  }

  cronTask = cron.schedule(currentSchedule, createCronHandler(statsService, mainService), {
    timezone: process.env.TZ,
  });

  logger.info({ schedule: currentSchedule, tz: process.env.TZ }, '定时任务调度器已重建');
}

/**
 * 启动定时任务模式
 */
async function startScheduledMode(mainService: MainService): Promise<void> {
  validateCronSchedule(CRON_SCHEDULE);

  const statsService = new StatsService();

  cronTask = cron.schedule(CRON_SCHEDULE, createCronHandler(statsService, mainService), {
    timezone: process.env.TZ,
  });

  logger.info({ schedule: CRON_SCHEDULE, tz: process.env.TZ }, '定时任务已启动');

  const server = await startServer(mainService);

  setupProcessCleanup(cronTask);

  processManager.registerCleanup(async () => {
    await server.close();
  }, '关闭 HTTP 服务器');
}

/**
 * 应用程序入口点
 */
async function main(): Promise<void> {
  if (!OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY 未设置');
  }

  const mainService = new MainService();

  try {
    await startScheduledMode(mainService);
  } catch (error) {
    logger.error({ err: error, schedule: CRON_SCHEDULE }, '应用启动失败');
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error({ err: error }, '应用启动出现未捕获错误');
  process.exit(1);
});
