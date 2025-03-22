import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import TaskModel from '@/lib/db/models/task';
import axios from 'axios';
import mongoose from 'mongoose';

interface VideoResponse {
  id: string;
  url?: string;
  [key: string]: any;
}

interface SubtitleResult {
  status: string;
  subtitles?: Array<any>;
  subtitle_url?: string;
  message?: string;
}

// 处理字幕生成任务
async function processSubtitleGenerationTask(task: any) {
  try {
    // 获取视频URL
    const videoResponse = await axios.get(`/api/videos/${task.videoId}`);
    const videoData: VideoResponse = videoResponse.data;
    
    // 如果不存在视频地址，则失败
    if (!videoData.url && !task.mediaUrl) {
      throw new Error('未找到视频URL');
    }
    
    const url = task.mediaUrl || videoData.url;
    
    // 判断是否是OBS地址（以https://开头）
    const isObsUrl = url.startsWith('https://');
    
    // 根据URL类型设置不同的参数
    const requestData: {
      video_id: string;
      media_url?: string;
      media_key?: string;
    } = {
      video_id: task.videoId.toString()
    };
    
    if (isObsUrl) {
      // 如果是OBS地址，使用media_url参数
      requestData.media_url = url;
    } else {
      // 否则使用media_key参数
      // 移除开头的斜杠（如果存在）
      const mediaKey = url.startsWith('/') ? url.substring(1) : url;
      requestData.media_key = mediaKey;
    }
    
    // 调用字幕生成API
    const response = await axios.post('http://localhost:8000/api/subtitle', requestData);
    
    if (!response.data || (!response.data.task_id && !response.data.subtitles)) {
      throw new Error('字幕API返回的数据无效');
    }
    
    // 更新任务状态为处理中
    task.status = 'processing';
    await task.save();
    
    if (response.data.task_id) {
      // 轮询任务状态
      const subtitleResult = await pollSubtitleStatus(response.data.task_id);
      
      if (subtitleResult.subtitles || subtitleResult.subtitle_url) {
        // 任务完成，更新视频数据
        const subtitles = subtitleResult.subtitles || [];
        const subtitleUrl = subtitleResult.subtitle_url || null;
        
        // 更新视频数据
        await axios.patch(`/api/videos/${task.videoId}`, {
          subtitles: subtitles,
          hasSubtitles: true,
          subtitleUrl: subtitleUrl
        });
        
        // 更新任务状态为已完成
        task.status = 'completed';
        task.result = { subtitles, subtitleUrl };
        task.processedAt = new Date();
        await task.save();
        
        return { success: true, message: '字幕生成完成' };
      } else {
        throw new Error('未能从任务中获取字幕');
      }
    } else if (response.data.subtitles) {
      // 直接返回字幕
      const subtitles = response.data.subtitles;
      
      // 更新视频数据
      await axios.patch(`/api/videos/${task.videoId}`, {
        subtitles: subtitles,
        hasSubtitles: true
      });
      
      // 更新任务状态为已完成
      task.status = 'completed';
      task.result = { subtitles };
      task.processedAt = new Date();
      await task.save();
      
      return { success: true, message: '字幕生成完成' };
    }
    
    // 默认返回，理论上不会到达这里
    return { success: false, message: '未知结果' };
  } catch (error) {
    console.error('处理字幕生成任务出错:', error);
    
    // 更新任务状态为失败
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : '未知错误';
    task.processedAt = new Date();
    await task.save();
    
    throw error;
  }
}

// 轮询字幕生成状态
async function pollSubtitleStatus(taskId: string, maxAttempts = 30, intervalMs = 2000): Promise<SubtitleResult> {
  let attempts = 0;
  
  const checkStatus = async (): Promise<SubtitleResult> => {
    try {
      if (attempts >= maxAttempts) {
        throw new Error('字幕生成超时');
      }
      
      attempts++;
      
      const statusResponse = await axios.get(`http://localhost:8000/api/subtitle/${taskId}`);
      const statusData: SubtitleResult = statusResponse.data;
      
      if (statusData.status === 'success') {
        // 任务完成，返回结果
        return statusData;
      } else if (statusData.status === 'failed' || statusData.status === 'error') {
        throw new Error('Subtitle generation failed: ' + (statusData.message || '未知错误'));
      } else {
        // 任务仍在进行中，继续轮询
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        return checkStatus();
      }
    } catch (error) {
      console.error('Error polling subtitle status:', error);
      throw error;
    }
  };
  
  return checkStatus();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    
    // 查找任务
    const task = await TaskModel.findById(id);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    
    // 检查任务是否已经处理过
    if (task.status !== 'pending') {
      return NextResponse.json(
        { error: 'Task is not in pending status', status: task.status },
        { status: 400 }
      );
    }
    
    // 根据任务类型处理
    let result;
    switch (task.type) {
      case 'subtitle_generation':
        result = await processSubtitleGenerationTask(task);
        break;
      case 'audio_extraction':
        // 未实现的任务类型
        return NextResponse.json(
          { error: 'Task type not implemented yet' },
          { status: 501 }
        );
      default:
        return NextResponse.json(
          { error: 'Unknown task type' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Task processed successfully',
      task: {
        id: task._id,
        type: task.type,
        status: task.status,
        processedAt: task.processedAt
      },
      ...result
    });
  } catch (error) {
    console.error('Error processing task:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process task',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
} 