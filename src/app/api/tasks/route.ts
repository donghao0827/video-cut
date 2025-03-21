import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import { TranscriptionTask } from '@/lib/db/models/transcriptionTask';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // 从URL查询参数中获取筛选条件
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    
    // 构建查询条件
    const query: { status?: string } = {};
    if (status) {
      query.status = status;
    }
    
    // 获取任务列表
    const tasks = await TranscriptionTask.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
    
    // 格式化返回结果
    const formattedTasks = tasks.map(task => ({
      id: task._id,
      videoId: task.videoId,
      status: task.status,
      localAudioUrl: task.localAudioUrl,
      obsAudioUrl: task.obsAudioUrl,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      processedAt: task.processedAt,
      error: task.error
    }));
    
    return NextResponse.json({ 
      tasks: formattedTasks,
      count: formattedTasks.length,
      totalPending: await TranscriptionTask.countDocuments({ status: 'pending' })
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
} 