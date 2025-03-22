import { useState } from 'react';
import axios from 'axios';
import { useVideoStore } from '@/lib/store/videoStore';
import { ITimestamp } from '@/lib/db/models/video';

interface TranscriptViewerProps {
  videoId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function TranscriptViewer({ videoId, videoRef }: TranscriptViewerProps) {
  const { videos, updateVideo, setError } = useVideoStore();
  const [processing, setProcessing] = useState(false);
  
  // 从视频库中查找视频
  const video = videos.find(v => v._id === videoId);
  
  const transcribeAudio = async () => {
    if (!video || !video.audioUrl) return;
    
    try {
      setProcessing(true);
      
      const response = await axios.post(`/api/videos/${videoId}/transcribe`);
      
      updateVideo(response.data.video);
    } catch (error) {
      console.error('音频转录失败:', error);
      setError('音频转录失败');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleTimestampClick = (timestamp: ITimestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp.start;
      videoRef.current.play();
    }
  };
  
  // 格式化时间为 MM:SS 格式
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  if (!video) {
    return <div>未找到视频</div>;
  }
  
  return (
    <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">视频转录</h2>
      
      {!video.audioUrl ? (
        <div className="text-gray-500 mb-4">
          请先提取音频以生成转录文本
        </div>
      ) : video.transcript ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">完整转录</h3>
          <div className="p-4 bg-gray-50 rounded-md max-h-40 overflow-y-auto">
            {video.transcript}
          </div>
          
          <h3 className="text-lg font-medium mt-4">时间轴</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {video.timestamps?.map((timestamp, index) => (
              <div 
                key={index}
                onClick={() => handleTimestampClick(timestamp)}
                className="p-3 bg-gray-50 rounded-md hover:bg-blue-50 cursor-pointer transition-colors flex"
              >
                <span className="text-gray-500 font-mono whitespace-nowrap mr-2">
                  {formatTime(timestamp.start)}
                </span>
                <span>{timestamp.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={transcribeAudio}
            disabled={processing}
            className={`w-full py-2 px-4 rounded-md text-white font-medium ${
              processing ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {processing ? '处理中...' : '生成转录文本'}
          </button>
        </div>
      )}
    </div>
  );
} 