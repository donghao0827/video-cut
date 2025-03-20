import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useVideoStore } from '@/lib/store/videoStore';
import AudioExtractor from './AudioExtractor';
import TranscriptViewer from './TranscriptViewer';

export default function VideoEditor({ videoId }: { videoId: string }) {
  const { videos, updateVideo, setError } = useVideoStore();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  
  // Find the video from the store
  const video = videos.find(v => v._id === videoId);
  
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
      
      updateVideo(response.data.video);
    } catch (error) {
      setError('Error processing video');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };
  
  if (!video) {
    return <div>Video not found</div>;
  }
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Edit Video</h2>
      
      <div className="mb-4">
        <video 
          ref={videoRef}
          src={`${video.originalUrl}`} 
          controls 
          className="w-full rounded-md"
        />
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm">Start Time: {formatTime(startTime)}</span>
          <span className="text-sm">End Time: {formatTime(endTime)}</span>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trim Start
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
            Trim End
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
          ? 'Processing...' 
          : 'Process Video'}
      </button>
      
      {video.editedUrl && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Processed Video</h3>
          <video 
            src={`${video.editedUrl}`} 
            controls 
            className="w-full rounded-md"
          />
        </div>
      )}
      
      <AudioExtractor videoId={videoId} />
      
      <TranscriptViewer videoId={videoId} videoRef={videoRef} />
    </div>
  );
} 