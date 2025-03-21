import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import { Video } from '@/lib/db/models/video';
import { TranscriptionTask } from '@/lib/db/models/transcriptionTask';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { uploadToObs } from '@/lib/storage/obsClient';
import fs from 'fs';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id } = await params;
    
    // 查找视频
    const video = await Video.findById(id);
    
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    // 更新视频状态
    video.status = 'processing';
    await video.save();
    
    try {
      // 获取存储模式配置
      const storageMode = process.env.STORAGE_MODE || 'local';
      const obsConfigured = process.env.HW_ACCESS_KEY_ID && 
                           process.env.HW_SECRET_ACCESS_KEY && 
                           process.env.HW_OBS_ENDPOINT && 
                           process.env.HW_OBS_BUCKET;
      const useObs = storageMode === 'obs' && obsConfigured;

      // 步骤1：从视频中提取音频
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File;
      
      if (!audioFile) {
        throw new Error('No audio file uploaded');
      }
      
      // 生成音频文件名
      const fileName = `audio-${uuidv4()}.mp3`;
      let obsAudioUrl = null;
      let localAudioUrl = '';
      const audioBuffer: Buffer = Buffer.from(await audioFile.arrayBuffer());
      
      // 保存到本地（不管使用哪种模式，都保存本地副本，方便离线处理）
      const uploadDir = join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localFilePath = join(uploadDir, fileName);
      await writeFile(localFilePath, audioBuffer);
      localAudioUrl = `/uploads/${fileName}`;
      
      // 如果配置了OBS，也保存到OBS
      if (useObs) {
        obsAudioUrl = await uploadToObs(audioBuffer, fileName, 'audio/mp3');
      }
      
      // 更新视频记录中的音频URL
      // 优先使用OBS URL，如果没有则使用本地URL
      video.audioUrl = obsAudioUrl || localAudioUrl;
      await video.save();
      
      // 步骤2：创建离线转写任务
      const task = await TranscriptionTask.create({
        videoId: new mongoose.Types.ObjectId(id),
        localAudioUrl,
        obsAudioUrl,
        status: 'pending'
      });
      
      // 设置视频状态为"等待处理"
      video.status = 'pending';
      await video.save();
      
      return NextResponse.json({ 
        video,
        task: {
          id: task._id,
          status: task.status,
          createdAt: task.createdAt
        }
      });
    } catch (error) {
      // 更新视频状态为错误
      video.status = 'error';
      await video.save();
      
      console.error('Error processing video:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in process-all:', error);
    return NextResponse.json(
      { error: 'Failed to process video' },
      { status: 500 }
    );
  }
} 