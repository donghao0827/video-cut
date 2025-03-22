import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import { TranscriptionTask } from '@/lib/db/models/transcriptionTask';
import TaskModel from '@/lib/db/models/task';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 从URL查询参数中获取筛选条件
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    
    // 构建查询条件
    const query: { status?: string; type?: string } = {};
    if (status) query.status = status;
    if (type) query.type = type;
    
    // 获取任务列表
    const tasks = await TaskModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
    
    // 获取转录任务列表
    const transcriptionTasks = await TranscriptionTask.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(limit);
    
    // 格式化离线任务结果
    const formattedTasks = tasks.map(task => ({
      id: task._id,
      type: task.type,
      videoId: task.videoId,
      status: task.status,
      mediaUrl: task.mediaUrl,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      processedAt: task.processedAt,
      error: task.error
    }));
    
    // 格式化转录任务结果
    const formattedTranscriptionTasks = transcriptionTasks.map(task => ({
      id: task._id,
      type: 'transcription',
      videoId: task.videoId,
      status: task.status,
      mediaUrl: task.localAudioUrl || task.obsAudioUrl,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      processedAt: task.processedAt,
      error: task.error
    }));
    
    // 合并结果
    const allTasks = [...formattedTasks, ...formattedTranscriptionTasks];
    
    // 按创建时间排序
    allTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // 限制结果数量
    const limitedTasks = allTasks.slice(0, limit);
    
    return NextResponse.json({ 
      tasks: limitedTasks,
      count: limitedTasks.length,
      totalPending: {
        tasks: await TaskModel.countDocuments({ status: 'pending' }),
        transcriptionTasks: await TranscriptionTask.countDocuments({ status: 'pending' })
      }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 解析请求体
    const body = await req.json();
    const { type, videoId, mediaUrl } = body;
    
    // 验证必填字段
    if (!type || !videoId || !mediaUrl) {
      return NextResponse.json(
        { error: 'Missing required fields', success: false },
        { status: 400 }
      );
    }
    
    // 创建新任务
    const task = new TaskModel({
      type,
      videoId,
      mediaUrl,
      status: 'pending'
    });
    
    // 保存任务到数据库
    await task.save();
    
    return NextResponse.json({
      success: true,
      task: {
        id: task._id,
        type: task.type,
        status: task.status,
        videoId: task.videoId,
        mediaUrl: task.mediaUrl,
        createdAt: task.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task', success: false },
      { status: 500 }
    );
  }
} 