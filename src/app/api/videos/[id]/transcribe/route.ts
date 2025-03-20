import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import { Video, ITimestamp } from '@/lib/db/models/video';
import fs from 'fs';
import { join } from 'path';
import axios from 'axios';
import { FormData } from 'formdata-node';
import { fileFromPath } from 'formdata-node/file-from-path';
import { getFileFromObs } from '@/lib/storage/obsClient';

// OpenAI API密钥，应从环境变量获取
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
    
    if (!video.audioUrl) {
      return NextResponse.json(
        { error: 'No audio file available for this video' },
        { status: 400 }
      );
    }
    
    // Update video status
    video.status = 'processing';
    await video.save();
    
    try {
      // 检查环境变量中是否配置了OBS
      const useObs = process.env.HW_ACCESS_KEY_ID && process.env.HW_SECRET_ACCESS_KEY && 
                    process.env.HW_OBS_ENDPOINT && process.env.HW_OBS_BUCKET;
      
      // 临时文件路径，用于处理从OBS下载的音频文件
      const tempAudioPath = join(process.cwd(), 'tmp', `temp-${Date.now()}.mp3`);
      let audioBuffer: Buffer;
      
      if (useObs && video.audioUrl.startsWith('http')) {
        // 从OBS获取音频文件
        audioBuffer = await getFileFromObs(video.audioUrl);
        
        // 确保临时目录存在
        if (!fs.existsSync(join(process.cwd(), 'tmp'))) {
          fs.mkdirSync(join(process.cwd(), 'tmp'), { recursive: true });
        }
        
        // 写入临时文件用于API调用
        fs.writeFileSync(tempAudioPath, audioBuffer);
      } else {
        // 使用本地文件系统
        const audioFilePath = join(process.cwd(), 'public', video.audioUrl.substring(1));
        
        if (!fs.existsSync(audioFilePath)) {
          throw new Error('Audio file not found');
        }
        
        // 直接使用本地文件路径
        audioBuffer = fs.readFileSync(audioFilePath);
      }
      
      let transcript = '';
      let timestamps: ITimestamp[] = [];
      
      // 检查是否有API密钥来使用Whisper API
      if (OPENAI_API_KEY) {
        // 使用真实的Whisper API转录
        try {
          const formData = new FormData();
          
          // 根据是否使用OBS选择文件添加方式
          if (useObs && video.audioUrl.startsWith('http')) {
            formData.append('file', await fileFromPath(tempAudioPath));
            
            // 处理完成后删除临时文件
            try {
              fs.unlinkSync(tempAudioPath);
            } catch (e) {
              console.error('Failed to remove temp file:', e);
            }
          } else {
            const audioFilePath = join(process.cwd(), 'public', video.audioUrl.substring(1));
            formData.append('file', await fileFromPath(audioFilePath));
          }
          
          formData.append('model', 'whisper-1');
          formData.append('response_format', 'verbose_json');
          formData.append('timestamp_granularities[]', 'segment');
          
          const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              // FormData会自动设置正确的Content-Type
            }
          });
          
          // 解析API响应
          transcript = response.data.text;
          
          // 处理时间戳数据
          if (response.data.segments) {
            timestamps = response.data.segments.map((segment: {
              start: number;
              end: number;
              text: string;
            }) => ({
              start: segment.start,
              end: segment.end,
              text: segment.text
            }));
          }
        } catch (apiError) {
          console.error('Whisper API error:', apiError);
          throw new Error('Failed to transcribe with Whisper API');
        }
      } else {
        // 使用模拟数据进行演示
        transcript = "这是一段示例文字转录内容。这段内容将会显示在时间轴上。用户可以通过点击不同的时间点来跳转到视频的对应位置。";
        
        // 生成模拟的时间戳
        const words = transcript.split('。');
        let currentTime = 0;
        
        for (let i = 0; i < words.length; i++) {
          if (words[i].trim() === '') continue;
          
          const duration = words[i].length * 0.2; // 假设每个字符需要0.2秒
          timestamps.push({
            start: currentTime,
            end: currentTime + duration,
            text: words[i].trim() + '。'
          });
          
          currentTime += duration + 0.5; // 句子之间添加0.5秒的间隔
        }
      }
      
      // 更新视频记录
      video.transcript = transcript;
      video.timestamps = timestamps;
      video.status = 'ready';
      await video.save();
      
      return NextResponse.json({ video });
    } catch (error) {
      console.error('Error transcribing audio:', error);
      
      // Update video status to error if processing fails
      video.status = 'error';
      await video.save();
      
      throw error;
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
} 