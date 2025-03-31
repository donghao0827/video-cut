import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connectDB';
import VideoModel from '@/lib/db/models/video';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

// 添加视频切片元数据接口
interface ClipMetadata {
  id: string;
  url: string;
  start: number;
  end: number;
  text: string;
  reason: string;
  duration: number;
  sourceVideoId: string;
  sourceVideoTitle: string;
  fileSize: number;
  resolution: string;
  createdAt: Date;
}

/**
 * 根据指定的开始和结束时间剪辑视频
 * @route POST /api/videos/:id/generate-clip
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 连接数据库
    await connectDB();
    
    // 获取请求体
    const { start, end, text, reason } = await request.json();
    
    // 验证参数
    if (typeof start !== 'number' || typeof end !== 'number') {
      return NextResponse.json(
        { success: false, error: '开始和结束时间必须是数字' },
        { status: 400 }
      );
    }
    
    // 验证视频ID并获取视频信息
    const videoId = params.id;
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: '缺少视频ID' },
        { status: 400 }
      );
    }
    
    // 查找视频
    const video = await VideoModel.findById(videoId);
    if (!video) {
      return NextResponse.json(
        { success: false, error: '未找到视频' },
        { status: 404 }
      );
    }
    
    // 检查视频URL
    if (!video.url) {
      return NextResponse.json(
        { success: false, error: '未找到视频文件URL' },
        { status: 400 }
      );
    }
    
    // 构建文件路径
    const publicDir = path.join(process.cwd(), 'public');
    const videoPath = path.join(publicDir, video.url.startsWith('/') ? video.url.slice(1) : video.url);
    
    // 创建输出目录
    const clipsDir = path.join(publicDir, 'clips');
    await fs.mkdir(clipsDir, { recursive: true });
    
    // 设置文件权限以确保可访问性
    try {
      await fs.chmod(clipsDir, 0o755);
    } catch (error) {
      console.error('设置目录权限失败:', error);
    }
    
    // 生成输出文件名 - 使用更安全的文件名生成方式
    const clipId = uuidv4().slice(0, 8);
    const timestamp = Date.now();
    const clipFileName = `clip_${videoId.slice(0, 8)}_${clipId}_${timestamp}.mp4`;
    const clipPath = path.join(clipsDir, clipFileName);
    const clipUrl = `/clips/${clipFileName}`;
    
    // 准备元数据对象
    const clipMetadata: ClipMetadata = {
      id: clipId,
      url: clipUrl,
      start,
      end,
      text,
      reason: reason || '',
      duration: end - start,
      sourceVideoId: videoId,
      sourceVideoTitle: video.title || '',
      fileSize: 0,
      resolution: '',
      createdAt: new Date()
    };
    
    // 使用FFmpeg剪辑视频
    try {
      console.log('开始处理视频:', videoPath);
      console.log('输出位置:', clipPath);
      
      // 为视频添加时间戳水印
      const command = `ffmpeg -i "${videoPath}" -ss ${start} -to ${end} `
        + `-vf "drawtext=text='%{pts\\:hms}':x=10:y=10:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5" `
        + `-c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k `
        + `-movflags +faststart "${clipPath}"`;
      
      console.log('执行FFmpeg命令:', command);
      
      // 执行FFmpeg命令，忽略stdout和stderr
      await execAsync(command);
      
      // 检查文件是否生成
      const fileExists = await fs.access(clipPath).then(() => true).catch(() => false);
      console.log('文件是否生成:', fileExists);
      
      if (!fileExists) {
        throw new Error('视频文件未成功生成');
      }
      
      // 使用ffprobe获取视频信息
      const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${clipPath}"`;
      const { stdout: resolution } = await execAsync(ffprobeCommand);
      
      // 获取文件大小
      const stats = await fs.stat(clipPath);
      
      // 更新元数据
      clipMetadata.fileSize = stats.size;
      clipMetadata.resolution = resolution.trim();
      
      console.log('文件生成成功:', clipMetadata);
      
    } catch (error) {
      console.error('FFmpeg执行失败:', error);
      return NextResponse.json(
        { success: false, error: '视频剪辑失败' },
        { status: 500 }
      );
    }
    
    // 更新视频记录，添加片段信息
    if (!video.clips) {
      video.clips = [];
    }
    
    // 添加新的片段信息
    console.log('更新前clips长度:', video.clips.length);

    // 直接使用Mongoose更新操作而不是save()
    try {
      // 使用findByIdAndUpdate替代save
      const updateResult = await VideoModel.findByIdAndUpdate(
        videoId,
        { 
          $push: { 
            clips: clipMetadata 
          } 
        },
        { new: true, runValidators: true }
      );
      
      console.log('数据库更新结果:', updateResult ? '成功' : '失败');
      
      if (!updateResult) {
        throw new Error('数据库更新失败: 未返回更新后的文档');
      }
      
      // 手动检查clips是否已更新
      const verifyUpdate = await VideoModel.findById(videoId);
      console.log('验证后clips长度:', verifyUpdate?.clips?.length || 0);
      
      if (!verifyUpdate?.clips || verifyUpdate.clips.length <= video.clips.length) {
        console.warn('警告: clips数组似乎没有更新，但数据库操作没有报错');
      }
    } catch (dbError) {
      console.error('数据库更新失败:', dbError);
      return NextResponse.json(
        { success: false, error: '保存到数据库失败: ' + (dbError instanceof Error ? dbError.message : String(dbError)) },
        { status: 500 }
      );
    }
    
    // 设置生成的视频文件权限
    try {
      await fs.chmod(clipPath, 0o644);
      console.log('设置文件权限成功');
    } catch (error) {
      console.error('设置文件权限失败:', error);
    }
    
    return NextResponse.json({
      success: true,
      clipId: clipId,
      clipUrl,
      metadata: clipMetadata,
      message: '视频片段生成成功'
    });
  } catch (error) {
    console.error('生成视频片段时出错:', error);
    return NextResponse.json(
      { success: false, error: '生成视频片段失败' },
      { status: 500 }
    );
  }
} 