import { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import useVideoStore from '@/lib/stores/videoStore';
// import AudioExtractor from './AudioExtractor';
// import TranscriptViewer from './TranscriptViewer';
import VideoProcessor from './VideoProcessor';
import VideoPlayer from './VideoPlayer';
import HighlightExtractor from './HighlightExtractor';

export default function VideoEditor({ videoId }: { videoId: string }) {
  const { videos, updateVideo, setError, setVideos } = useVideoStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 在组件加载时获取视频数据
  useEffect(() => {
    async function fetchVideoData() {
      try {
        setLoading(true);
        const response = await axios.get(`/api/videos/${videoId}`);
        // 如果videos为空，添加当前视频
        if (videos.length === 0) {
          setVideos([response.data]);
        } else {
          // 更新现有视频
          updateVideo({ ...response.data, id: response.data._id || response.data.id });
        }
      } catch (error) {
        console.error('获取视频数据失败:', error);
        setError('无法加载视频数据');
      } finally {
        setLoading(false);
      }
    }

    fetchVideoData();
  }, [videoId, setVideos, updateVideo, setError, videos.length]);

  // Find the video from the store - 同时兼容id和_id字段
  const video = videos.find(v => v.id === videoId || v._id === videoId);

  useEffect(() => {
    if (videoRef.current && video) {
      videoRef.current.addEventListener('loadedmetadata', () => {
        if (videoRef.current) {
          const videoDuration = videoRef.current.duration;
          setDuration(videoDuration);
          setEndTime(videoDuration);
        }
      });
    }
  }, [video]);

  const handleStartTimeChange = (value: number) => {
    // Ensure start time doesn't exceed end time
    if (value < endTime) {
      setStartTime(value);
    }
  };

  const handleEndTimeChange = (value: number) => {
    // Ensure end time is greater than start time
    if (value > startTime) {
      setEndTime(value);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProcessVideo = async () => {
    if (!video) return;

    try {
      setProcessing(true);

      const response = await axios.post(`/api/videos/${videoId}/process`, {
        startTime,
        endTime,
      });

      updateVideo({ ...response.data.video, id: response.data.video._id || response.data.video.id });
    } catch (error) {
      setError('视频处理失败');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-4">正在加载视频数据...</div>;
  }

  if (!video) {
    return <div className="p-4">未找到视频，请确认视频ID是否正确</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">编辑视频</h2>
      <div className="flex flex-col gap-4">
        <div className="mb-4">
          {/* 根据是否有字幕条件渲染不同的视频播放器 */}
          {video.hasSubtitles && video.subtitles && video.url ? (
            <VideoPlayer
              videoUrl={video.url}
              subtitleUrl={video.subtitleUrl}
              title={video.title}
            />
          ) : (
            <video
              ref={videoRef}
              src={`${video.url}`}
              controls
              className="w-full rounded-md h-[300px]"
              data-video-id={videoId}
            />
          )}
        </div>
        {/* <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm">开始时间: {formatTime(startTime)}</span>
          <span className="text-sm">结束时间: {formatTime(endTime)}</span>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            剪辑起点
          </label>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={startTime}
            onChange={(e) => handleStartTimeChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            剪辑终点
          </label>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={endTime}
            onChange={(e) => handleEndTimeChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
      
      <button
        onClick={handleProcessVideo}
        disabled={processing || video.status === 'processing'}
        className={`w-full py-2 px-4 rounded-md text-white font-medium ${
          processing || video.status === 'processing'
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {processing || video.status === 'processing' 
          ? '处理中...' 
          : '处理视频'}
      </button> */}

        {video.editedUrl && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">处理后的视频</h3>
            <video
              src={`${video.editedUrl}`}
              controls
              className="w-full rounded-md"
            />
          </div>
        )}

        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-medium mb-2">一键处理</h3>
          <p className="text-sm text-gray-600 mb-2">
            使用此功能可以一次性完成音频提取和字幕识别。
          </p>
          <VideoProcessor videoId={videoId} />
        </div>
      </div>
    </div>
  );
} 