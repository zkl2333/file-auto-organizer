import cron, { ScheduledTask } from "node-cron";
import { systemLogger as logger, cleanupLogFiles } from "./logger.js";
import { config } from "./config.js";
import { MainService } from "./service/main.service.js";
import { cleanupFileInfo, cleanupFileInfoSync } from "./service/file-info.service.js";
import { processManager } from "./process-manager.js";

const { OPENAI_API_KEY, CRON_SCHEDULE, RUN_ONCE } = config;

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
 * 启动定时任务模式
 */
async function startScheduledMode(mainService: MainService): Promise<void> {
  logger.info(`正在启动定时任务，计划表达式: ${CRON_SCHEDULE}, 时区: ${process.env.TZ}`);

  // 验证 cron 表达式
  validateCronSchedule(CRON_SCHEDULE);

  // 创建定时任务
  const task = cron.schedule(
    CRON_SCHEDULE,
    async () => {
      try {
        logger.info("定时任务开始执行");
        await mainService.runOnce();
        logger.info("定时任务执行完成");
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "定时任务执行失败"
        );
      }
    },
    { timezone: process.env.TZ }
  );

  logger.info("定时任务已启动，等待执行...");

  // 设置清理逻辑
  setupProcessCleanup(task);
}

/**
 * 启动单次运行模式
 */
async function startOnceMode(mainService: MainService): Promise<void> {
  logger.info("单次运行模式");

  // 设置清理逻辑（无定时任务）
  setupProcessCleanup();

  try {
    await mainService.runOnce();
    logger.info("单次运行完成");
    process.exit(0);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "单次运行失败");
    process.exit(1);
  }
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
    if (RUN_ONCE) {
      await startOnceMode(mainService);
    } else {
      await startScheduledMode(mainService);
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        mode: RUN_ONCE ? "once" : "scheduled",
        cronSchedule: CRON_SCHEDULE,
        timezone: process.env.TZ,
      },
      "应用启动失败"
    );

    // 定时任务启动失败时的降级处理
    if (!RUN_ONCE) {
      logger.info("定时任务启动失败，尝试执行一次后退出");
      try {
        await mainService.runOnce();
        process.exit(0);
      } catch (runError) {
        logger.error(
          { error: runError instanceof Error ? runError.message : String(runError) },
          "降级单次执行也失败"
        );
      }
    }

    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  logger.error({ error }, "应用启动出现未捕获错误");
  process.exit(1);
});
