import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import axios from 'axios';
import TaskModel from '@/lib/db/models/task';

/**
 * 检查是否应该使用离线任务进行字幕生成
 * 根据环境变量SUBTITLE_USE_OFFLINE_TASKS决定
 */
const shouldUseOfflineTasks = (): boolean => {
  // 如果明确设置了环境变量，则使用它的值
  if (typeof process.env.SUBTITLE_USE_OFFLINE_TASKS !== 'undefined') {
    return process.env.SUBTITLE_USE_OFFLINE_TASKS === 'true';
  }
  
  // 默认在生产环境中使用离线任务，在开发环境中不使用
  return process.env.NODE_ENV === 'production';
};

/**
 * 创建离线任务
 */
async function createOfflineTask(videoId: string, mediaUrl: string) {
  await connectToDatabase();
  
  // 创建新任务
  const task = new TaskModel({
    type: 'subtitle_generation',
    videoId,
    mediaUrl,
    status: 'pending'
  });
  
  // 保存任务到数据库
  await task.save();
  
  return {
    taskCreated: true,
    task: {
      id: task._id,
      type: task.type,
      status: task.status,
      videoId: task.videoId,
      mediaUrl: task.mediaUrl,
      createdAt: task.createdAt
    }
  };
}

/**
 * 直接调用字幕生成服务
 */
async function generateSubtitleDirectly(videoId: string, mediaUrl: string) {
  // 判断是否是OBS地址（以https://开头）
  const isObsUrl = mediaUrl.startsWith('https://');
  
  // 根据URL类型设置不同的参数
  const requestData: {
    video_id: string;
    media_url?: string;
    media_key?: string;
  } = {
    video_id: videoId
  };
  
  if (isObsUrl) {
    // 如果是OBS地址，使用media_url参数
    requestData.media_url = mediaUrl;
  } else {
    // 否则使用media_key参数
    // 移除开头的斜杠（如果存在）
    const mediaKey = mediaUrl.startsWith('/') ? mediaUrl.substring(1) : mediaUrl;
    requestData.media_key = mediaKey;
  }
  
  // 调用本地字幕提取服务
  const response = await axios.post('http://localhost:8000/api/subtitle', requestData);
  
  return response.data;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { mediaUrl } = body;
    
    if (!mediaUrl) {
      return NextResponse.json(
        { error: '缺少必填字段: mediaUrl' },
        { status: 400 }
      );
    }
    
    // 检查是否使用离线任务
    if (shouldUseOfflineTasks()) {
      // 创建离线任务
      const result = await createOfflineTask(id, mediaUrl);
      return NextResponse.json(result);
    } else {
      // 直接生成字幕
      const result = await generateSubtitleDirectly(id, mediaUrl);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('生成字幕时出错:', error);
    return NextResponse.json(
      { 
        error: '生成字幕失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
} 