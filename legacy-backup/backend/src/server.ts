import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { config, CONFIG_BASE_DIR, findConfigFile, getConfigSnapshot } from './config.js';
import { MainService } from './service/main.service.js';
import { FileScanService } from './service/file-scan.service.js';
import { StatsService, TaskStatsRecord } from './service/stats.service.js';
import { LogModule, GLOBAL_LOG_PATHS, getTaskLogPath } from './logger.js';
import { systemLogger as logger } from './logger.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

let mainServiceInstance: MainService | null = null;
const statsService = new StatsService();
let lastRunTime: Date | null = null;
let lastRunStats: {
  similarityMatched: number;
  aiClassified: number;
  totalProcessed: number;
  duration: number;
} | null = null;

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
const CONFIG_FILE_PATH = path.join(CONFIG_BASE_DIR, 'config.yaml');

/**
 * 读取日志文件
 * 直接使用 LOG_PATHS，与写日志保持一致
 */
function getLogs(type: string, limit: number = 200): string[] {
  const logModule = type as LogModule;
  const logPath = GLOBAL_LOG_PATHS[logModule];

  if (!logPath || !fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    return lines.slice(-limit);
  } catch (error) {
    logger.debug({ err: error, logPath }, '读取日志文件失败');
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
      const yamlContent = fs.readFileSync(configPath, 'utf-8');
      const json = yaml.load(yamlContent);
      return {
        yaml: yamlContent,
        json,
      };
    } else {
      return {
        yaml: '',
        json: null,
      };
    }
  } catch (error) {
    logger.error({ err: error }, '读取配置失败');
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
    fs.writeFileSync(configPath, yamlContent, 'utf-8');

    return {
      success: true,
      message: '配置已保存,请重启服务使配置生效',
    };
  } catch (error) {
    logger.error({ err: error }, '更新配置失败');
    return {
      success: false,
      message: '保存配置失败',
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

    fs.writeFileSync(configPath, yamlContent, 'utf-8');

    return {
      success: true,
      message: '配置已保存，请重启服务使配置生效',
    };
  } catch (error) {
    logger.error({ err: error }, '更新配置失败');
    return {
      success: false,
      message: '保存配置失败',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 触发任务执行
 */
async function triggerTask(dryRun: boolean = false) {
  // 使用 MainService 的静态方法检查运行状态
  const runningStatus = MainService.getRunningStatus();
  if (runningStatus.isRunning) {
    return {
      success: false,
      message: `任务正在执行中（任务ID: ${runningStatus.taskId}），请稍候`,
    };
  }

  try {
    const service = mainServiceInstance || new MainService();

    // 在后台执行任务，不阻塞响应
    service
      .runOnce(dryRun)
      .then((stats) => {
        lastRunTime = new Date();
        lastRunStats = stats;

        if (stats.status !== 'failed') {
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
            dryRun: dryRun,
          });
        }
      })
      .catch((error) => {
        logger.error({ err: error }, '任务执行失败');
      });

    return {
      success: true,
      message: `任务已触发，正在后台执行${dryRun ? '(dry-run模式)' : ''}`,
    };
  } catch (error) {
    logger.error({ err: error }, '触发任务失败');
    return {
      success: false,
      message: '触发任务失败',
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
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });

  // GET /api/stats
  server.get('/api/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getStats();
      reply.send(stats);
    } catch (error) {
      logger.error({ err: error }, '获取统计信息失败');
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/status
  server.get('/api/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 获取当前配置快照
      const configSnapshot = getConfigSnapshot();

      // 获取任务运行状态
      const runningStatus = MainService.getRunningStatus();

      // 获取最近一次任务记录
      let lastTask: TaskStatsRecord | null = null;
      const tasks = statsService.getAllTaskRecords();

      // 检查是否有运行中的任务
      if (runningStatus.isRunning && runningStatus.taskId && runningStatus.startTime) {
        const existingTask = tasks.find((t) => t.taskId === runningStatus.taskId);
        const now = Date.now();

        if (existingTask) {
          // 更新运行中任务的耗时
          if (existingTask.status === 'running') {
            existingTask.duration = now - runningStatus.startTime;
          }
          lastTask = existingTask;
        } else {
          // 创建运行中的任务记录
          lastTask = {
            taskId: runningStatus.taskId,
            timestamp: new Date(runningStatus.startTime).toISOString(),
            startTime: new Date(runningStatus.startTime).toISOString(),
            endTime: '',
            duration: now - runningStatus.startTime,
            aiCalls: 0,
            tokensUsed: 0,
            filesProcessed: 0,
            similarityMatched: 0,
            aiClassified: 0,
            fileTypes: {},
            status: 'running',
            dryRun: runningStatus.dryRun,
          };
        }
      } else if (tasks.length > 0) {
        // 按时间倒序排列，取最近的一条
        tasks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        lastTask = tasks[0];
      }

      reply.send({
        isRunning: runningStatus.isRunning,
        currentTaskId: runningStatus.taskId,
        lastRunTime: lastRunTime ? lastRunTime.toISOString() : null,
        lastRunStats,
        cronEnabled: configSnapshot.CRON_ENABLED,
        lastTask,
      });
    } catch (error) {
      logger.error({ err: error }, '获取任务状态失败');
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/usage-stats
  server.get<{
    Querystring: { range?: string; includeDryRun?: string };
  }>(
    '/api/usage-stats',
    async (
      request: FastifyRequest<{ Querystring: { range?: string; includeDryRun?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const range = (request.query.range || 'all') as 'today' | 'week' | 'month' | 'all';
        const includeDryRun = request.query.includeDryRun === 'true';
        const stats = statsService.getStats(range, includeDryRun);
        reply.send(stats);
      } catch (error) {
        logger.error({ err: error }, '获取使用统计失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // GET /api/task-history - 获取所有任务历史
  server.get('/api/task-history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tasks = statsService.getAllTaskRecords();

      // 检查是否有运行中的任务，如果有则添加到列表中或更新现有记录
      const runningStatus = MainService.getRunningStatus();
      if (runningStatus.isRunning && runningStatus.taskId && runningStatus.startTime) {
        // 检查任务列表中是否已存在该任务
        const existingTaskIndex = tasks.findIndex((t) => t.taskId === runningStatus.taskId);
        const now = Date.now();

        if (existingTaskIndex === -1) {
          // 任务不在列表中，创建运行中的任务记录
          const runningTask: TaskStatsRecord = {
            taskId: runningStatus.taskId,
            timestamp: new Date(runningStatus.startTime).toISOString(),
            startTime: new Date(runningStatus.startTime).toISOString(),
            endTime: '', // 运行中任务没有结束时间
            duration: now - runningStatus.startTime,
            aiCalls: 0,
            tokensUsed: 0,
            filesProcessed: 0,
            similarityMatched: 0,
            aiClassified: 0,
            fileTypes: {},
            status: 'running',
            dryRun: runningStatus.dryRun,
          };
          tasks.push(runningTask);
        } else {
          // 任务已在列表中，更新运行中任务的耗时（如果状态还是 running）
          const existingTask = tasks[existingTaskIndex];
          if (existingTask.status === 'running') {
            existingTask.duration = now - runningStatus.startTime;
          }
        }
      }

      // 按时间倒序排列
      tasks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      reply.send({ tasks });
    } catch (error) {
      logger.error({ err: error }, '获取任务历史失败');
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/task/:taskId - 获取单个任务详情
  server.get<{
    Params: { taskId: string };
  }>(
    '/api/task/:taskId',
    async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
      try {
        const taskId = request.params.taskId;
        let task = statsService.getTaskRecord(taskId);

        // 如果从 statsService 找不到任务，检查是否有运行中的任务
        if (!task) {
          const runningStatus = MainService.getRunningStatus();
          if (
            runningStatus.isRunning &&
            runningStatus.taskId === taskId &&
            runningStatus.startTime
          ) {
            // 创建运行中的任务记录
            const now = Date.now();
            task = {
              taskId: runningStatus.taskId,
              timestamp: new Date(runningStatus.startTime).toISOString(),
              startTime: new Date(runningStatus.startTime).toISOString(),
              endTime: '',
              duration: now - runningStatus.startTime,
              aiCalls: 0,
              tokensUsed: 0,
              filesProcessed: 0,
              similarityMatched: 0,
              aiClassified: 0,
              fileTypes: {},
              status: 'running',
              dryRun: runningStatus.dryRun,
            };
          }
        } else if (task.status === 'running') {
          // 如果任务状态是 running，更新实时耗时
          const runningStatus = MainService.getRunningStatus();
          if (
            runningStatus.isRunning &&
            runningStatus.taskId === taskId &&
            runningStatus.startTime
          ) {
            const now = Date.now();
            task = {
              ...task,
              duration: now - runningStatus.startTime,
            };
          }
        }

        if (!task) {
          reply.status(404).send({
            error: 'Not Found',
            message: `任务 ${taskId} 不存在`,
          });
          return;
        }
        reply.send(task);
      } catch (error) {
        logger.error({ err: error }, '获取任务详情失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // GET /api/task/:taskId/files - 获取任务的文件列表
  server.get<{
    Params: { taskId: string };
  }>(
    '/api/task/:taskId/files',
    async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
      try {
        const taskId = request.params.taskId;

        // 检查任务是否存在（包括运行中的任务）
        const task = statsService.getTaskRecord(taskId);
        const runningStatus = MainService.getRunningStatus();
        const isRunningTask = runningStatus.isRunning && runningStatus.taskId === taskId;

        if (!task && !isRunningTask) {
          reply.status(404).send({
            error: 'Not Found',
            message: `任务 ${taskId} 不存在`,
          });
          return;
        }

        // 获取 MainService 实例并获取文件列表
        const service = mainServiceInstance || new MainService();
        const files = await service.getTaskFiles(taskId);

        reply.send({
          taskId,
          files,
          totalFiles: files.length,
        });
      } catch (error) {
        logger.error({ err: error }, '获取任务文件列表失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // DELETE /api/task/:taskId - 删除任务记录
  server.delete<{
    Params: { taskId: string };
  }>(
    '/api/task/:taskId',
    async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
      try {
        const taskId = request.params.taskId;
        const deleted = statsService.deleteTaskRecord(taskId);
        if (!deleted) {
          reply.status(404).send({
            error: 'Not Found',
            message: `任务 ${taskId} 不存在`,
          });
          return;
        }
        reply.send({
          success: true,
          message: `任务 ${taskId} 已删除`,
        });
      } catch (error) {
        logger.error({ err: error }, '删除任务失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // DELETE /api/tasks - 批量删除任务记录
  server.delete<{
    Body: { taskIds: string[] };
  }>(
    '/api/tasks',
    async (request: FastifyRequest<{ Body: { taskIds: string[] } }>, reply: FastifyReply) => {
      try {
        const { taskIds } = request.body;
        if (!Array.isArray(taskIds) || taskIds.length === 0) {
          reply.status(400).send({
            error: 'Bad Request',
            message: 'taskIds 必须是非空数组',
          });
          return;
        }

        const result = statsService.deleteTaskRecords(taskIds);
        reply.send({
          success: true,
          message: `已删除 ${result.deleted.length} 条记录`,
          deleted: result.deleted,
          notFound: result.notFound,
        });
      } catch (error) {
        logger.error({ err: error }, '批量删除任务失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // GET /api/logs - 获取系统日志
  server.get<{
    Querystring: { type?: string; limit?: string };
  }>(
    '/api/logs',
    async (
      request: FastifyRequest<{ Querystring: { type?: string; limit?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const type = request.query.type || 'system';
        const limit = parseInt(request.query.limit || '200');
        const logs = getLogs(type, limit);
        reply.send({ logs });
      } catch (error) {
        logger.error({ err: error }, '读取日志失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // GET /api/task/:taskId/logs - 获取任务级日志
  server.get<{
    Params: { taskId: string };
    Querystring: { type?: string; limit?: string };
  }>(
    '/api/task/:taskId/logs',
    async (
      request: FastifyRequest<{
        Params: { taskId: string };
        Querystring: { type?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const taskId = request.params.taskId;
        const type = request.query.type || 'main';
        const limit = parseInt(request.query.limit || '200');

        // 检查任务是否存在（包括运行中的任务）
        const task = statsService.getTaskRecord(taskId);
        const runningStatus = MainService.getRunningStatus();
        const isRunningTask = runningStatus.isRunning && runningStatus.taskId === taskId;

        if (!task && !isRunningTask) {
          reply.status(404).send({
            error: 'Not Found',
            message: `任务 ${taskId} 不存在`,
          });
          return;
        }

        // 获取任务日志文件路径
        const logPath = getTaskLogPath(type as LogModule, taskId);

        if (!fs.existsSync(logPath)) {
          reply.send({ logs: [] });
          return;
        }

        // 读取日志文件
        const content = fs.readFileSync(logPath, 'utf-8');
        const allLines = content.split('\n').filter((line) => line.trim());
        const logs = allLines.slice(-limit);

        reply.send({ logs });
      } catch (error) {
        logger.error({ err: error }, '获取任务日志失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // POST /api/trigger
  server.post<{
    Querystring: { dryRun?: string };
  }>(
    '/api/trigger',
    async (request: FastifyRequest<{ Querystring: { dryRun?: string } }>, reply: FastifyReply) => {
      try {
        const dryRun = request.query.dryRun === 'true';
        const result = await triggerTask(dryRun);
        reply.send(result);
      } catch (error) {
        logger.error({ err: error }, '触发任务失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // POST /api/cron/toggle - 切换定时任务开关
  server.post<{
    Body: { enabled: boolean };
  }>(
    '/api/cron/toggle',
    async (request: FastifyRequest<{ Body: { enabled: boolean } }>, reply: FastifyReply) => {
      try {
        const { enabled } = request.body;
        if (typeof enabled !== 'boolean') {
          reply.status(400).send({
            error: 'Bad Request',
            message: 'enabled 参数必须为布尔值',
          });
          return;
        }

        // 直接修改配置文件，下次任务执行时自动生效
        const configPath = findConfigFile();
        if (!configPath || !fs.existsSync(configPath)) {
          reply.status(404).send({
            error: 'Not Found',
            message: '配置文件不存在',
          });
          return;
        }

        const yamlContent = fs.readFileSync(configPath, 'utf-8');
        const configJson = yaml.load(yamlContent) as Record<string, any>;

        if (!configJson.cron) {
          configJson.cron = {};
        }
        configJson.cron.enabled = enabled;

        const updatedYaml = yaml.dump(configJson, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
        });

        fs.writeFileSync(configPath, updatedYaml, 'utf-8');
        logger.info({ enabled }, '定时任务开关已更新');

        reply.send({
          success: true,
          message: enabled
            ? '定时任务已启用，将在下次执行时生效'
            : '定时任务已禁用，将在下次执行时生效',
          enabled,
        });
      } catch (error) {
        logger.error({ err: error }, '切换定时任务开关失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // GET /api/config
  server.get('/api/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const configData = getConfig();
      reply.send(configData);
    } catch (error) {
      logger.error({ err: error }, '读取配置失败');
      reply.status(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // PUT /api/config (YAML格式)
  server.put<{
    Body: string;
  }>(
    '/api/config',
    {
      config: {
        rawBody: true,
      },
    },
    async (request: FastifyRequest<{ Body: string }>, reply: FastifyReply) => {
      try {
        const yamlContent = typeof request.body === 'string' ? request.body : String(request.body);
        const result = updateConfigYaml(yamlContent);
        reply.send(result);
      } catch (error) {
        logger.error({ err: error }, '更新配置失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // PATCH /api/config (JSON格式)
  server.patch<{
    Body: Record<string, any>;
  }>(
    '/api/config',
    async (request: FastifyRequest<{ Body: Record<string, any> }>, reply: FastifyReply) => {
      try {
        const result = updateConfigJson(request.body);
        reply.send(result);
      } catch (error) {
        logger.error({ err: error }, '更新配置失败');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // GET /api/files - 文件浏览
  server.get<{
    Querystring: { path?: string; base?: string };
  }>(
    '/api/files',
    async (
      request: FastifyRequest<{ Querystring: { path?: string; base?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const baseDir = request.query.base === 'incoming' ? config.INCOMING_DIR : config.ROOT_DIR;
        const targetPath = request.query.path || '';

        // 安全检查：防止路径遍历攻击
        const safePath = path.normalize(targetPath).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.join(baseDir, safePath);

        // 确保路径在 baseDir 内
        if (!fullPath.startsWith(path.resolve(baseDir))) {
          reply.status(403).send({
            error: 'Forbidden',
            message: '访问路径超出允许范围',
          });
          return;
        }

        if (!fs.existsSync(fullPath)) {
          reply.status(404).send({
            error: 'Not Found',
            message: '路径不存在',
          });
          return;
        }

        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          reply.send({
            type: 'file',
            name: path.basename(fullPath),
            path: targetPath,
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        } else {
          const entries = fs.readdirSync(fullPath);
          const items = entries.map((entry) => {
            const entryPath = path.join(fullPath, entry);
            const entryStat = fs.statSync(entryPath);
            const relPath = path.join(targetPath, entry).replace(/\\/g, '/');

            return {
              name: entry,
              path: relPath,
              type: entryStat.isDirectory() ? 'directory' : 'file',
              size: entryStat.isFile() ? entryStat.size : null,
              modified: entryStat.mtime.toISOString(),
            };
          });

          reply.send({
            type: 'directory',
            path: targetPath,
            items: items.sort((a, b) => {
              // 目录在前，然后按名称排序
              if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            }),
          });
        }
      } catch (error) {
        logger.error({ err: error }, 'GET /api/files failed');
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // 启动服务器
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    logger.info({ port: PORT }, 'HTTP 服务器已启动');
  } catch (error) {
    logger.error({ err: error }, '启动 HTTP 服务器失败');
    throw error;
  }

  return server;
}
