import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import VideoModel from '@/lib/db/models/video';
import axios from 'axios';
import { join } from 'path';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface HighlightSegment {
  start: number;
  end: number;
  text: string;
  reason: string;
}

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

// 默认提取15-30秒的片段
const DEFAULT_MIN_DURATION = 15;
const DEFAULT_MAX_DURATION = 30;

// 解析SRT格式字幕
async function parseSubtitlesFromUrl(subtitleUrl: string): Promise<Subtitle[]> {
  try {
    // 判断是否为完整URL或相对路径
    let url = subtitleUrl;
    if (subtitleUrl.startsWith('/')) {
      // 如果是相对路径，使用完整路径
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      url = `${baseUrl}${subtitleUrl}`;
    }
    
    // 获取字幕文件内容
    const response = await axios.get(url);
    const content = response.data;
    
    // 检查是否是JSON格式
    if (Array.isArray(content)) {
      // 如果是JSON格式，直接返回
      return content.map((item: any) => ({
        start: typeof item.start === 'number' ? item.start : timeToSeconds(item.start),
        end: typeof item.end === 'number' ? item.end : timeToSeconds(item.end),
        text: item.text
      }));
    }
    
    // 处理SRT文本格式
    if (typeof content === 'string') {
      return parseSrtContent(content);
    }
    
    throw new Error('不支持的字幕格式');
  } catch (error) {
    console.error('解析字幕出错:', error);
    throw new Error('无法解析字幕文件');
  }
}

// 手动解析SRT内容
function parseSrtContent(content: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const blocks = content.trim().split('\n\n');
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      // 第一行是序号，第二行是时间，第三行开始是文本
      const timeLine = lines[1];
      const timeMatch = timeLine.match(/(\d+:\d+:\d+,\d+)\s*-->\s*(\d+:\d+:\d+,\d+)/);
      
      if (timeMatch) {
        const startTime = timeToSeconds(timeMatch[1]);
        const endTime = timeToSeconds(timeMatch[2]);
        const text = lines.slice(2).join(' ').trim();
        
        subtitles.push({
          start: startTime,
          end: endTime,
          text: text
        });
      }
    }
  }
  
  return subtitles;
}

// 将SRT时间格式转换为秒数
function timeToSeconds(timeString: string): number {
  if (typeof timeString === 'number') return timeString;
  
  // SRT格式: 00:00:00,000 或 00:00:00.000
  const match = timeString.replace('.', ',').match(/(\d+):(\d+):(\d+),(\d+)/);
  
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const milliseconds = parseInt(match[4], 10);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }
  
  return 0;
}

/**
 * 提取高价值片段
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id } = await params;
    const body = await req.json();
    const { minDuration = DEFAULT_MIN_DURATION, maxDuration = DEFAULT_MAX_DURATION } = body;
    
    // 查找视频
    const video = await VideoModel.findById(id);
    
    if (!video) {
      return NextResponse.json(
        { error: '视频未找到' },
        { status: 404 }
      );
    }
    
    // 检查视频是否有字幕URL
    if (!video.subtitleUrl) {
      return NextResponse.json(
        { error: '视频没有字幕URL，请先生成字幕' },
        { status: 400 }
      );
    }
    
    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: '未配置DeepSeek API密钥' },
        { status: 500 }
      );
    }
    
    try {
      // 从字幕URL获取字幕数据
      const subtitles = await parseSubtitlesFromUrl(video.subtitleUrl);
      
      // 构建字幕文本
      const subtitleText = subtitles.map(subtitle => 
        `[${subtitle.start}-${subtitle.end}] ${subtitle.text}`
      ).join('\n');
      
      // 调用DeepSeek API提取高价值片段
      const response = await axios.post(
        DEEPSEEK_API_URL,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `你是一个专业的视频内容分析助手。请从以下带有时间戳的字幕文本中，提取最有价值、最精彩的片段。
每个片段应该在${minDuration}到${maxDuration}秒之间。分析内容的价值、信息密度、观点独特性或情感共鸣点。
返回JSON格式的结果，包含start（开始时间，秒）、end（结束时间，秒）、text（文本内容）和reason（为什么这是高价值片段的原因）。
格式如下：
[
  {
    "start": 数字(秒),
    "end": 数字(秒),
    "text": "片段文本",
    "reason": "选择理由"
  },
  ...
]`
            },
            {
              role: 'user',
              content: subtitleText
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // 解析响应
      const llmResponse = response.data.choices[0].message.content;
      
      // 提取JSON部分
      let jsonStartIndex = llmResponse.indexOf('[');
      let jsonEndIndex = llmResponse.lastIndexOf(']') + 1;
      let jsonStr = '';
      
      if (jsonStartIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        jsonStr = llmResponse.substring(jsonStartIndex, jsonEndIndex);
      } else {
        throw new Error('未能从DeepSeek响应中提取JSON结果');
      }
      
      let highlights: HighlightSegment[] = [];
      
      try {
        highlights = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('解析DeepSeek返回的JSON失败:', parseError);
        throw new Error('解析高价值片段结果失败');
      }
      
      // 保存提取结果到视频记录
      video.highlights = highlights;
      await video.save();
      
      return NextResponse.json({
        success: true,
        highlights: highlights
      });
    } catch (error: any) {
      console.error('调用DeepSeek API失败:', error);
      
      return NextResponse.json(
        { 
          error: '提取高价值片段失败',
          message: error.message || '未知错误'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('提取高价值片段时出错:', error);
    
    return NextResponse.json(
      { 
        error: '提取高价值片段失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
} 