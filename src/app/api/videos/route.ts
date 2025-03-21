import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import Video from '@/lib/db/models/video';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadToObs } from '@/lib/storage/obsClient';

// Helper to ensure uploads directory exists
const ensureUploadDir = async () => {
  try {
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await writeFile(join(uploadDir, '.gitkeep'), '');
    return uploadDir;
  } catch (error) {
    console.error('Error ensuring upload directory exists', error);
    throw error;
  }
};

export async function GET() {
  try {
    await connectToDatabase();
    
    // Fetch all videos
    const videos = await Video.find().sort({ createdAt: -1 });
    
    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    
    const formData = await req.formData();
    const videoFile = formData.get('video') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    
    if (!videoFile || !title) {
      return NextResponse.json(
        { error: 'Video file and title are required' },
        { status: 400 }
      );
    }
    
    // Generate unique filename
    const fileExt = videoFile.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    
    // 获取存储模式配置
    const storageMode = process.env.STORAGE_MODE || 'local';
    
    // 检查是否配置了OBS
    const obsConfigured = process.env.HW_ACCESS_KEY_ID && 
                         process.env.HW_SECRET_ACCESS_KEY && 
                         process.env.HW_OBS_ENDPOINT && 
                         process.env.HW_OBS_BUCKET;
    
    // 决定使用哪种存储方式
    const useObs = storageMode === 'obs' && obsConfigured;
    
    let videoUrl = '';
    
    if (useObs) {
      // 使用OBS存储视频
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      videoUrl = await uploadToObs(buffer, fileName, videoFile.type);
    } else {
      // 使用本地存储
      const uploadDir = await ensureUploadDir();
      const filePath = join(uploadDir, fileName);
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      await writeFile(filePath, buffer);
      videoUrl = `/uploads/${fileName}`;
    }
    
    // Create video document in database
    const video = await Video.create({
      title,
      description,
      url: videoUrl,
      originalUrl: videoUrl,
      status: 'uploaded',
    });
    
    return NextResponse.json({ video });
  } catch (error) {
    console.error('Error uploading video:', error);
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
} 