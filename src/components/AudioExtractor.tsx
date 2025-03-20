import { useState, useEffect } from 'react';
import axios from 'axios';
import { useVideoStore } from '@/lib/store/videoStore';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from '@/lib/ffmpeg/ffmpegLoader';

export default function AudioExtractor({ videoId }: { videoId: string }) {
  const { videos, updateVideo, setError } = useVideoStore();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  
  // Find the video from the store
  const video = videos.find(v => v._id === videoId);

  useEffect(() => {
    // 组件挂载时预加载FFmpeg
    const preloadFFmpeg = async () => {
      try {
        if (!ffmpegLoaded) {
          const ffmpeg = await getFFmpeg();
          ffmpeg.on('progress', ({ progress }) => {
            setProgress(Math.round(progress * 100));
          });
          setFfmpegLoaded(true);
        }
      } catch (error) {
        console.error('Error preloading FFmpeg:', error);
        setError('Failed to load FFmpeg');
      }
    };
    
    preloadFFmpeg();
    
    // 组件卸载时清理
    return () => {
      // 不需要在这里卸载FFmpeg，它是单例的
    };
  }, [ffmpegLoaded, setError]);
  
  const extractAudio = async () => {
    if (!video) return;
    
    try {
      setProcessing(true);
      setProgress(0);
      
      // 获取FFmpeg实例
      const ffmpeg = await getFFmpeg();
      
      // Extract audio using FFmpeg
      const inputFile = video.originalUrl.startsWith('/')
        ? `${window.location.origin}${video.originalUrl}`
        : video.originalUrl;
      
      const inputFileName = 'input.mp4';
      const outputFileName = 'output.mp3';
      
      // Write the input file to the virtual file system
      ffmpeg.writeFile(inputFileName, await fetchFile(inputFile));
      
      // Extract audio using FFmpeg
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vn',  // No video
        '-acodec', 'libmp3lame',  // Use MP3 codec
        '-q:a', '2',  // Audio quality
        outputFileName
      ]);
      
      // Read the output file from the virtual file system
      const data = await ffmpeg.readFile(outputFileName);
      const audioBlob = new Blob([data], { type: 'audio/mp3' });
      
      // Update video in database
      const formData = new FormData();
      formData.append('audio', new File([audioBlob], outputFileName, { type: 'audio/mp3' }));
      
      const response = await axios.post(`/api/videos/${videoId}/extract-audio`, formData);
      
      updateVideo(response.data.video);
    } catch (error) {
      console.error('Error extracting audio:', error);
      setError('Failed to extract audio');
    } finally {
      setProcessing(false);
    }
  };
  
  if (!video) {
    return <div>Video not found</div>;
  }
  
  return (
    <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Extract Audio</h2>
      
      <button
        onClick={extractAudio}
        disabled={processing}
        className={`w-full py-2 px-4 rounded-md text-white font-medium ${
          processing ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {processing ? `Processing... ${progress}%` : 'Extract Audio'}
      </button>
      
      {video.audioUrl && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Extracted Audio</h3>
          <audio src={video.audioUrl} controls className="w-full" />
          <div className="mt-2">
            <a
              href={video.audioUrl}
              download={`${video.title}.mp3`}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Download Audio
            </a>
          </div>
        </div>
      )}
    </div>
  );
} 