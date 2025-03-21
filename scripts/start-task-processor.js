#!/usr/bin/env node

/**
 * 启动音频转写任务处理脚本
 * 
 * 运行方式:
 * node scripts/start-task-processor.js
 * 或
 * npm run process-tasks
 * 
 * 环境变量:
 * - MONGODB_URI: MongoDB连接字符串
 * - OPENAI_API_KEY: OpenAI API密钥
 * - BATCH_SIZE: 每次处理的任务数量（可选，默认为5）
 * - LOOP_INTERVAL: 循环检查间隔（毫秒，可选，默认为30000，即30秒）
 * - LOG_LEVEL: 日志级别（可选，默认为"info"）
 */

require('dotenv').config({ path: '.env.local' });

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 日志目录
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 验证必要的环境变量
if (!process.env.MONGODB_URI) {
  console.error('错误: 缺少必要的环境变量 MONGODB_URI');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('错误: 缺少必要的环境变量 OPENAI_API_KEY');
  process.exit(1);
}

// 设置默认参数
const batchSize = process.env.BATCH_SIZE || 5;
const loopInterval = process.env.LOOP_INTERVAL || 30000;
const logLevel = process.env.LOG_LEVEL || 'info';

console.log('启动音频转写任务处理脚本...');
console.log(`批次大小: ${batchSize}`);
console.log(`循环间隔: ${loopInterval}ms`);
console.log(`日志级别: ${logLevel}`);

// 创建日志文件
const now = new Date();
const logFileName = `task_processor_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}.log`;
const logFilePath = path.join(LOG_DIR, logFileName);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// 将控制台输出重定向到日志文件
console.log(`日志文件: ${logFilePath}`);

// 启动TypeScript脚本
const scriptPath = path.join(__dirname, 'process-transcription-tasks.ts');
const child = spawn('npx', ['ts-node', scriptPath], {
  env: {
    ...process.env,
    BATCH_SIZE: batchSize,
    LOOP_INTERVAL: loopInterval,
    LOG_LEVEL: logLevel,
  },
  stdio: ['inherit', 'pipe', 'pipe'], // 捕获stdout和stderr
});

// 将子进程的输出重定向到控制台和日志文件
child.stdout.pipe(process.stdout);
child.stdout.pipe(logStream);
child.stderr.pipe(process.stderr);
child.stderr.pipe(logStream);

// 监听子进程事件
child.on('error', (error) => {
  const errorMsg = `启动失败: ${error.message}`;
  console.error(errorMsg);
  logStream.write(`${new Date().toISOString()} [ERROR] ${errorMsg}\n`);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    const errorMsg = `脚本异常退出，退出码: ${code}`;
    console.error(errorMsg);
    logStream.write(`${new Date().toISOString()} [ERROR] ${errorMsg}\n`);
    process.exit(code);
  }
  
  logStream.end();
});

// 优雅退出处理
process.on('SIGINT', () => {
  const exitMsg = '\n正在停止任务处理脚本...';
  console.log(exitMsg);
  logStream.write(`${new Date().toISOString()} [INFO] ${exitMsg}\n`);
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  const exitMsg = '\n正在停止任务处理脚本...';
  console.log(exitMsg);
  logStream.write(`${new Date().toISOString()} [INFO] ${exitMsg}\n`);
  child.kill('SIGTERM');
});