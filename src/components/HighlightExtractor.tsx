import { useState, useEffect } from 'react';
import axios from 'axios';
import { IHighlight, IVideo, IClip } from '@/lib/db/models/video';
import useVideoStore from '@/lib/stores/videoStore';

interface HighlightExtractorProps {
  videoId: string;
}

interface VideoWithId extends IVideo {
  id?: string;
  _id?: string;
}

export default function HighlightExtractor({ videoId }: HighlightExtractorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [minDuration, setMinDuration] = useState<number>(15);
  const [maxDuration, setMaxDuration] = useState<number>(30);
  const [showHighlights, setShowHighlights] = useState<boolean>(false);
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  const [generatingVideo, setGeneratingVideo] = useState<number | null>(null);
  const [showClips, setShowClips] = useState<boolean>(false);
  const [previewClip, setPreviewClip] = useState<IClip | null>(null);
  
  const { videos, updateVideo } = useVideoStore();
  // 在VideoStore中查找视频，同时兼容id和_id字段
  const video = videos.find((v: VideoWithId) => v.id === videoId || v._id === videoId);
  
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
    } catch (error: unknown) {
      console.error('提取高价值片段出错:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : '提取高价值片段失败';
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
  
  // 切换显示已生成片段
  const toggleClips = () => {
    setShowClips(!showClips);
    // 关闭预览
    setPreviewClip(null);
  };
  
  // 格式化时间函数
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 格式化日期函数
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 生成片段视频函数
  const generateClip = async (highlight: IHighlight, index: number) => {
    if (!video) return;
    
    try {
      setGeneratingVideo(index);
      
      // 调用API剪辑视频片段
      const response = await axios.post(`/api/videos/${videoId}/generate-clip`, {
        start: highlight.start,
        end: highlight.end,
        text: highlight.text,
        reason: highlight.reason
      });
      
      console.log('视频生成API响应:', response.data);
      
      if (response.data.success && response.data.clipUrl) {
        // 强制刷新视频数据
        try {
          // 获取更新后的视频数据
          const updatedVideoResponse = await axios.get(`/api/videos/${videoId}`);
          console.log('获取更新后的视频数据:', updatedVideoResponse.data);
          
          // 检查clips是否存在并输出长度
          if (updatedVideoResponse.data.clips) {
            console.log('获取到的clips数量:', updatedVideoResponse.data.clips.length);
          } else {
            console.warn('警告: 获取到的视频数据中没有clips字段');
          }
          
          // 更新视频数据
          updateVideo({
            ...updatedVideoResponse.data, 
            id: updatedVideoResponse.data._id || updatedVideoResponse.data.id
          });
          
          // 确保显示切片列表
          setTimeout(() => {
            setShowClips(true);
          }, 500);
          
          // 显示成功消息
          alert('视频片段生成成功! 片段URL: ' + response.data.clipUrl);
        } catch (refreshError) {
          console.error('刷新视频数据失败:', refreshError);
          alert('视频生成成功，但刷新数据失败，请刷新页面查看。');
        }
      } else {
        throw new Error('生成视频片段失败: ' + (response.data.error || '未知错误'));
      }
    } catch (error: unknown) {
      console.error('生成视频片段出错:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : '生成视频片段失败';
      alert(errorMessage);
    } finally {
      setGeneratingVideo(null);
    }
  };
  
  // 预览片段
  const handlePreviewClip = (clip: IClip) => {
    console.log('预览片段:', clip);
    // 检查URL是否有效
    if (!clip.url) {
      alert('视频URL无效');
      return;
    }
    
    // 标准化URL格式
    let videoUrl = clip.url;
    if (!videoUrl.startsWith('/') && !videoUrl.startsWith('http')) {
      videoUrl = `/${videoUrl}`;
    }
    
    // 创建一个新的clip对象，确保URL正确
    const normalizedClip = {
      ...clip,
      url: videoUrl
    };
    
    setPreviewClip(normalizedClip);
  };
  
  // 下载片段
  const handleDownloadClip = (clip: IClip) => {
    console.log('下载片段:', clip);
    
    // 标准化URL格式
    let videoUrl = clip.url;
    if (!videoUrl.startsWith('/') && !videoUrl.startsWith('http')) {
      videoUrl = `/${videoUrl}`;
    }
    
    // 创建一个隐藏的a标签进行下载
    const link = document.createElement('a');
    link.href = videoUrl;
    // 获取文件名
    const filename = videoUrl.split('/').pop() || `视频片段_${formatTime(clip.start)}-${formatTime(clip.end)}.mp4`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '未知';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
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
      
      <div className="flex space-x-2 mb-4">
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
        
        {video?.highlights && video.highlights.length > 0 && (
          <button
            onClick={() => toggleHighlights()}
            className="py-2 px-4 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {showHighlights ? '隐藏片段' : '显示片段'}
          </button>
        )}
        
        {video?.clips && video.clips.length > 0 && (
          <button
            onClick={toggleClips}
            className="py-2 px-4 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 text-green-800"
          >
            {showClips ? '隐藏已生成视频' : `查看已生成视频 (${video.clips.length})`}
          </button>
        )}
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-red-500">
          {error}
        </div>
      )}
      
      {/* 视频预览区域 */}
      {previewClip && (
        <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">预览视频片段</h3>
            <button 
              onClick={() => setPreviewClip(null)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              关闭预览
            </button>
          </div>
          <video 
            src={previewClip.url} 
            controls 
            autoPlay
            className="w-full rounded-md" 
            style={{ maxHeight: '400px' }}
            onError={(e) => {
              console.error('视频加载失败:', e, previewClip.url);
              alert(`视频加载失败: ${previewClip.url}`);
            }}
          />
          <div className="mt-2 text-sm text-gray-700">
            <p><span className="font-medium">时间段:</span> {formatTime(previewClip.start)} - {formatTime(previewClip.end)}</p>
            <p><span className="font-medium">内容:</span> {previewClip.text}</p>
            <p><span className="font-medium">视频地址:</span> <span className="text-xs break-all">{previewClip.url}</span></p>
          </div>
          <div className="flex space-x-3 mt-3">
            <button
              onClick={() => handleDownloadClip(previewClip)}
              className="mt-3 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              下载此片段
            </button>
            <button
              onClick={() => {
                // 在新标签中打开视频
                window.open(previewClip.url, '_blank');
              }}
              className="mt-3 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              在新标签中打开
            </button>
          </div>
        </div>
      )}
      
      {/* 已生成视频片段列表 */}
      {showClips && video?.clips && video.clips.length > 0 && (
        <div className="mb-8">
          <h3 className="font-medium mb-3">已生成视频片段</h3>
          <div className="space-y-3">
            {video.clips.map((clip, index) => (
              <div
                key={clip.id || index}
                className="p-3 border border-green-200 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-800">
                    片段 #{index + 1}: {formatTime(clip.start)} - {formatTime(clip.end)} 
                    ({Math.round(clip.duration || clip.end - clip.start)}秒)
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePreviewClip(clip)}
                      className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      预览
                    </button>
                    <button
                      onClick={() => handleDownloadClip(clip)}
                      className="text-sm px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                    >
                      下载
                    </button>
                  </div>
                </div>
                <div className="text-gray-700 text-sm">{clip.text}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>生成时间: {formatDate(clip.createdAt)}</div>
                  {clip.fileSize && (
                    <div>文件大小: {formatFileSize(clip.fileSize)}</div>
                  )}
                  {clip.resolution && (
                    <div>分辨率: {clip.resolution}</div>
                  )}
                  {clip.sourceVideoTitle && (
                    <div>源视频: {clip.sourceVideoTitle}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
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
                  <div className="flex space-x-2">
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
                    <button
                      onClick={() => generateClip(highlight, index)}
                      disabled={generatingVideo === index}
                      className={`text-sm px-3 py-1 rounded text-white ${
                        generatingVideo === index 
                          ? "bg-gray-400 cursor-not-allowed" 
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {generatingVideo === index ? "处理中..." : "生成视频"}
                    </button>
                  </div>
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