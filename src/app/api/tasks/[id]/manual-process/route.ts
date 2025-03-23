import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, parse } from 'path';
import connectToDatabase from '@/lib/db/mongodb';
import TaskModel from '@/lib/db/models/task';
import VideoModel from '@/lib/db/models/video';
import fs from 'fs';
import { getFileStoragePath } from '@/lib/utils/fileStorage';
import os from 'os';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

interface FormFile {
  filepath: string;
  originalFilename?: string;
  mimetype?: string;
  size?: number;
}

// 处理文件上传和解析表单数据
async function parseForm(req: NextRequest): Promise<{ fields: Record<string, string>; files: Record<string, FormFile[]> }> {
  const formData = await req.formData();
  const fields: Record<string, string> = {};
  const files: Record<string, FormFile[]> = {};

  // 处理表单字段和文件
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string' && 'arrayBuffer' in value) {
      // 处理文件 (Web标准File对象)
      const file = value as unknown as {
        name: string;
        type: string;
        size: number;
        arrayBuffer: () => Promise<ArrayBuffer>;
      };
      
      const tempDir = os.tmpdir();
      const buffer = Buffer.from(await file.arrayBuffer());
      const tempFilePath = join(tempDir, file.name);
      
      // 写入临时文件
      await writeFile(tempFilePath, buffer);
      
      // 创建文件对象
      const formFile: FormFile = {
        filepath: tempFilePath,
        originalFilename: file.name,
        mimetype: file.type,
        size: file.size
      };
      
      // 添加到files对象
      if (!files[key]) {
        files[key] = [];
      }
      files[key].push(formFile);
    } else {
      // 处理普通字段
      fields[key] = String(value);
    }
  }
  
  console.log('解析表单数据:', { 
    字段: Object.keys(fields), 
    文件: Object.keys(files)
  });
  
  return { fields, files };
}

// 读取文件内容
async function readFileBuffer(file: FormFile): Promise<Buffer> {
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
    
    console.log('处理任务:', id);
    
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
    const { fields, files } = await parseForm(req);
    console.log('解析表单数据详情:', { 
      字段值: fields,
      文件数量: Object.keys(files).map(key => `${key}: ${files[key].length}个文件`)
    });
    
    // 处理不同类型的任务
    let result;
    switch (task.type) {
      case 'subtitle_generation':
        // 处理字幕生成任务
        result = await processSubtitleTask(task, files, fields);
        break;
      
      case 'audio_extraction':
        // 处理音频提取任务
        result = await processAudioTask(task);
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
async function processSubtitleTask(task: TaskDocument, files: Record<string, FormFile[]>, fields: Record<string, string>) {
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
    } catch (e: unknown) {
      // 忽略解析错误，如果不是JSON，则保存为原始文件
      console.log('文件不是JSON格式，按原始文件处理:', e instanceof Error ? e.message : String(e));
      // 创建字幕文件路径
      const fileExt = parse(subtitleFile.originalFilename || 'subtitle.json').ext || '.json';
      const subtitleFileName = `subtitle_${task.videoId}${fileExt}`;
      
      // 根据文件类型选择存储位置
      let subtitlePath;
      let subtitleUrlForDb; // 存入数据库的相对路径
      
      if (fileExt.toLowerCase() === '.srt') {
        // SRT文件存储在public/results目录
        const resultsDir = join(process.cwd(), 'public', 'results');
        subtitlePath = join(resultsDir, subtitleFileName);
        subtitleUrlForDb = `/results/${subtitleFileName}`; // 相对URL路径
        
        // 确保目录存在
        if (!existsSync(resultsDir)) {
          await mkdir(resultsDir, { recursive: true });
        }
      } else {
        // 其他字幕文件存储在字幕目录
        subtitlePath = await getFileStoragePath(subtitleFileName, 'subtitles', { isPublic: true });
        // 将绝对路径转换为相对URL
        subtitleUrlForDb = `/uploads/subtitles/${subtitleFileName}`;
      }
      
      // 保存字幕文件
      await writeFile(subtitlePath, fileBuffer);
      
      // 更新视频记录（使用相对路径）
      video.subtitleUrl = subtitleUrlForDb;
      video.hasSubtitles = true;
      await video.save();
      
      // 更新任务状态
      task.status = 'completed';
      task.result = { subtitleUrl: subtitleUrlForDb };
      task.processedAt = new Date();
      await task.save();
      
      return { 
        success: true, 
        message: '字幕文件已保存', 
        subtitleUrl: subtitleUrlForDb,
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
    const subtitlePath = await getFileStoragePath(subtitleFileName, 'subtitles', { isPublic: true });
    await writeFile(subtitlePath, JSON.stringify(subtitles, null, 2));
    
    // 保存相对URL到数据库
    const subtitleUrlForDb = `/uploads/subtitles/${subtitleFileName}`;
    video.subtitleUrl = subtitleUrlForDb;
    
    // 同时生成SRT格式文件（默认生成，或请求指定）
    const shouldExportSrt = !fields || !fields.exportSrt || fields.exportSrt === 'true';
    if (shouldExportSrt) {
      // 将JSON字幕转换为SRT格式
      const srtContent = convertJsonToSrt(subtitles);
      const srtFileName = `subtitle_${task.videoId}.srt`;
      
      // 直接保存到public/results目录
      const resultsDir = join(process.cwd(), 'public', 'results');
      const srtPath = join(resultsDir, srtFileName);
      
      // 确保目录存在
      if (!existsSync(resultsDir)) {
        await mkdir(resultsDir, { recursive: true });
      }
      
      await writeFile(srtPath, srtContent);
      
      // SRT文件的相对URL
      const srtUrlForDb = `/results/${srtFileName}`;
      
      // 更新结果包含SRT路径
      task.result = { subtitles, subtitleUrl: subtitleUrlForDb, srtUrl: srtUrlForDb };
    } else {
      task.result = { subtitles, subtitleUrl: subtitleUrlForDb };
    }
    
    await video.save();
    
    // 更新任务状态
    task.status = 'completed';
    task.processedAt = new Date();
    await task.save();
    
    return { 
      success: true, 
      message: '字幕已保存', 
      subtitleUrl: subtitleUrlForDb,
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
async function processAudioTask(task: TaskDocument) {
  try {
    // 获取视频信息
    const video = await VideoModel.findById(task.videoId) as VideoDocument | null;
    if (!video) {
      throw new Error('未找到关联的视频');
    }
    
    // 创建音频文件路径 (将视频文件移动到指定位置)
    const videoPathParts = parse(task.mediaUrl);
    const audioFileName = `audio_${task.videoId}${videoPathParts.ext || '.mp3'}`;
    const audioPath = await getFileStoragePath(audioFileName, 'audios', { isPublic: true });
    
    // 生成相对URL路径
    const audioUrlForDb = `/uploads/audios/${audioFileName}`;
    
    // 如果媒体URL是本地文件路径，则复制文件到新位置
    if (!task.mediaUrl.startsWith('http')) {
      const sourcePath = task.mediaUrl.startsWith('/') ? task.mediaUrl : join(process.cwd(), task.mediaUrl);
      
      // 复制文件
      await fs.promises.copyFile(sourcePath, audioPath);
    }
    
    // 更新视频记录
    video.audioUrl = audioUrlForDb;
    await video.save();
    
    // 更新任务状态
    task.status = 'completed';
    task.result = { audioUrl: audioUrlForDb };
    task.processedAt = new Date();
    await task.save();
    
    return { 
      success: true, 
      message: '音频已处理', 
      audioUrl: audioUrlForDb,
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

// 将JSON字幕数组转换为SRT格式
function convertJsonToSrt(subtitles: Array<{ start: number; end: number; text: string }>): string {
  return subtitles.map((item, index) => {
    // 序号
    const number = index + 1;
    
    // 时间格式化
    const startTime = formatSrtTime(item.start);
    const endTime = formatSrtTime(item.end);
    
    // SRT条目
    return `${number}\n${startTime} --> ${endTime}\n${item.text}\n`;
  }).join('\n');
}

// 将秒数转换为SRT格式时间 (HH:MM:SS,mmm)
function formatSrtTime(seconds: number): string {
  const date = new Date(seconds * 1000);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const secs = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  
  return `${hours}:${minutes}:${secs},${ms}`;
} 