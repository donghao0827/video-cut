import { create } from 'zustand';
import { IVideo, IClip } from '../db/models/video';

interface Video extends IVideo {
  id: string;
  _id?: string;
  status?: string;
  editedUrl?: string;
  // 使用更具体的索引签名，避免使用any
  [key: string]: string | number | boolean | object | undefined | null | Date | IClip[];
}

// 确保 IVideoWithId 包含 id 和 _id
interface IVideoWithId extends IVideo {
  id?: string;
  _id?: string;
  clips?: IClip[];
}

interface VideoStore {
  videos: Video[];
  currentVideo: Video | null;
  setCurrentVideo: (video: Video | null) => void;
  setVideos: (videos: Video[]) => void;
  addVideo: (video: Video) => void;
  updateVideo: (video: Video | IVideoWithId) => void;
  removeVideo: (id: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
  isLoading: boolean;
  setLoading: (isLoading: boolean) => void;
}

const useVideoStore = create<VideoStore>((set) => ({
  videos: [],
  currentVideo: null,
  setCurrentVideo: (video) => set({ currentVideo: video }),
  setVideos: (videos) => set({ videos }),
  addVideo: (video) => 
    set((state) => ({ videos: [...state.videos, video] })),
  updateVideo: (video: Video | IVideoWithId) => 
    set((state) => {
      // 确保逐个映射视频对象
      const updatedVideos = state.videos.map((v) => {
        // 检查是否匹配当前视频ID
        const videoId = video.id || video._id;
        const vId = v.id || v._id;
        
        if (vId === videoId) {
          // 特殊处理clips数组 - 确保不丢失
          const updatedVideo = { ...v, ...video };
          
          // 如果video中有clips但v中没有，保留video中的clips
          if (video.clips && (!v.clips || v.clips.length === 0)) {
            console.log('保留新视频对象中的clips数组:', video.clips.length);
          }
          // 如果两者都有clips，但新对象的clips更多，保留新的
          else if (video.clips && v.clips && video.clips.length > v.clips.length) {
            console.log('使用更长的clips数组:', video.clips.length, '>', v.clips.length);
          }
          // 如果旧对象有clips但新对象没有，保留旧的
          else if (v.clips && v.clips.length > 0 && (!video.clips || video.clips.length === 0)) {
            console.log('保留原有clips数组:', v.clips.length);
            updatedVideo.clips = v.clips;
          }
          
          return updatedVideo;
        }
        return v;
      });
      
      return { videos: updatedVideos };
    }),
  removeVideo: (id) => 
    set((state) => ({
      videos: state.videos.filter((v) => v.id !== id && v._id !== id),
    })),
  error: null,
  setError: (error) => set({ error }),
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
}));

export default useVideoStore; 