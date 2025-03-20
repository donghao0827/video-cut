import { useState } from 'react';
import axios from 'axios';
import { useVideoStore } from '@/lib/store/videoStore';
import { ITimestamp } from '@/lib/db/models/video';

interface TranscriptViewerProps {
  videoId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function TranscriptViewer({ videoId, videoRef }: TranscriptViewerProps) {
  const { videos, updateVideo, setError } = useVideoStore();
  const [processing, setProcessing] = useState(false);
  
  // Find the video from the store
  const video = videos.find(v => v._id === videoId);
  
  const transcribeAudio = async () => {
    if (!video || !video.audioUrl) return;
    
    try {
      setProcessing(true);
      
      const response = await axios.post(`/api/videos/${videoId}/transcribe`);
      
      updateVideo(response.data.video);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setError('Failed to transcribe audio');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleTimestampClick = (timestamp: ITimestamp) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp.start;
      videoRef.current.play();
    }
  };
  
  // 格式化时间为 MM:SS 格式
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  if (!video) {
    return <div>Video not found</div>;
  }
  
  return (
    <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Video Transcript</h2>
      
      {!video.audioUrl ? (
        <div className="text-gray-500 mb-4">
          Extract audio first to generate a transcript
        </div>
      ) : video.transcript ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Full Transcript</h3>
          <div className="p-4 bg-gray-50 rounded-md max-h-40 overflow-y-auto">
            {video.transcript}
          </div>
          
          <h3 className="text-lg font-medium mt-4">Timeline</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {video.timestamps?.map((timestamp, index) => (
              <div 
                key={index}
                onClick={() => handleTimestampClick(timestamp)}
                className="p-3 bg-gray-50 rounded-md hover:bg-blue-50 cursor-pointer transition-colors flex"
              >
                <span className="text-gray-500 font-mono whitespace-nowrap mr-2">
                  {formatTime(timestamp.start)}
                </span>
                <span>{timestamp.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={transcribeAudio}
            disabled={processing}
            className={`w-full py-2 px-4 rounded-md text-white font-medium ${
              processing ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {processing ? 'Processing...' : 'Generate Transcript'}
          </button>
        </div>
      )}
    </div>
  );
} 