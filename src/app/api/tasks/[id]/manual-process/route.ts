import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname, parse } from 'path';
import { existsSync } from 'fs';
import { EventEmitter } from 'events';
import connectToDatabase from '@/lib/db/mongodb';
import TaskModel from '@/lib/db/models/task';
import VideoModel from '@/lib/db/models/video';
import formidable from 'formidable';
import fs from 'fs';

// 禁用默认body解析器，以便我们可以使用formidable处理文件上传
export const config = {
  api: {
    bodyParser: false,
  },
};

// 处理文件上传和解析表单数据
async function parseForm(req: NextRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: true });
    
    // 将NextRequest转换为Node的IncomingMessage
    const nodeReq = Object.assign(new EventEmitter(), {
      headers: req.headers,
      method: req.method,
      url: req.url,
      pipe: function() { return this; }
    });
    
    // 处理请求体
    if (req.body) {
      const reader = req.body.getReader(); // 只获取一次reader
      
      // 处理单个数据块的函数
      async function processChunk() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            nodeReq.emit('end');
            return;
          }
          
          // 将数据发送给formidable
          nodeReq.emit('data', Buffer.from(value));
          
          // 继续读取下一个数据块
          return processChunk();
        } catch (err) {
          reader.releaseLock(); // 出错时释放锁
          reject(err);
        }
      }
      
      // 开始处理数据流
      processChunk().catch(err => {
        console.error('处理请求体出错:', err);
        reject(err);
      });
    } else {
      // 如果没有请求体，直接结束
      nodeReq.emit('end');
    }
    
    // 尝试解析表单数据，即使这样可能在TypeScript中显示错误
    // @ts-expect-error - 我们知道nodeReq不是完整的IncomingMessage，但它包含formidable所需的最低属性
    form.parse(nodeReq, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

// 读取文件内容
async function readFileBuffer(file: formidable.File): Promise<Buffer> {
  return readFile(file.filepath);
}

// 处理请求
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    
    // 查找任务
    const task = await TaskModel.findById(id);
    
    if (!task) {
      return NextResponse.json(
        { error: '任务未找到' },
        { status: 404 }
      );
    }
    
    // 检查任务是否已经处理过
    if (task.status !== 'pending') {
      return NextResponse.json(
        { error: '任务不是待处理状态', status: task.status },
        { status: 400 }
      );
    }
    
    // 解析请求
    // const { fields, files } = await parseForm(req);
    console.log('>>>>>', await parseForm(req))
    const storageLocation = fields.storageLocation ? fields.storageLocation.toString() : '/uploads/processed';
    
    // 确保存储目录存在
    if (!existsSync(storageLocation)) {
      await mkdir(storageLocation, { recursive: true });
    }
    
    // 处理不同类型的任务
    let result;
    switch (task.type) {
      case 'subtitle_generation':
        // 处理字幕生成任务
        result = await processSubtitleTask(task, files, storageLocation);
        break;
      
      case 'audio_extraction':
        // 处理音频提取任务
        result = await processAudioTask(task, storageLocation);
        break;
      
      default:
        return NextResponse.json(
          { error: '未知的任务类型' },
          { status: 400 }
        );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('处理任务出错:', error);
    
    return NextResponse.json(
      { 
        error: '处理任务失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

// 处理字幕任务
async function processSubtitleTask(task: TaskDocument, files: formidable.Files, storageLocation: string) {
  try {
    // 检查是否有上传字幕文件
    const subtitleFileArray = files.subtitleFile;
    if (!subtitleFileArray || !Array.isArray(subtitleFileArray) || subtitleFileArray.length === 0) {
      throw new Error('未提供字幕文件');
    }
    
    const subtitleFile = subtitleFileArray[0]; // 取第一个文件
    
    // 获取视频信息
    const video = await VideoModel.findById(task.videoId) as VideoDocument | null;
    if (!video) {
      throw new Error('未找到关联的视频');
    }
    
    // 读取字幕文件内容
    const fileBuffer = await readFileBuffer(subtitleFile);
    let subtitles: Array<{ start: number; end: number; text: string }> = [];
    
    try {
      // 尝试解析为JSON格式
      subtitles = JSON.parse(fileBuffer.toString());
    } catch (error) {
      // 忽略解析错误，如果不是JSON，则保存为原始文件
      // 创建字幕文件路径
      const fileExt = parse(subtitleFile.originalFilename || 'subtitle.json').ext || '.json';
      const subtitleFileName = `subtitle_${task.videoId}${fileExt}`;
      const subtitlePath = join(storageLocation, subtitleFileName);
      
      // 保存字幕文件
      await writeFile(subtitlePath, fileBuffer);
      
      // 更新视频记录
      video.subtitleUrl = subtitlePath;
      video.hasSubtitles = true;
      await video.save();
      
      // 更新任务状态
      task.status = 'completed';
      task.result = { subtitleUrl: subtitlePath };
      task.processedAt = new Date();
      await task.save();
      
      return { 
        success: true, 
        message: '字幕文件已保存', 
        subtitleUrl: subtitlePath,
        task: {
          id: task._id,
          type: task.type,
          status: task.status,
          processedAt: task.processedAt
        }
      };
    }
    
    // 如果是JSON格式，更新视频记录
    video.subtitles = subtitles;
    video.hasSubtitles = true;
    
    // 同时保存JSON文件
    const subtitleFileName = `subtitle_${task.videoId}.json`;
    const subtitlePath = join(storageLocation, subtitleFileName);
    await writeFile(subtitlePath, JSON.stringify(subtitles, null, 2));
    video.subtitleUrl = subtitlePath;
    
    await video.save();
    
    // 更新任务状态
    task.status = 'completed';
    task.result = { subtitles, subtitleUrl: subtitlePath };
    task.processedAt = new Date();
    await task.save();
    
    return { 
      success: true, 
      message: '字幕已保存', 
      subtitleUrl: subtitlePath,
      task: {
        id: task._id,
        type: task.type,
        status: task.status,
        processedAt: task.processedAt
      }
    };
  } catch (error) {
    console.error('处理字幕任务出错:', error);
    
    // 更新任务状态为失败
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : '未知错误';
    task.processedAt = new Date();
    await task.save();
    
    throw error;
  }
}

interface VideoDocument {
  _id: string;
  audioUrl?: string;
  subtitleUrl?: string;
  subtitles?: Array<{ start: number; end: number; text: string }>;
  hasSubtitles?: boolean;
  save: () => Promise<VideoDocument>;
}

interface TaskDocument {
  _id: string;
  type: string;
  status: string;
  videoId: string;
  mediaUrl: string;
  result?: Record<string, unknown>;
  error?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<TaskDocument>;
}

// 处理音频任务
async function processAudioTask(task: TaskDocument, storageLocation: string) {
  try {
    // 获取视频信息
    const video = await VideoModel.findById(task.videoId) as VideoDocument | null;
    if (!video) {
      throw new Error('未找到关联的视频');
    }
    
    // 创建音频文件路径 (将视频文件移动到指定位置)
    const videoPathParts = parse(task.mediaUrl);
    const audioFileName = `audio_${task.videoId}${videoPathParts.ext || '.mp3'}`;
    const audioPath = join(storageLocation, audioFileName);
    
    // 如果媒体URL是本地文件路径，则复制文件到新位置
    if (!task.mediaUrl.startsWith('http')) {
      const sourcePath = task.mediaUrl.startsWith('/') ? task.mediaUrl : join(process.cwd(), task.mediaUrl);
      
      // 确保目标目录存在
      await mkdir(dirname(audioPath), { recursive: true });
      
      // 复制文件
      await fs.promises.copyFile(sourcePath, audioPath);
    }
    
    // 更新视频记录
    video.audioUrl = audioPath;
    await video.save();
    
    // 更新任务状态
    task.status = 'completed';
    task.result = { audioUrl: audioPath };
    task.processedAt = new Date();
    await task.save();
    
    return { 
      success: true, 
      message: '音频已处理', 
      audioUrl: audioPath,
      task: {
        id: task._id,
        type: task.type,
        status: task.status,
        processedAt: task.processedAt
      }
    };
  } catch (error) {
    console.error('处理音频任务出错:', error);
    
    // 更新任务状态为失败
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : '未知错误';
    task.processedAt = new Date();
    await task.save();
    
    throw error;
  }
} 