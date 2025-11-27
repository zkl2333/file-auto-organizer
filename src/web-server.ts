import { serve } from "bun";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { config } from "./config.js";
import { MainService } from "./service/main.service.js";
import { FileScanService } from "./service/file-scan.service.js";
import { systemLogger } from "./logger.js";
import { LoggerType } from "./logger.js";

interface WebServerOptions {
  port?: number;
}

export class WebServer {
  private port: number;
  private mainService: MainService;
  private fileScanService: FileScanService;
  private isRunning: boolean = false;

  constructor(options: WebServerOptions = {}) {
    this.port = options.port || 3000;
    this.mainService = new MainService();
    this.fileScanService = new FileScanService();
  }

  /**
   * 启动Web服务器
   */
  start(): void {
    if (this.isRunning) {
      systemLogger.warn("Web服务器已在运行");
      return;
    }

    const server = serve({
      port: this.port,
      fetch: this.handleRequest.bind(this),
    });

    this.isRunning = true;
    systemLogger.info(`Web管理界面已启动: http://localhost:${this.port}`);
  }

  /**
   * 处理HTTP请求
   */
  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 处理OPTIONS请求
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // 静态文件服务
      if (pathname === "/" || pathname === "/index.html") {
        return this.serveStaticFile("index.html", corsHeaders);
      }

      if (pathname.startsWith("/static/")) {
        const filePath = pathname.substring(8);
        return this.serveStaticFile(filePath, corsHeaders);
      }

      // API路由
      if (pathname.startsWith("/api/")) {
        return await this.handleAPI(pathname, req, corsHeaders);
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (error) {
      systemLogger.error({ error }, "Web服务器处理请求失败");
      return new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  /**
   * 处理API请求
   */
  private async handleAPI(
    pathname: string,
    req: Request,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    const jsonHeaders = {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    };

    // 日志查看
    if (pathname === "/api/logs") {
      const type = new URL(req.url).searchParams.get("type") || "system";
      const limit = parseInt(new URL(req.url).searchParams.get("limit") || "100");
      const logs = await this.getLogs(type as LoggerType, limit);
      return new Response(JSON.stringify(logs), { headers: jsonHeaders });
    }

    // 统计信息
    if (pathname === "/api/stats") {
      const stats = await this.getStats();
      return new Response(JSON.stringify(stats), { headers: jsonHeaders });
    }

    // 手动触发任务
    if (pathname === "/api/trigger" && req.method === "POST") {
      const result = await this.triggerTask();
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    // 获取配置
    if (pathname === "/api/config" && req.method === "GET") {
      const configData = await this.getConfig();
      return new Response(JSON.stringify(configData), { headers: jsonHeaders });
    }

    // 更新配置
    if (pathname === "/api/config" && req.method === "PUT") {
      const body = await req.text();
      const result = await this.updateConfig(body);
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: jsonHeaders,
    });
  }

  /**
   * 获取日志
   */
  private async getLogs(type: LoggerType, limit: number): Promise<{
    logs: string[];
    type: string;
    total: number;
  }> {
    const logPaths: Record<string, string> = {
      system: path.join(config.LOG_DIR, "system.log"),
      main: path.join(config.LOG_DIR, "main.log"),
      ai: path.join(config.LOG_DIR, "ai.log"),
      "file-move": path.join(config.LOG_DIR, "file-move.log"),
      "file-scan": path.join(config.LOG_DIR, "file-scan.log"),
      "file-info": path.join(config.LOG_DIR, "file-info.log"),
    };

    const logPath = logPaths[type] || logPaths.system;

    try {
      if (!fs.existsSync(logPath)) {
        return { logs: [], type, total: 0 };
      }

      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());
      const recentLines = lines.slice(-limit).reverse();

      return {
        logs: recentLines,
        type,
        total: lines.length,
      };
    } catch (error) {
      systemLogger.error({ error, logPath }, "读取日志文件失败");
      return { logs: [], type, total: 0 };
    }
  }

  /**
   * 获取统计信息
   */
  private async getStats(): Promise<{
    directories: {
      rootDir: string;
      incomingDir: string;
      rootDirExists: boolean;
      incomingDirExists: boolean;
    };
    files: {
      totalInRoot: number;
      totalInIncoming: number;
      categories: number;
    };
    config: {
      cronSchedule: string;
      logLevel: string;
      similarityThreshold: number;
      aiBatchSize: number;
    };
  }> {
    const rootDir = config.ROOT_DIR;
    const incomingDir = config.INCOMING_DIR;

    const rootDirExists = fs.existsSync(rootDir);
    const incomingDirExists = fs.existsSync(incomingDir);

    let totalInRoot = 0;
    let totalInIncoming = 0;
    let categories = 0;

    if (rootDirExists) {
      const files = this.fileScanService.scanFiles(rootDir);
      const dirs = this.fileScanService.scanDirs(rootDir);
      totalInRoot = files.length;
      categories = dirs.length;
    }

    if (incomingDirExists) {
      const files = this.fileScanService.getIncomingFiles(incomingDir);
      totalInIncoming = files.length;
    }

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

  /**
   * 手动触发任务
   */
  private async triggerTask(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      systemLogger.info("通过Web界面手动触发任务");
      await this.mainService.runOnce();
      return {
        success: true,
        message: "任务执行成功",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      systemLogger.error({ error: errorMessage }, "手动触发任务失败");
      return {
        success: false,
        message: "任务执行失败",
        error: errorMessage,
      };
    }
  }

  /**
   * 获取配置（返回YAML字符串）
   */
  private async getConfig(): Promise<{ yaml: string; json: any } | null> {
    const configPath = path.resolve(process.cwd(), "config.yaml");
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const json = yaml.load(content);
        return { yaml: content, json };
      }
      return null;
    } catch (error) {
      systemLogger.error({ error }, "读取配置文件失败");
      throw error;
    }
  }

  /**
   * 更新配置
   */
  private async updateConfig(yamlContent: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    const configPath = path.resolve(process.cwd(), "config.yaml");
    try {
      // 验证YAML格式
      yaml.load(yamlContent);
      
      // 保存配置文件
      fs.writeFileSync(configPath, yamlContent, "utf-8");
      systemLogger.info("配置文件已更新");
      return {
        success: true,
        message: "配置更新成功，需要重启服务才能生效",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      systemLogger.error({ error: errorMessage }, "更新配置文件失败");
      return {
        success: false,
        message: "配置更新失败",
        error: errorMessage,
      };
    }
  }

  /**
   * 提供静态文件
   */
  private serveStaticFile(
    filePath: string,
    corsHeaders: Record<string, string>
  ): Response {
    // 如果是index.html，返回内嵌的HTML
    if (filePath === "index.html") {
      const html = this.getIndexHTML();
      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // 其他静态文件（CSS、JS等）可以在这里处理
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }

  /**
   * 获取前端HTML
   */
  private getIndexHTML(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件自动整理 - 管理界面</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
    }
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      background: white;
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .tab {
      padding: 10px 20px;
      cursor: pointer;
      border: none;
      background: #e0e0e0;
      border-radius: 4px;
      font-size: 14px;
      transition: all 0.3s;
    }
    .tab.active {
      background: #3498db;
      color: white;
    }
    .tab:hover {
      background: #2980b9;
      color: white;
    }
    .content {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      min-height: 400px;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #3498db;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s;
    }
    .btn-primary {
      background: #3498db;
      color: white;
    }
    .btn-primary:hover {
      background: #2980b9;
    }
    .btn-success {
      background: #27ae60;
      color: white;
    }
    .btn-success:hover {
      background: #229954;
    }
    .log-viewer {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      max-height: 600px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .log-line {
      margin-bottom: 2px;
      line-height: 1.4;
    }
    .log-selector {
      margin-bottom: 15px;
    }
    .log-selector select {
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ddd;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #555;
    }
    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .form-group textarea {
      min-height: 100px;
      font-family: monospace;
    }
    .alert {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .alert-success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .alert-error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .alert-info {
      background: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }
    .config-editor {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #ddd;
    }
    .config-editor textarea {
      width: 100%;
      min-height: 400px;
      font-family: monospace;
      font-size: 12px;
    }
    .loading {
      text-align: center;
      padding: 20px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📁 文件自动整理 - 管理界面</h1>
      <p>查看日志、统计数据、手动触发任务和配置管理</p>
    </header>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('stats')">统计信息</button>
      <button class="tab" onclick="switchTab('logs')">日志查看</button>
      <button class="tab" onclick="switchTab('trigger')">手动触发</button>
      <button class="tab" onclick="switchTab('config')">配置管理</button>
    </div>

    <div class="content">
      <!-- 统计信息 -->
      <div id="stats" class="tab-content active">
        <h2>统计信息</h2>
        <div id="statsContent" class="loading">加载中...</div>
      </div>

      <!-- 日志查看 -->
      <div id="logs" class="tab-content">
        <h2>日志查看</h2>
        <div class="log-selector">
          <select id="logType" onchange="loadLogs()">
            <option value="system">系统日志</option>
            <option value="main">主服务日志</option>
            <option value="ai">AI分类日志</option>
            <option value="file-move">文件移动日志</option>
            <option value="file-scan">文件扫描日志</option>
            <option value="file-info">文件信息日志</option>
          </select>
        </div>
        <div id="logContent" class="log-viewer">加载中...</div>
      </div>

      <!-- 手动触发 -->
      <div id="trigger" class="tab-content">
        <h2>手动触发任务</h2>
        <div id="triggerContent">
          <p>点击下方按钮手动触发一次文件整理任务。</p>
          <button class="btn btn-primary" onclick="triggerTask()" style="margin-top: 15px;">
            执行任务
          </button>
          <div id="triggerResult" style="margin-top: 15px;"></div>
        </div>
      </div>

      <!-- 配置管理 -->
      <div id="config" class="tab-content">
        <h2>配置管理</h2>
        <div id="configContent" class="loading">加载中...</div>
      </div>
    </div>
  </div>

  <script>
    // 切换标签页
    function switchTab(tabName) {
      // 隐藏所有内容
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
      
      // 显示选中的内容
      document.getElementById(tabName).classList.add('active');
      event.target.classList.add('active');
      
      // 加载对应数据
      if (tabName === 'stats') {
        loadStats();
      } else if (tabName === 'logs') {
        loadLogs();
      } else if (tabName === 'config') {
        loadConfig();
      }
    }

    // 加载统计信息
    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        const html = \`
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">分类库文件数</div>
              <div class="stat-value">\${data.files.totalInRoot}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">待分类文件数</div>
              <div class="stat-value">\${data.files.totalInIncoming}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">分类目录数</div>
              <div class="stat-value">\${data.files.categories}</div>
            </div>
          </div>
          <h3>目录信息</h3>
          <div class="form-group">
            <label>分类库目录:</label>
            <input type="text" value="\${data.directories.rootDir}" readonly>
            <small style="color: \${data.directories.rootDirExists ? '#27ae60' : '#e74c3c'};">
              \${data.directories.rootDirExists ? '✓ 存在' : '✗ 不存在'}
            </small>
          </div>
          <div class="form-group">
            <label>待分类目录:</label>
            <input type="text" value="\${data.directories.incomingDir}" readonly>
            <small style="color: \${data.directories.incomingDirExists ? '#27ae60' : '#e74c3c'};">
              \${data.directories.incomingDirExists ? '✓ 存在' : '✗ 不存在'}
            </small>
          </div>
          <h3>配置信息</h3>
          <div class="form-group">
            <label>定时任务:</label>
            <input type="text" value="\${data.config.cronSchedule}" readonly>
          </div>
          <div class="form-group">
            <label>日志级别:</label>
            <input type="text" value="\${data.config.logLevel}" readonly>
          </div>
          <div class="form-group">
            <label>相似度阈值:</label>
            <input type="text" value="\${data.config.similarityThreshold}" readonly>
          </div>
          <div class="form-group">
            <label>AI批次大小:</label>
            <input type="text" value="\${data.config.aiBatchSize}" readonly>
          </div>
        \`;
        
        document.getElementById('statsContent').innerHTML = html;
      } catch (error) {
        document.getElementById('statsContent').innerHTML = 
          '<div class="alert alert-error">加载失败: ' + error.message + '</div>';
      }
    }

    // 加载日志
    async function loadLogs() {
      const type = document.getElementById('logType').value;
      try {
        const res = await fetch(\`/api/logs?type=\${type}&limit=200\`);
        const data = await res.json();
        
        if (data.logs.length === 0) {
          document.getElementById('logContent').textContent = '暂无日志';
          return;
        }
        
        const logHtml = data.logs.map(log => {
          try {
            const logObj = JSON.parse(log);
            const time = logObj.time || '';
            const level = logObj.level || '';
            const msg = logObj.msg || '';
            const levelColor = level === 30 ? '#3498db' : level === 40 ? '#f39c12' : level === 50 ? '#e74c3c' : '#95a5a6';
            return \`<div class="log-line" style="color: \${levelColor};">[\${time}] [\${level}] \${msg}</div>\`;
          } catch {
            return \`<div class="log-line">\${log}</div>\`;
          }
        }).join('');
        
        document.getElementById('logContent').innerHTML = logHtml;
        document.getElementById('logContent').scrollTop = 0;
      } catch (error) {
        document.getElementById('logContent').textContent = '加载失败: ' + error.message;
      }
    }

    // 手动触发任务
    async function triggerTask() {
      const btn = event.target;
      const resultDiv = document.getElementById('triggerResult');
      
      btn.disabled = true;
      btn.textContent = '执行中...';
      resultDiv.innerHTML = '<div class="alert alert-info">任务执行中，请稍候...</div>';
      
      try {
        const res = await fetch('/api/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        
        if (data.success) {
          resultDiv.innerHTML = '<div class="alert alert-success">' + data.message + '</div>';
        } else {
          resultDiv.innerHTML = '<div class="alert alert-error">' + data.message + (data.error ? ': ' + data.error : '') + '</div>';
        }
      } catch (error) {
        resultDiv.innerHTML = '<div class="alert alert-error">请求失败: ' + error.message + '</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = '执行任务';
      }
    }

    // 加载配置
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        const configData = await res.json();
        
        if (!configData || !configData.yaml) {
          document.getElementById('configContent').innerHTML = 
            '<div class="alert alert-error">配置文件不存在</div>';
          return;
        }
        
        const html = \`
          <div class="alert alert-info">
            修改配置后需要重启服务才能生效
          </div>
          <div class="config-editor">
            <textarea id="configEditor" spellcheck="false">\${configData.yaml}</textarea>
          </div>
          <button class="btn btn-success" onclick="saveConfig()" style="margin-top: 15px;">
            保存配置
          </button>
          <div id="configResult" style="margin-top: 15px;"></div>
        \`;
        
        document.getElementById('configContent').innerHTML = html;
      } catch (error) {
        document.getElementById('configContent').innerHTML = 
          '<div class="alert alert-error">加载失败: ' + error.message + '</div>';
      }
    }

    // 保存配置
    async function saveConfig() {
      const resultDiv = document.getElementById('configResult');
      const editor = document.getElementById('configEditor');
      
      try {
        const yamlText = editor.value;
        
        const res = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: yamlText
        });
        
        const data = await res.json();
        
        if (data.success) {
          resultDiv.innerHTML = '<div class="alert alert-success">' + data.message + '</div>';
        } else {
          resultDiv.innerHTML = '<div class="alert alert-error">' + data.message + (data.error ? ': ' + data.error : '') + '</div>';
        }
      } catch (error) {
        resultDiv.innerHTML = '<div class="alert alert-error">保存失败: ' + error.message + '</div>';
      }
    }

    // 页面加载时初始化
    window.onload = function() {
      loadStats();
      // 自动刷新日志
      setInterval(loadLogs, 5000);
    };
  </script>
</body>
</html>`;
  }
}