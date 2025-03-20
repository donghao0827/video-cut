import { create } from 'zustand';
import { IVideo } from '../db/models/video';

interface VideoState {
  videos: IVideo[];
  currentVideo: IVideo | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setVideos: (videos: IVideo[]) => void;
  setCurrentVideo: (video: IVideo | null) => void;
  addVideo: (video: IVideo) => void;
  updateVideo: (video: IVideo) => void;
  removeVideo: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  videos: [],
  currentVideo: null,
  isLoading: false,
  error: null,
  
  // Actions
  setVideos: (videos) => set({ videos }),
  setCurrentVideo: (currentVideo) => set({ currentVideo }),
  addVideo: (video) => set((state) => ({ 
    videos: [video, ...state.videos] 
  })),
  updateVideo: (updatedVideo) => set((state) => ({ 
    videos: state.videos.map(video => 
      video._id === updatedVideo._id ? updatedVideo : video
    ),
    currentVideo: state.currentVideo?._id === updatedVideo._id 
      ? updatedVideo 
      : state.currentVideo
  })),
  removeVideo: (id) => set((state) => ({ 
    videos: state.videos.filter(video => video._id !== id),
    currentVideo: state.currentVideo?._id === id ? null : state.currentVideo
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
})); 