import mongoose, { Schema, Document } from 'mongoose';

// 定义时间戳段落接口
export interface ITimestamp {
  start: number;
  end: number;
  text: string;
}

// Define the interface for Video document
export interface IVideo extends Document {
  title: string;
  description?: string;
  originalUrl: string;
  editedUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  userId?: string;
  transcript?: string;
  timestamps?: ITimestamp[];
  status: 'uploaded' | 'processing' | 'ready' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

// Define the video schema
const VideoSchema = new Schema<IVideo>(
  {
    title: { type: String, required: true },
    description: { type: String },
    originalUrl: { type: String, required: true },
    editedUrl: { type: String },
    audioUrl: { type: String },
    thumbnailUrl: { type: String },
    duration: { type: Number },
    userId: { type: String },
    transcript: { type: String },
    timestamps: [{ 
      start: Number,
      end: Number,
      text: String
    }],
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'ready', 'error'],
      default: 'uploaded',
    },
  },
  { timestamps: true }
);

// Check if model already exists to prevent overwrite during hot reloading
export const Video = mongoose.models.Video || mongoose.model<IVideo>('Video', VideoSchema);

export default Video; 