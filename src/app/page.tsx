'use client';

import VideoUploader from '@/components/VideoUploader';
import VideoList from '@/components/VideoList';
import VideoEditor from '@/components/VideoEditor';
import { useVideoStore } from '@/lib/store/videoStore';

export default function Home() {
  const { currentVideo, error } = useVideoStore();

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-gray-50">
      <h1 className="text-3xl font-bold text-center mb-8">Video Cutter</h1>
      
      {error && (
        <div className="w-full max-w-4xl mb-6 p-4 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <VideoUploader />
          <VideoList />
        </div>
        
        <div>
          {currentVideo ? (
            <VideoEditor videoId={currentVideo._id as string} />
          ) : (
            <div className="p-4 bg-white rounded-lg shadow-md text-center py-16">
              <h2 className="text-xl font-bold mb-4">No Video Selected</h2>
              <p className="text-gray-600">
                Select a video from the list to edit it.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
