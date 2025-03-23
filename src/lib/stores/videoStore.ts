import { create } from 'zustand';
import { IVideo } from '../db/models/video';

interface Video extends IVideo {
  id: string;
  _id?: string;
  status?: string;
  editedUrl?: string;
  [key: string]: any; // 允许其他可能的字段
}

interface VideoStore {
  videos: Video[];
  setVideos: (videos: Video[]) => void;
  addVideo: (video: Video) => void;
  updateVideo: (video: Video) => void;
  removeVideo: (id: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const useVideoStore = create<VideoStore>((set) => ({
  videos: [],
  setVideos: (videos) => set({ videos }),
  addVideo: (video) => 
    set((state) => ({ videos: [...state.videos, video] })),
  updateVideo: (video) => 
    set((state) => ({
      videos: state.videos.map((v) => (v.id === video.id || v._id === video.id || v.id === video._id) ? { ...v, ...video } : v),
    })),
  removeVideo: (id) => 
    set((state) => ({
      videos: state.videos.filter((v) => v.id !== id && v._id !== id),
    })),
  error: null,
  setError: (error) => set({ error }),
}));

export default useVideoStore; 