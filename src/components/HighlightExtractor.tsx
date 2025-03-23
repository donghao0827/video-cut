import { useState, useEffect } from 'react';
import axios from 'axios';
import { IHighlight } from '@/lib/db/models/video';
import useVideoStore from '@/lib/stores/videoStore';

interface HighlightExtractorProps {
  videoId: string;
}

export default function HighlightExtractor({ videoId }: HighlightExtractorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [minDuration, setMinDuration] = useState<number>(15);
  const [maxDuration, setMaxDuration] = useState<number>(30);
  const [showHighlights, setShowHighlights] = useState<boolean>(false);
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  
  const { videos, updateVideo } = useVideoStore();
  // 在VideoStore中查找视频，同时兼容id和_id字段
  const video = videos.find((v: any) => v.id === videoId || v._id === videoId);
  
  // 当视频数据变化时，如果有highlights，则显示它们
  useEffect(() => {
    if (video?.highlights && video.highlights.length > 0 && !showHighlights) {
      setHighlights(video.highlights);
      setShowHighlights(true);
    }
  }, [video, showHighlights]);
  
  // 提取高价值片段
  const extractHighlights = async () => {
    try {
      setProgress('正在提取高价值片段...');
      setError(null);
      setIsProcessing(true);
      
      // 调用API提取高价值片段
      const response = await axios.post(`/api/videos/${videoId}/extract-highlights`, {
        minDuration,
        maxDuration
      });
      
      if (response.data.success && response.data.highlights) {
        setHighlights(response.data.highlights);
        setShowHighlights(true);
        
        // 获取更新后的视频数据
        const updatedVideoResponse = await axios.get(`/api/videos/${videoId}`);
        // 确保id字段设置正确
        updateVideo({
          ...updatedVideoResponse.data, 
          id: updatedVideoResponse.data._id || updatedVideoResponse.data.id
        });
        
        setProgress('高价值片段提取完成!');
        
        // 在显示成功消息2秒后重置状态
        setTimeout(() => {
          setProgress('');
          setIsProcessing(false);
        }, 2000);
      } else {
        throw new Error('未能提取高价值片段');
      }
    } catch (error: any) {
      console.error('提取高价值片段出错:', error);
      const errorMessage = error.response?.data?.message || error.message || '提取高价值片段失败';
      setError(errorMessage);
      setIsProcessing(false);
      setProgress('');
    }
  };
  
  // 切换显示高价值片段
  const toggleHighlights = () => {
    if (video?.highlights && video.highlights.length > 0 && !showHighlights) {
      setHighlights(video.highlights);
      setShowHighlights(true);
    } else {
      setShowHighlights(!showHighlights);
    }
  };
  
  // 格式化时间函数
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="mt-4 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">提取高价值片段</h2>
      
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="minDuration" className="block text-sm font-medium text-gray-700 mb-1">
            最小时长 (秒)
          </label>
          <input
            type="number"
            id="minDuration"
            value={minDuration}
            onChange={(e) => setMinDuration(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="5"
            max={maxDuration}
          />
        </div>
        <div>
          <label htmlFor="maxDuration" className="block text-sm font-medium text-gray-700 mb-1">
            最大时长 (秒)
          </label>
          <input
            type="number"
            id="maxDuration"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min={minDuration}
            max="120"
          />
        </div>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={extractHighlights}
          disabled={isProcessing || !video?.subtitleUrl}
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium ${
            isProcessing || !video?.subtitleUrl
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isProcessing 
            ? (progress || '处理中...') 
            : video?.subtitleUrl 
              ? '提取高价值片段' 
              : '请先生成字幕'}
        </button>
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-red-500">
          {error}
        </div>
      )}
      
      {/* 高价值片段列表 */}
      {showHighlights && highlights.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">高价值片段列表</h3>
          <div className="space-y-3">
            {highlights.map((highlight, index) => (
              <div
                key={index}
                className="p-3 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">
                    {formatTime(highlight.start)} - {formatTime(highlight.end)} 
                    ({Math.round(highlight.end - highlight.start)}秒)
                  </span>
                  <button
                    onClick={() => {
                      const videoElement = document.querySelector('video');
                      if (videoElement) {
                        videoElement.currentTime = highlight.start;
                        videoElement.play();
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm cursor-pointer"
                  >
                    播放片段
                  </button>
                </div>
                <div className="text-gray-800">{highlight.text}</div>
                <div className="mt-1 text-sm text-gray-600 italic">
                  <span className="font-medium">原因：</span>{highlight.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 