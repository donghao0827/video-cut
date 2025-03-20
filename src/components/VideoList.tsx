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
        console.error('Error fetching videos:', error);
        setError('Failed to fetch videos');
      } finally {
        setLoading(false);
      }
    };
    
    fetchVideos();
  }, [setVideos, setError, setLoading]);
  
  if (isLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Your Videos</h2>
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }
  
  if (videos.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Your Videos</h2>
        <div className="py-8 text-center text-gray-500">
          <p>No videos found. Upload a new video to get started!</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Your Videos</h2>
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
              <span 
                className={`text-xs px-2 py-1 rounded-full ${
                  video.status === 'ready'
                    ? 'bg-green-100 text-green-800'
                    : video.status === 'processing'
                    ? 'bg-yellow-100 text-yellow-800'
                    : video.status === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {video.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 