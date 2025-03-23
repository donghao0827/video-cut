import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { ISubtitle } from '@/lib/db/models/video';

interface VideoPlayerProps {
  videoUrl: string;
  subtitleUrl?: string;
  title?: string;
}

export default function VideoPlayer({ videoUrl, subtitleUrl, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls] = useState(true);
  const [subtitles, setSubtitles] = useState<ISubtitle[]>([])
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');

  useEffect(() => {
    if (subtitleUrl) {
      axios.get(subtitleUrl).then((res) => {
        const lines = res.data.split('\n')
        const subtitles: ISubtitle[] = []
        for (let i = 0; i < lines.length; i+=4) {
          const index = parseInt(lines[i])
          if (index) {
            const time = lines[i+1]?.split('-->')
            const start = time[0].trim()
            const end = time[1].trim()
            const text = lines[i+2]
  
            subtitles.push({ start, end, text })
          }
        }
        setSubtitles(subtitles)
      })
    }
  }, [subtitleUrl])
  
  // 监听视频时间更新，显示对应的字幕
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // 查找当前时间对应的字幕
      if (subtitles && subtitles.length > 0) {
        const currentSub = subtitles.find(
          sub => video.currentTime >= timeToSeconds(sub.start) && video.currentTime <= timeToSeconds(sub.end)
        );
        
        setCurrentSubtitle(currentSub ? currentSub.text : '');
      }
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [subtitles]);


  
  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden">
      {/* 视频标题 */}
      {title && (
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent z-10 text-white">
          <h3 className="font-medium">{title}</h3>
        </div>
      )}
      
      {/* 视频播放器 */}
      <div className="relative w-full">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full rounded-lg h-[300px]"
          controls={showControls}
          controlsList="nodownload"
        />
        
        {/* 字幕显示区域 */}
        {currentSubtitle && (
          <div className="absolute bottom-14 left-0 right-0 text-center px-4 py-2">
            <div className="inline-block bg-black/70 text-white px-4 py-2 rounded-lg text-lg max-w-[90%]">
              {currentSubtitle}
            </div>
          </div>
        )}
      </div>
      
      {/* 字幕列表 */}
      {subtitles && subtitles.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
          <h3 className="font-medium mb-2">字幕列表</h3>
          <div className="space-y-2">
            {subtitles.map((subtitle, index) => (
              <div
                key={index}
                className={`p-2 rounded-md cursor-pointer transition-colors ${
                  currentTime >= subtitle.start && currentTime <= subtitle.end
                    ? 'bg-blue-100'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = subtitle.start;
                    videoRef.current.play();
                  }
                }}
              >
                <div className="flex items-center">
                  <span className="text-gray-500 text-sm mr-2">
                    {subtitle.start}
                  </span>
                  <span>{subtitle.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeToSeconds(timeString: string) {
  // 分割毫秒部分
  const [timePart, milliseconds] = timeString.split(',');
  
  // 分割时、分、秒
  const parts = timePart.split(':').map(Number);
  
  // 计算总秒数（兼容不同长度格式，如 MM:SS 或 HH:MM:SS）
  let total = 0;
  const units = [3600, 60, 1]; // 对应时、分、秒的转换系数
  while (parts.length > 0) {
    total += (parts.pop() || 0) * (units.pop() || 1);
  }
  
  // 添加毫秒（最多保留3位小数）
  return total + (milliseconds ? parseInt(milliseconds, 10) / 1000 : 0);
}    // 输出 150