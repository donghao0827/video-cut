'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import VideoEditor from '@/components/VideoEditor';
import HighlightExtractor from '@/components/HighlightExtractor';
import useVideoStore from '@/lib/stores/videoStore';

export default function VideoDetailPage() {
  const params = useParams() || {};
  const router = useRouter();
  const videoId = params.id as string;
  const { videos, setVideos, error, setError, setLoading } = useVideoStore();
  
  // 从API获取特定视频数据
  useEffect(() => {
    const fetchVideoData = async () => {
      if (!videoId) return;
      
      try {
        setLoading(true);
        // 先检查store中是否已有视频数据
        if (videos.length === 0) {
          // 获取所有视频
          const allVideosResponse = await axios.get('/api/videos');
          setVideos(allVideosResponse.data.videos);
        }
      } catch (error) {
        console.error('获取视频数据失败:', error);
        setError('获取视频数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchVideoData();
  }, [videoId, videos.length, setVideos, setError, setLoading]);
  
  // 找到当前视频
  const video = videos.find(v => v._id === videoId || v.id === videoId);
  
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-gray-50">
      <div className="w-full max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{video?.title || '加载中...'}</h1>
          <button 
            onClick={() => router.push('/')} 
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            返回列表
          </button>
        </div>
        
        {error && (
          <div className="w-full mb-6 p-4 bg-red-100 text-red-800 rounded-md">
            {error}
          </div>
        )}
        
        {!video ? (
          <div className="p-8 bg-white rounded-lg shadow-md text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p>加载视频数据中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-1 overflow-auto">
              <VideoEditor videoId={videoId} />
            </div>
            <div className="md:col-span-1 overflow-auto">
              <HighlightExtractor videoId={videoId} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 