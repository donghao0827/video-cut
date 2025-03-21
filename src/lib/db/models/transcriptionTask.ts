import mongoose, { Schema, Document } from 'mongoose';

export interface ITranscriptionTask extends Document {
  videoId: mongoose.Types.ObjectId;
  localAudioUrl: string;
  obsAudioUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
  error: string | null;
}

const TranscriptionTaskSchema = new Schema<ITranscriptionTask>(
  {
    videoId: { type: Schema.Types.ObjectId, ref: 'Video', required: true },
    localAudioUrl: { type: String, required: true },
    obsAudioUrl: { type: String, default: null },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed'], 
      default: 'pending' 
    },
    processedAt: { type: Date, default: null },
    error: { type: String, default: null }
  },
  { timestamps: true }
);

// 索引以便快速查询
TranscriptionTaskSchema.index({ status: 1, createdAt: 1 });
TranscriptionTaskSchema.index({ videoId: 1 });

export const TranscriptionTask = mongoose.models.TranscriptionTask || 
  mongoose.model<ITranscriptionTask>('TranscriptionTask', TranscriptionTaskSchema);

export default TranscriptionTask; 