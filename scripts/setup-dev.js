#!/usr/bin/env node

/**
 * 本地开发环境设置脚本
 *
 * 此脚本用于快速设置本地开发环境：
 * 1. 创建本地开发目录结构
 * 2. 生成示例文件用于测试
 * 3. 设置本地配置文件
 * 4. 启动开发服务器
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🛠️  正在设置本地开发环境...\n');

// 控制台输出颜色
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, cwd = process.cwd(), description = '') {
  try {
    if (description) {
      log(`\n📋 ${description}`, 'cyan');
    }
    log(`⚡ 执行命令: ${command}`, 'yellow');
    execSync(command, { cwd, stdio: 'inherit' });
    log(`✅ 成功完成: ${description || command}`, 'green');
  } catch (error) {
    log(`❌ 命令执行失败: ${command}`, 'red');
    log(`错误详情: ${error.message}`, 'red');
    process.exit(1);
  }
}

function createDirectory(dirPath, description = '') {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      log(`✅ 已创建目录: ${description || dirPath}`, 'green');
    } else {
      log(`✅ 目录已存在: ${description || dirPath}`, 'blue');
    }
  } catch (error) {
    log(`❌ 创建目录失败: ${dirPath}`, 'red');
    log(`错误详情: ${error.message}`, 'red');
  }
}

function createSampleFiles() {
  const sampleDir = path.join(process.cwd(), 'data', '待分类');

  const sampleFiles = [
    {
      name: '工作计划.docx',
      content: '这是我的工作计划文档，包含了本周的工作安排和目标。'
    },
    {
      name: '会议记录.txt',
      content: '团队会议记录 - 2024年项目规划和任务分配'
    },
    {
      name: '学习笔记.pdf',
      content: '%PDF-1.4\n模拟的PDF学习笔记内容'
    },
    {
      name: '旅行照片.jpg',
      content: '模拟的JPEG图片文件'
    },
    {
      name: '项目代码.js',
      content: 'function helloWorld() {\n  console.log("Hello, World!");\n}'
    },
    {
      name: '账单记录.xlsx',
      content: '模拟的Excel表格 - 本月消费记录'
    },
    {
      name: '设计草图.png',
      content: '模拟的PNG图片文件'
    },
    {
      name: '技术文档.md',
      content: '# 技术文档\n\n## API接口说明\n\n这是一个技术文档示例。'
    }
  ];

  log('\n📝 创建示例文件...', 'cyan');
  sampleFiles.forEach(file => {
    const filePath = path.join(sampleDir, file.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.content, 'utf8');
      log(`   📄 已创建: ${file.name}`, 'green');
    } else {
      log(`   📄 文件已存在: ${file.name}`, 'blue');
    }
  });
}

function setupLocalConfig() {
  const configPath = path.join(process.cwd(), 'config.yaml');

  // 如果配置文件不存在，应用启动时会自动创建，这里只需要优化已存在的配置
  if (fs.existsSync(configPath)) {
    log('\n⚙️  优化本地开发配置...', 'cyan');

    // 修改配置文件
    let configContent = fs.readFileSync(configPath, 'utf8');

    // 替换Docker路径为本地路径
    configContent = configContent.replace(
      /root_dir: "\/data\/分类库"/g,
      'root_dir: "./data/分类库"'
    );
    configContent = configContent.replace(
      /incoming_dir: "\/data\/待分类"/g,
      'incoming_dir: "./data/待分类"'
    );
    configContent = configContent.replace(
      /dir: "\/app\/logs"/g,
      'dir: "./logs"'
    );

    // 本地开发关闭定时任务
    configContent = configContent.replace(
      /enabled: true/g,
      'enabled: false'
    );

    // 本地开发使用debug日志级别
    configContent = configContent.replace(
      /level: "info"/g,
      'level: "debug"'
    );

    fs.writeFileSync(configPath, configContent, 'utf8');
    log('✅ 已优化本地开发配置', 'green');
  } else {
    log('\n⚙️  配置文件不存在，应用启动时会自动创建', 'blue');
  }
}

function createDevDirectoryStructure() {
  log('\n📁 创建本地开发目录结构...', 'cyan');

  const directories = [
    { path: 'data', desc: '主数据目录' },
    { path: 'data/分类库', desc: '分类后的文件存储目录' },
    { path: 'data/待分类', desc: '待分类文件目录' },
    { path: 'logs', desc: '日志文件目录' },
    { path: 'temp', desc: '临时文件目录' }
  ];

  directories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir.path);
    createDirectory(fullPath, dir.desc);
  });
}

function main() {
  const rootDir = process.cwd();

  log('🏗️  开始本地开发环境设置...', 'bright');
  log(`📁 工作目录: ${rootDir}`, 'blue');

  // 1. 创建目录结构
  createDevDirectoryStructure();

  // 2. 设置本地配置
  setupLocalConfig();

  // 3. 创建示例文件
  createSampleFiles();

  // 4. 创建分类库示例结构
  log('\n📂 创建分类库示例结构...', 'cyan');
  const categoryDirs = [
    'data/分类库/工作文档',
    'data/分类库/工作文档/会议记录',
    'data/分类库/工作文档/项目资料',
    'data/分类库/学习资料',
    'data/分类库/学习资料/编程',
    'data/分类库/学习资料/设计',
    'data/分类库/个人文件',
    'data/分类库/个人文件/照片',
    'data/分类库/个人文件/账单'
  ];

  categoryDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    createDirectory(fullPath);
  });

  // 5. 成功消息
  log('\n🎉 本地开发环境设置完成！', 'bright');
  log('\n📋 接下来的步骤:', 'cyan');
  log('   1. 检查并编辑 config.yaml，设置你的 API Key', 'blue');
  log('   2. 运行 "npm run dev" 启动开发服务器', 'blue');
  log('   3. 访问 http://localhost:3001 查看API文档', 'blue');
  log('   4. 访问 http://localhost:5173 查看前端界面', 'blue');
  log('   5. 使用 HTTP API 测试文件分类功能', 'blue');

  log('\n🚀 测试命令:', 'cyan');
  log('   curl -X POST http://localhost:3001/api/organize -H "Content-Type: application/json" -d \'{"dryRun": true}\'', 'yellow');

  log('\n📂 示例文件已创建在 ./data/待分类/ 目录中', 'green');
  log('\n🔧 本地开发配置文件: config.yaml', 'green');

  log('\n祝您开发愉快！', 'bright');
}

// 处理进程终止
process.on('SIGINT', () => {
  log('\n\n⚠️  设置过程被中断', 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('\n\n⚠️  设置过程被终止', 'yellow');
  process.exit(1);
});

// 运行设置
main();