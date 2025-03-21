import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import { Video } from '@/lib/db/models/video';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { uploadToObs } from '@/lib/storage/obsClient';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id } = await params;
    
    // Find video
    const video = await Video.findById(id);
    
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    // Update video status
    video.status = 'processing';
    await video.save();
    
    try {
      // Process form data
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File;
      
      if (!audioFile) {
        throw new Error('No audio file uploaded');
      }
      
      // Generate a new filename for the extracted audio
      const fileName = `audio-${uuidv4()}.mp3`;
      
      // 获取存储模式配置
      const storageMode = process.env.STORAGE_MODE || 'local';
      
      // 检查是否配置了OBS
      const obsConfigured = process.env.HW_ACCESS_KEY_ID && 
                           process.env.HW_SECRET_ACCESS_KEY && 
                           process.env.HW_OBS_ENDPOINT && 
                           process.env.HW_OBS_BUCKET;
      
      // 决定使用哪种存储方式
      const useObs = storageMode === 'obs' && obsConfigured;
      
      let audioUrl = '';
      
      if (useObs) {
        // 使用OBS存储音频
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        audioUrl = await uploadToObs(buffer, fileName, 'audio/mp3');
      } else {
        // 使用本地存储
        const filePath = join(process.cwd(), 'public', 'uploads', fileName);
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        await writeFile(filePath, buffer);
        audioUrl = `/uploads/${fileName}`;
      }
      
      // Update the video record
      video.audioUrl = audioUrl;
      video.status = 'ready';
      await video.save();
      
      return NextResponse.json({ video });
    } catch (error) {
      // Update video status to error if processing fails
      video.status = 'error';
      await video.save();
      
      throw error;
    }
  } catch (error) {
    console.error('Error extracting audio:', error);
    return NextResponse.json(
      { error: 'Failed to extract audio' },
      { status: 500 }
    );
  }
} 