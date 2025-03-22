import { useEffect } from 'react';
import axios from 'axios';
import { useVideoStore } from '@/lib/store/videoStore';

export default function VideoList() {
  const { videos, setVideos, setCurrentVideo, isLoading, setLoading, setError } = useVideoStore();
  
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/videos');
        setVideos(response.data.videos);
      } catch (error) {
        console.error('获取视频列表失败:', error);
        setError('获取视频列表失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchVideos();
  }, [setVideos, setError, setLoading]);
  
  if (isLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">您的视频</h2>
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }
  
  if (videos.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">您的视频</h2>
        <div className="py-8 text-center text-gray-500">
          <p>未找到视频。上传新视频开始使用！</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">您的视频</h2>
      <div className="grid gap-4">
        {videos.map((video) => (
          <div
            key={video._id?.toString()}
            className="border border-gray-200 rounded-md p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setCurrentVideo(video)}
          >
            <h3 className="font-medium text-lg">{video.title}</h3>
            {video.description && (
              <p className="text-gray-600 text-sm mt-1">{video.description}</p>
            )}
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                {new Date(video.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 