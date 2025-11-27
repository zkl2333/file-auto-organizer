import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { config, CONFIG_BASE_DIR, findConfigFile } from "./config.js";
import { MainService } from "./service/main.service.js";
import { FileScanService } from "./service/file-scan.service.js";
import { LoggerType, LOG_PATHS } from "./logger.js";
import { systemLogger as logger } from "./logger.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

let mainServiceInstance: MainService | null = null;
let isRunning = false;

/**
 * 获取统计信息
 */
async function getStats() {
  const fileScanService = new FileScanService();
  const rootDir = config.ROOT_DIR;
  const incomingDir = config.INCOMING_DIR;

  const rootDirExists = fs.existsSync(rootDir);
  const incomingDirExists = fs.existsSync(incomingDir);

  let totalInRoot = 0;
  let categories = 0;

  if (rootDirExists) {
    const files = fileScanService.scanFiles(rootDir);
    totalInRoot = files.length;
    const dirs = fileScanService.scanDirs(rootDir);
    categories = dirs.length;
  }

  const totalInIncoming = incomingDirExists
    ? fileScanService.getIncomingFiles(incomingDir).length
    : 0;

  return {
    directories: {
      rootDir,
      incomingDir,
      rootDirExists,
      incomingDirExists,
    },
    files: {
      totalInRoot,
      totalInIncoming,
      categories,
    },
    config: {
      cronSchedule: config.CRON_SCHEDULE,
      logLevel: config.LOG_LEVEL,
      similarityThreshold: config.SIMILARITY_THRESHOLD,
      aiBatchSize: config.AI_BATCH_SIZE,
    },
  };
}

// 配置文件路径
const CONFIG_FILE_PATH = path.join(CONFIG_BASE_DIR, "config.yaml");

/**
 * 读取日志文件
 * 直接使用 LOG_PATHS，与写日志保持一致
 */
function getLogs(type: string, limit: number = 200): string[] {
  const logType = type as LoggerType;
  const logPath = LOG_PATHS[logType];

  if (!logPath || !fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    return lines.slice(-limit);
  } catch (error) {
    logger.error({ error, logPath }, "读取日志文件失败");
    return [];
  }
}

/**
 * 获取配置文件内容
 */
function getConfig() {
  const configPath = findConfigFile();

  try {
    if (configPath && fs.existsSync(configPath)) {
      const yamlContent = fs.readFileSync(configPath, "utf-8");
      const json = yaml.load(yamlContent);
      return {
        yaml: yamlContent,
        json,
      };
    } else {
      return {
        yaml: "",
        json: null,
      };
    }
  } catch (error) {
    logger.error({ error, configPath }, "读取配置文件失败");
    throw error;
  }
}

/**
 * 更新配置文件 (YAML 格式)
 */
function updateConfigYaml(yamlContent: string) {
  const configPath = findConfigFile() || CONFIG_FILE_PATH;

  try {
    // 验证YAML格式
    yaml.load(yamlContent);
    
    // 写入文件
    fs.writeFileSync(configPath, yamlContent, "utf-8");
    
    return {
      success: true,
      message: "配置已保存,请重启服务使配置生效",
    };
  } catch (error) {
    logger.error({ error }, "更新配置文件失败");
    return {
      success: false,
      message: "保存配置失败",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 更新配置文件 (JSON 格式)
 */
function updateConfigJson(configJson: Record<string, any>) {
  const configPath = findConfigFile() || CONFIG_FILE_PATH;

  try {
    // 转换为 YAML 格式并写入
    const yamlContent = yaml.dump(configJson, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    
    fs.writeFileSync(configPath, yamlContent, "utf-8");
    
    return {
      success: true,
      message: "配置已保存，请重启服务使配置生效",
    };
  } catch (error) {
    logger.error({ error }, "更新配置文件失败");
    return {
      success: false,
      message: "保存配置失败",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 触发任务执行
 */
async function triggerTask(dryRun: boolean = false) {
  if (isRunning) {
    return {
      success: false,
      message: "任务正在执行中，请稍候",
    };
  }

  try {
    isRunning = true;
    
    const service = mainServiceInstance || new MainService();

    // 在后台执行任务，不阻塞响应
    service.runOnce(dryRun)
      .then(() => {
        isRunning = false;
        logger.info(`手动触发的任务执行完成${dryRun ? "(dry-run)" : ""}`);
      })
      .catch((error) => {
        isRunning = false;
        logger.error({ error }, "触发任务执行失败");
      });

    return {
      success: true,
      message: `任务已触发，正在后台执行${dryRun ? "(dry-run模式)" : ""}`,
    };
  } catch (error) {
    isRunning = false;
    logger.error({ error }, "触发任务失败");
    return {
      success: false,
      message: "触发任务失败",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 启动HTTP服务器 (使用 Fastify)
 */
export async function startServer(mainService?: MainService) {
  if (mainService) {
    mainServiceInstance = mainService;
  }

  const server = Fastify({
    logger: false, // 使用自定义 pino logger
  });

  // 注册 CORS
  await server.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });

  // GET /api/stats
  server.get("/api/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getStats();
      reply.send(stats);
    } catch (error) {
      logger.error({ error }, "获取统计信息失败");
      reply.status(500).send({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/logs
  server.get<{
    Querystring: { type?: string; limit?: string };
  }>(
    "/api/logs",
    async (request: FastifyRequest<{ Querystring: { type?: string; limit?: string } }>, reply: FastifyReply) => {
      try {
        const type = request.query.type || "system";
        const limit = parseInt(request.query.limit || "200");
        const logs = getLogs(type, limit);
        reply.send({ logs });
      } catch (error) {
        logger.error({ error }, "读取日志失败");
        reply.status(500).send({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // POST /api/trigger
  server.post<{
    Querystring: { dryRun?: string };
  }>(
    "/api/trigger",
    async (request: FastifyRequest<{ Querystring: { dryRun?: string } }>, reply: FastifyReply) => {
      try {
        const dryRun = request.query.dryRun === "true";
        const result = await triggerTask(dryRun);
        reply.send(result);
      } catch (error) {
        logger.error({ error }, "触发任务失败");
        reply.status(500).send({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // GET /api/config
  server.get("/api/config", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const configData = getConfig();
      reply.send(configData);
    } catch (error) {
      logger.error({ error }, "读取配置失败");
      reply.status(500).send({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // PUT /api/config (YAML格式)
  server.put<{
    Body: string;
  }>(
    "/api/config",
    {
      config: {
        rawBody: true,
      },
    },
    async (request: FastifyRequest<{ Body: string }>, reply: FastifyReply) => {
      try {
        const yamlContent =
          typeof request.body === "string"
            ? request.body
            : String(request.body);
        const result = updateConfigYaml(yamlContent);
        reply.send(result);
      } catch (error) {
        logger.error({ error }, "更新配置失败");
        reply.status(500).send({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // PATCH /api/config (JSON格式)
  server.patch<{
    Body: Record<string, any>;
  }>("/api/config", async (request: FastifyRequest<{ Body: Record<string, any> }>, reply: FastifyReply) => {
    try {
      const result = updateConfigJson(request.body);
      reply.send(result);
    } catch (error) {
      logger.error({ error }, "更新配置失败");
      reply.status(500).send({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // 启动服务器
  try {
    await server.listen({ port: PORT, host: "0.0.0.0" });
    logger.info({ port: PORT }, "HTTP服务器已启动");
  } catch (error) {
    logger.error({ error }, "启动HTTP服务器失败");
    throw error;
  }

  return server;
}
