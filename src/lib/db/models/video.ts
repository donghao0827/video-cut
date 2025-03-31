import mongoose, { Schema, Model } from 'mongoose';

// 字幕时间戳接口
export interface ISubtitle {
  start: string;
  end: string;
  text: string;
}

// 高价值片段接口
export interface IHighlight {
  start: number;
  end: number;
  text: string;
  reason: string;
}

// 视频片段接口
export interface IClip {
  id: string;
  url: string;
  start: number;
  end: number;
  text: string;
  reason?: string;
  duration: number;
  sourceVideoId?: string;
  sourceVideoTitle?: string;
  fileSize?: number;
  resolution?: string;
  createdAt: Date;
}

// 视频接口
export interface IVideo {
  title: string;
  description?: string;
  url?: string;
  thumbnailUrl?: string;
  subtitles?: ISubtitle[];
  audioUrl?: string;
  obsAudioUrl?: string;
  hasSubtitles?: boolean;
  subtitleUrl?: string;
  highlights?: IHighlight[];
  clips?: IClip[];
  createdAt: Date;
  updatedAt: Date;
}

// 视频文档接口，包含MongoDB文档的方法
export interface IVideoDocument extends IVideo, mongoose.Document {}

// 视频模式Schema定义
const VideoSchema = new Schema<IVideoDocument>(
  {
    title: { type: String, required: true },
    description: { type: String },
    url: { type: String },
    thumbnailUrl: { type: String },
    subtitles: [
      {
        start: { type: Number, required: true },
        end: { type: Number, required: true },
        text: { type: String, required: true },
      },
    ],
    audioUrl: { type: String },
    obsAudioUrl: { type: String },
    hasSubtitles: { type: Boolean, default: false },
    subtitleUrl: { type: String },
    highlights: [
      {
        start: { type: Number, required: true },
        end: { type: Number, required: true },
        text: { type: String, required: true },
        reason: { type: String, required: true },
      },
    ],
    clips: {
      type: [
        {
          id: { type: String, required: true },
          url: { type: String, required: true },
          start: { type: Number, required: true },
          end: { type: Number, required: true },
          text: { type: String, required: true },
          reason: { type: String },
          duration: { type: Number, required: true },
          sourceVideoId: { type: String },
          sourceVideoTitle: { type: String },
          fileSize: { type: Number },
          resolution: { type: String },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true, // 添加 createdAt 和 updatedAt 字段
    strict: false,  // 允许存储Schema中未定义的字段，避免验证错误
  }
);

// 检查模型是否已经被定义
let VideoModel: Model<IVideoDocument>;

try {
  // 尝试获取现有模型
  VideoModel = mongoose.model<IVideoDocument>('Video');
} catch {
  // 如果模型不存在，创建新模型
  VideoModel = mongoose.model<IVideoDocument>('Video', VideoSchema);
}

export default VideoModel;