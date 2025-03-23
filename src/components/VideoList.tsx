import { useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useVideoStore } from '@/lib/store/videoStore';

// 视频类型接口，兼容Mongoose和客户端
interface Video {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  createdAt: Date | string;
  [key: string]: any; // 允许其他属性
}

export default function VideoList() {
  const { videos, setVideos, isLoading, setLoading, setError } = useVideoStore();
  const router = useRouter();
  
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
  
  // 处理视频点击事件，导航到视频详情页
  const handleVideoClick = (videoId: string) => {
    router.push(`/videos/${videoId}`);
  };
  
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
        {videos.map((video: Video) => (
          <div
            key={video._id?.toString() || video.id?.toString()}
            className="border border-gray-200 rounded-md p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => handleVideoClick(video._id || video.id || '')}
          >
            <h3 className="font-medium text-lg">{video.title}</h3>
            {video.description && (
              <p className="text-gray-600 text-sm mt-1">{video.description}</p>
            )}
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                {new Date(video.createdAt).toLocaleDateString()}
              </span>
              <button 
                className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                onClick={(e) => {
                  e.stopPropagation(); // 防止触发父级的onClick
                  handleVideoClick(video._id || video.id || '');
                }}
              >
                编辑视频
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 