import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import Video from '@/lib/db/models/video';

// 获取单个视频信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const videoId = (await params).id;
    
    if (!videoId) {
      return NextResponse.json({ error: '无效的视频ID' }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // 获取视频信息
    const video = await Video.findById(videoId);
    
    if (!video) {
      return NextResponse.json({ error: '视频未找到' }, { status: 404 });
    }
    
    return NextResponse.json(video);
  } catch (error) {
    console.error('获取视频信息出错:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 更新视频信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;
    
    if (!videoId) {
      return NextResponse.json({ error: '无效的视频ID' }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // 获取更新数据
    const updateData = await request.json();
    
    // 更新视频信息
    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      updateData,
      { new: true } // 返回更新后的文档
    );
    
    if (!updatedVideo) {
      return NextResponse.json({ error: '视频未找到' }, { status: 404 });
    }
    
    return NextResponse.json(updatedVideo);
  } catch (error) {
    console.error('更新视频信息出错:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
} 