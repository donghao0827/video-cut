/**
 * 音频转写任务处理脚本
 * 
 * 此脚本用于处理音频转写任务队列，从MongoDB中获取待处理的任务，
 * 下载音频文件，调用OpenAI的Whisper API进行音频转写，并更新任务状态和视频数据。
 * 
 * 环境变量要求:
 * - MONGODB_URI: MongoDB连接字符串
 * - OPENAI_API_KEY: OpenAI API密钥
 * - BATCH_SIZE: 每次处理的任务数量 (默认5)
 * - LOOP_INTERVAL: 循环检查间隔 (默认30秒)
 * 
 * 华为云OBS配置 (可选):
 * - HW_ACCESS_KEY_ID: 华为云访问密钥ID
 * - HW_SECRET_ACCESS_KEY: 华为云秘密访问密钥
 * - HW_OBS_ENDPOINT: 华为云OBS终端节点
 * - HW_OBS_BUCKET: 华为云OBS桶名称
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import ObsClient from 'esdk-obs-nodejs';

// 休眠函数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 环境变量
const MONGODB_URI = process.env.MONGODB_URI!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);
const LOOP_INTERVAL = parseInt(process.env.LOOP_INTERVAL || '30000', 10);

// OBS配置
const HW_ACCESS_KEY_ID = process.env.HW_ACCESS_KEY_ID;
const HW_SECRET_ACCESS_KEY = process.env.HW_SECRET_ACCESS_KEY;
const HW_OBS_ENDPOINT = process.env.HW_OBS_ENDPOINT;
// const HW_OBS_BUCKET = process.env.HW_OBS_BUCKET; // 暂时未使用，保留在文档中供参考

// 日志级别
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();

// 模型定义
interface IVideo {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  subtitles?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  audioUrl?: string;
  obsAudioUrl?: string;
}

interface ITranscriptionTask {
  _id: mongoose.Types.ObjectId;
  videoId: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  localAudioUrl: string;
  obsAudioUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  error?: string;
}

// 转写API响应类型
interface TranscriptionResponse {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// 日志函数
function log(level: string, message: string) {
  const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  const currentLevel = levels[LOG_LEVEL as keyof typeof levels] || 2;
  const messageLevel = levels[level as keyof typeof levels] || 2;

  if (messageLevel <= currentLevel) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }
}

// 初始化OBS客户端
function getObsClient() {
  if (HW_ACCESS_KEY_ID && HW_SECRET_ACCESS_KEY && HW_OBS_ENDPOINT) {
    return new ObsClient({
      access_key_id: HW_ACCESS_KEY_ID,
      secret_access_key: HW_SECRET_ACCESS_KEY,
      server: HW_OBS_ENDPOINT,
    });
  }
  return null;
}

// 下载音频文件
async function downloadAudio(url: string, outputPath: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp');
  
  // 创建临时目录（如果不存在）
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, outputPath);
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
  });
  
  await pipeline(response.data, createWriteStream(filePath));
  return filePath;
}

// 调用OpenAI API进行音频转写
async function transcribeAudio(audioPath: string): Promise<TranscriptionResponse> {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('language', 'zh');
    
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    });
    
    return response.data as TranscriptionResponse;
  } catch (error: unknown) {
    const err = error as Error;
    log('error', `OpenAI API调用失败: ${err.message}`);
    if (axios.isAxiosError(error) && error.response) {
      log('error', `状态码: ${error.response.status}`);
      log('error', `响应数据: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// 处理音频转写任务
async function processTask(task: ITranscriptionTask): Promise<void> {
  let localFilePath = '';
  
  try {
    // 获取视频模型
    const Video = mongoose.model<IVideo>('Video');
    
    // 更新任务状态为处理中
    const Task = mongoose.model<ITranscriptionTask>('TranscriptionTask');
    await Task.findByIdAndUpdate(task._id, {
      status: 'processing',
      updatedAt: new Date(),
    });
    
    log('info', `开始处理任务 ${task._id} (视频ID: ${task.videoId})`);
    
    // 确定使用哪个音频URL
    const audioUrl = task.obsAudioUrl || task.localAudioUrl;
    if (!audioUrl) {
      throw new Error('没有可用的音频URL');
    }
    
    // 下载音频文件
    log('info', `下载音频: ${audioUrl}`);
    const outputFilename = `audio_${task._id}.mp3`;
    localFilePath = await downloadAudio(audioUrl, outputFilename);
    
    // 转写音频
    log('info', `转写音频: ${localFilePath}`);
    const transcriptionResult = await transcribeAudio(localFilePath);
    
    // 处理字幕结果
    if (!transcriptionResult.segments) {
      throw new Error('转写结果中未包含分段信息');
    }
    
    // 格式化字幕
    const subtitles = transcriptionResult.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
    }));
    
    // 更新视频
    await Video.findByIdAndUpdate(task.videoId, {
      subtitles: subtitles,
    });
    
    // 更新任务状态为已完成
    await Task.findByIdAndUpdate(task._id, {
      status: 'completed',
      processedAt: new Date(),
      updatedAt: new Date(),
    });
    
    log('info', `任务 ${task._id} 已完成处理`);
  } catch (error: unknown) {
    const err = error as Error;
    log('error', `处理任务 ${task._id} 时出错: ${err.message}`);
    
    // 更新任务状态为失败
    const Task = mongoose.model<ITranscriptionTask>('TranscriptionTask');
    await Task.findByIdAndUpdate(task._id, {
      status: 'failed',
      error: err.message,
      updatedAt: new Date(),
    });
  } finally {
    // 清理临时文件
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  }
}

// 主函数
async function main() {
  try {
    log('info', '音频转写任务处理服务启动');
    log('info', `MongoDB URI: ${MONGODB_URI.substring(0, 20)}...`);
    log('info', `批次大小: ${BATCH_SIZE}`);
    log('info', `循环间隔: ${LOOP_INTERVAL}ms`);
    
    // 连接数据库
    await mongoose.connect(MONGODB_URI);
    log('info', '已连接到MongoDB');
    
    // 加载模型
    mongoose.model<IVideo>('Video', new mongoose.Schema({
      title: String,
      description: String,
      url: String,
      thumbnailUrl: String,
      subtitles: Array,
      audioUrl: String,
      obsAudioUrl: String,
    }));
    
    mongoose.model<ITranscriptionTask>('TranscriptionTask', new mongoose.Schema({
      videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
      status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
      localAudioUrl: String,
      obsAudioUrl: String,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      processedAt: Date,
      error: String,
    }));
    
    // 检查OBS配置
    const obsClient = getObsClient();
    if (obsClient) {
      log('info', '华为云OBS客户端已初始化');
    } else {
      log('warn', '华为云OBS配置不完整，仅使用本地文件');
    }
    
    // 主处理循环
    while (true) {
      try {
        const Task = mongoose.model<ITranscriptionTask>('TranscriptionTask');
        
        // 获取待处理任务
        const pendingTasks = await Task.find({ status: 'pending' })
          .sort({ createdAt: 1 })
          .limit(BATCH_SIZE);
        
        if (pendingTasks.length === 0) {
          log('info', '当前没有待处理任务，等待下一个检查周期');
          await sleep(LOOP_INTERVAL);
          continue;
        }
        
        log('info', `找到 ${pendingTasks.length} 个待处理任务`);
        
        // 并行处理任务，但限制并发数
        await Promise.all(
          pendingTasks.map(task => processTask(task))
        );
        
        // 等待一段时间，避免频繁请求OpenAI API
        await sleep(2000);
      } catch (error: unknown) {
        const err = error as Error;
        log('error', `处理循环中发生错误: ${err.message}`);
        await sleep(10000); // 出错后等待较长时间
      }
    }
  } catch (error: unknown) {
    const err = error as Error;
    log('error', `致命错误: ${err.message}`);
    process.exit(1);
  }
}

// 启动主函数
main().catch(error => {
  log('error', `未捕获的错误: ${error.message}`);
  process.exit(1);
});