'use client';

import VideoUploader from '@/components/VideoUploader';
import VideoList from '@/components/VideoList';
import { useVideoStore } from '@/lib/store/videoStore';

export default function Home() {
  const { error } = useVideoStore();

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-gray-50">
      <h1 className="text-3xl font-bold text-center mb-8">视频剪辑工具</h1>
      
      {error && (
        <div className="w-full max-w-4xl mb-6 p-4 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      <div className="w-full max-w-4xl">
        <div className="space-y-8">
          <VideoUploader />
          <VideoList />
        </div>
      </div>
    </main>
  );
}
