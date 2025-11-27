import { systemLogger } from "./logger.js";

type CleanupFunction = () => void | Promise<void>;

/**
 * 进程退出管理器 - 统一处理所有进程退出逻辑
 */
class ProcessManager {
  private cleanupFunctions: CleanupFunction[] = [];
  private isShuttingDown = false;
  
  /**
   * 注册清理函数
   */
  registerCleanup(fn: CleanupFunction, description?: string) {
    this.cleanupFunctions.push(fn);
    if (description) {
      systemLogger.debug(`注册清理函数: ${description}`);
    }
  }

  /**
   * 执行所有清理函数
   */
  private async executeCleanup(signal?: string) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    systemLogger.info(`开始清理进程 ${signal ? `(信号: ${signal})` : ''}`);
    
    const errors: Error[] = [];
    
    // 按注册顺序执行清理函数
    for (let i = 0; i < this.cleanupFunctions.length; i++) {
      try {
        const cleanup = this.cleanupFunctions[i];
        systemLogger.debug(`执行清理函数 ${i + 1}/${this.cleanupFunctions.length}`);
        await cleanup();
      } catch (error) {
        systemLogger.error({ error, index: i + 1 }, `清理函数 ${i + 1} 执行失败`);
        errors.push(error as Error);
      }
    }

    if (errors.length > 0) {
      systemLogger.error(`清理过程中发生 ${errors.length} 个错误`);
    } else {
      systemLogger.info("进程清理完成");
    }
  }

  /**
   * 优雅关闭
   */
  private async gracefulShutdown(signal: string) {
    systemLogger.info(`收到 ${signal} 信号，开始优雅关闭...`);
    await this.executeCleanup(signal);
    process.exit(0);
  }

  /**
   * 初始化进程事件监听
   */
  init() {
    // 处理优雅关闭信号
    process.on("SIGINT", () => this.gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => this.gracefulShutdown("SIGTERM"));
    
    // 处理进程退出前的清理
    process.on("beforeExit", () => this.executeCleanup());
    
    // 处理未捕获的异常
    process.on("uncaughtException", async (error) => {
      systemLogger.error({ error }, "未捕获的异常");
      await this.executeCleanup("uncaughtException");
      process.exit(1);
    });

    // 处理未处理的 Promise 拒绝
    process.on("unhandledRejection", async (reason, promise) => {
      systemLogger.error({ reason }, "未处理的 Promise 拒绝");
      await this.executeCleanup("unhandledRejection");
      process.exit(1);
    });

    systemLogger.info("进程管理器已初始化");
  }
}

export const processManager = new ProcessManager();
