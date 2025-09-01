import cron from "node-cron";
import { logger } from "./logger.js";
import { config } from "./config.js";
import { MainService } from "./service/main.service.js";

const { OPENAI_API_KEY, CRON_SCHEDULE, RUN_ONCE } = config;

if (!OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY 未设置，AI 分类将无法工作");
}

// 创建主服务实例
const mainService = new MainService();

if (RUN_ONCE) {
  mainService
    .runOnce()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  // 设置环境变量避免时区问题
  process.env.TZ = process.env.TZ || "Asia/Shanghai";

  try {
    logger.info(`正在启动定时任务，计划表达式: ${CRON_SCHEDULE}, 时区: ${process.env.TZ}`);

    // 验证 cron 表达式
    if (!cron.validate(CRON_SCHEDULE)) {
      throw new Error(
        `无效的 cron 表达式: ${CRON_SCHEDULE}\n` +
          `node-cron 使用标准 Unix cron 格式（5个字段）：分 时 日 月 星期\n` +
          `示例：\n` +
          `  "*/5 * * * *" - 每5分钟\n` +
          `  "0 * * * *"   - 每小时\n` +
          `  "0 0 * * *"   - 每天\n` +
          `请勿使用 Quartz 格式（6个字段，包含秒）`
      );
    }

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
      {
        timezone: process.env.TZ,
      }
    );

    logger.info("定时任务已启动，等待执行...");

    // 添加进程退出处理
    process.on("SIGINT", () => {
      logger.info("收到 SIGINT 信号，正在停止定时任务...");
      task.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger.info("收到 SIGTERM 信号，正在停止定时任务...");
      task.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        cronSchedule: CRON_SCHEDULE,
        timezone: process.env.TZ,
      },
      "定时任务启动失败"
    );

    // 如果定时任务启动失败，尝试运行一次后退出
    logger.info("定时任务启动失败，尝试执行一次后退出");
    try {
      await mainService.runOnce();
      process.exit(0);
    } catch (runError) {
      logger.error(
        { error: runError instanceof Error ? runError.message : String(runError) },
        "单次执行也失败"
      );
      process.exit(1);
    }
  }
}
