#!/usr/bin/env node

/**
 * 文件自动整理器 - Bootstrap 脚本
 *
 * 快速设置开发环境
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 正在初始化文件自动整理器...\n');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, cwd = process.cwd(), description = '') {
  try {
    if (description) log(`\n📋 ${description}`, 'cyan');
    log(`⚡ 执行: ${command}`, 'yellow');
    execSync(command, { cwd, stdio: 'inherit' });
    log(`✅ 完成: ${description || command}`, 'green');
  } catch (error) {
    log(`❌ 失败: ${command}`, 'red');
    log(`错误: ${error.message}`, 'red');
    process.exit(1);
  }
}

function main() {
  const rootDir = process.cwd();

  log('🏗️  初始化开发环境...', 'bright');
  log(`📁 ${rootDir}`, 'blue');

  // 并行安装依赖
  log('\n📦 安装项目依赖...', 'cyan');
  runCommand('npm install', rootDir, '根目录依赖');

  const backendDir = path.join(rootDir, 'backend');
  if (fs.existsSync(path.join(backendDir, 'package.json'))) {
    runCommand('npm install', backendDir, '后端依赖');
  }

  const frontendDir = path.join(rootDir, 'frontend');
  if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
    runCommand('npm install', frontendDir, '前端依赖');
  }

  // 设置配置文件
  const configExample = path.join(rootDir, 'config.yaml.example');
  const config = path.join(rootDir, 'config.yaml');

  if (!fs.existsSync(config) && fs.existsSync(configExample)) {
    log('\n📝 设置配置文件...', 'cyan');
    fs.copyFileSync(configExample, config);
    log('✅ 已创建 config.yaml', 'green');
    log('⚠️  请根据需要更新配置', 'yellow');
  }

  // 创建必要目录
  const logsDir = path.join(rootDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    log('✅ 已创建日志目录', 'green');
  }

  // 完成
  log('\n🎉 初始化完成！', 'bright');
  log('\n📋 启动项目:', 'cyan');
  log('   npm run dev          # 同时启动前后端', 'blue');
  log('   npm run dev:backend  # 仅启动后端', 'blue');
  log('   npm run dev:frontend # 仅启动前端', 'blue');

  log('\n🚀 开始开发吧！', 'bright');
}

// 处理进程终止
process.on('SIGINT', () => {
  log('\n\n⚠️  初始化过程被中断', 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('\n\n⚠️  初始化过程被终止', 'yellow');
  process.exit(1);
});

// 运行初始化
main();