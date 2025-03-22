import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  type: 'subtitle_generation' | 'audio_extraction';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoId: mongoose.Types.ObjectId;
  mediaUrl: string;
  result: object | null;
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
  error: string | null;
}

const TaskSchema = new Schema<ITask>(
  {
    type: { 
      type: String, 
      enum: ['subtitle_generation', 'audio_extraction'], 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed'], 
      default: 'pending' 
    },
    videoId: { type: Schema.Types.ObjectId, ref: 'Video', required: true },
    mediaUrl: { type: String, required: true },
    result: { type: Schema.Types.Mixed, default: null },
    processedAt: { type: Date, default: null },
    error: { type: String, default: null }
  },
  { timestamps: true }
);

// 索引以便快速查询
TaskSchema.index({ status: 1, createdAt: 1 });
TaskSchema.index({ videoId: 1 });
TaskSchema.index({ type: 1, status: 1 });

// 避免模型重复注册的问题
const TaskModel = mongoose.models.Task || 
  mongoose.model<ITask>('Task', TaskSchema);

export default TaskModel; 