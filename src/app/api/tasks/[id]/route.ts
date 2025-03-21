import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import { TranscriptionTask } from '@/lib/db/models/transcriptionTask';
import Video from '@/lib/db/models/video';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id } = await params;
    
    // 查找任务
    const task = await TranscriptionTask.findById(id);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    
    // 同时获取相关联的视频
    const video = await Video.findById(task.videoId);
    
    return NextResponse.json({ 
      task: {
        id: task._id,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        processedAt: task.processedAt,
        error: task.error
      },
      video: video ? {
        id: video._id,
        title: video.title,
        status: video.status,
        hasTranscript: !!video.transcript
      } : null
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
} 