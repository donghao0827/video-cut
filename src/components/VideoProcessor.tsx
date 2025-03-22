import { useState, useEffect } from 'react';
import axios from 'axios';
import { useVideoStore } from '@/lib/store/videoStore';

interface VideoProcessorProps {
  videoId: string;
  videoUrl?: string;
}

export default function VideoProcessor({ videoId, videoUrl }: VideoProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setLocalError] = useState<string | null>(null);
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [isOfflineTaskCreated, setIsOfflineTaskCreated] = useState(false);
  const { updateVideo } = useVideoStore();
  
  // 加载组件时检查视频是否已有字幕
  useEffect(() => {
    const checkSubtitlesStatus = async () => {
      try {
        const videoResponse = await axios.get(`/api/videos/${videoId}`);
        const videoData = videoResponse.data;
        setHasSubtitles(videoData.hasSubtitles || 
          (videoData.subtitles && videoData.subtitles.length > 0));
      } catch (error) {
        console.error('检查字幕状态出错:', error);
      }
    };
    
    checkSubtitlesStatus();
  }, [videoId]);
  
  // 轮询检查字幕生成状态
  const pollSubtitleStatus = async (taskId: string, maxAttempts = 30, intervalMs = 2000) => {
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        if (attempts >= maxAttempts) {
          throw new Error('字幕生成超时，请稍后再试');
        }
        
        attempts++;
        setProgress(`正在生成字幕...${Math.round((attempts / maxAttempts) * 100)}%`);
        
        const statusResponse = await axios.get(`http://localhost:8000/api/subtitle/${taskId}`);
        const statusData = statusResponse.data;
        if (statusData.status === 'success') {
          // 任务完成，返回结果
          return statusData;
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
          throw new Error('字幕生成失败: ' + (statusData.message || '未知错误'));
        } else {
          // 任务仍在进行中，继续轮询
          return new Promise((resolve) => {
            setTimeout(() => resolve(checkStatus()), intervalMs);
          });
        }
      } catch (error) {
        console.error('轮询字幕状态出错:', error);
        throw error;
      }
    };
    
    return checkStatus();
  };
  
  const processVideo = async () => {
    try {
      setProgress('正在获取视频信息...');
      setLocalError(null);
      
      // 获取视频URL
      let url = videoUrl;
      if (!url) {
        // 从标准API获取视频信息
        const videoResponse = await axios.get(`/api/videos/${videoId}`);
        url = videoResponse.data.url;
        
        if (!url) {
          setProgress('');
          setIsProcessing(false);
          setLocalError('视频已上传，但未存储视频地址。请重新上传视频或联系管理员。');
          return;
        }
      }
      
      // 调用后端API处理字幕提取
      setProgress('正在提交处理请求...');
      
      // 调用统一的字幕生成API
      const response = await axios.post(`/api/videos/${videoId}/generate-subtitle`, {
        mediaUrl: url
      });
      
      // 检查响应类型
      if (response.data.taskCreated) {
        // 后端创建了离线任务
        setIsOfflineTaskCreated(true);
        setProgress('离线任务已创建');
        
        // 在显示成功消息2秒后重置状态
        setTimeout(() => {
          setProgress('');
          setIsProcessing(false);
        }, 2000);
      } else if (response.data.task_id) {
        // 获取任务ID并开始轮询
        const taskId = response.data.task_id;
        setProgress('正在生成字幕...0%');
        
        // 开始轮询检查任务状态
        const result = await pollSubtitleStatus(taskId);
        
        if (result.subtitles || result.subtitle_url) {
          // 任务完成，更新数据库
          const subtitles = result.subtitles || [];
          const subtitleUrl = result.subtitle_url || null;
          
          // 更新视频数据，包括hasSubtitles状态和字幕URL
          await axios.patch(`/api/videos/${videoId}`, {
            subtitles: subtitles,
            hasSubtitles: true,
            subtitleUrl: subtitleUrl
          });
          
          // 获取更新后的视频数据
          const updatedVideoResponse = await axios.get(`/api/videos/${videoId}`);
          updateVideo(updatedVideoResponse.data);
          setHasSubtitles(true);
          setProgress('处理完成!');
          
          // 在显示成功消息2秒后重置状态
          setTimeout(() => {
            setProgress('');
            setIsProcessing(false);
          }, 2000);
        } else {
          throw new Error('未获取到字幕或字幕地址');
        }
      } else if (response.data.subtitles) {
        // 兼容直接返回字幕的情况（旧API）
        const subtitles = response.data.subtitles;
        
        // 更新视频数据
        await axios.patch(`/api/videos/${videoId}`, {
          subtitles: subtitles,
          hasSubtitles: true
        });
        
        // 获取更新后的视频数据
        const updatedVideoResponse = await axios.get(`/api/videos/${videoId}`);
        updateVideo(updatedVideoResponse.data);
        setHasSubtitles(true);
        setProgress('处理完成!');
        
        // 在显示成功消息2秒后重置状态
        setTimeout(() => {
          setProgress('');
          setIsProcessing(false);
        }, 2000);
      } else {
        throw new Error('无效的响应数据，未包含任务ID或字幕');
      }
    } catch (error: unknown) {
      console.error('视频处理过程中出错:', error);
      const errorMessage = error instanceof Error ? error.message : '视频处理失败';
      setLocalError(errorMessage);
      setIsProcessing(false);
      setProgress('');
    }
  };

  const handleProcess = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    await processVideo();
  };

  return (
    <div className="mt-4">
      {hasSubtitles && !isProcessing && (
        <div className="mb-2 p-2 bg-green-100 text-green-800 rounded-md text-sm">
          ✓ 该视频已生成字幕
        </div>
      )}
      
      {isOfflineTaskCreated && !isProcessing && !hasSubtitles && (
        <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded-md text-sm">
          ⏱ 已创建离线任务，请等待人工处理
        </div>
      )}
      
      <button
        onClick={handleProcess}
        disabled={isProcessing || isOfflineTaskCreated}
        className={`w-full py-2 px-4 rounded-md text-white font-medium ${
          isProcessing || isOfflineTaskCreated
            ? 'bg-gray-400 cursor-not-allowed'
            : hasSubtitles 
              ? 'bg-blue-500 hover:bg-blue-600' 
              : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isProcessing 
          ? (progress || '处理中...') 
          : isOfflineTaskCreated
            ? '等待人工处理'
            : hasSubtitles 
              ? '重新生成字幕' 
              : '一键提取字幕'}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
} 