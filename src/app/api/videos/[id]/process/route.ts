import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db/mongodb';
import { Video } from '@/lib/db/models/video';
import { v4 as uuidv4 } from 'uuid';

interface RequestParams {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RequestParams) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    const { startTime, endTime } = await req.json();
    
    // Find video
    const video = await Video.findById(id);
    
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    // Update video status
    video.status = 'processing';
    await video.save();
    
    try {
      // This is where you'd typically process the video with ffmpeg
      // In a production app, this would be done in a background job
      // Here we're just simulating the process
      console.log(`Processing video with id: ${id} from ${startTime}s to ${endTime}s`);
      
      // Generate a new filename for the processed video
      const fileName = `processed-${uuidv4()}.mp4`;
      
      // In a real implementation, we would use the ffmpeg utilities to process the video
      // and write it to the public/uploads directory
      
      // For now, we'll just mock the processing by updating the database
      video.editedUrl = `/uploads/${fileName}`;
      video.status = 'ready';
      await video.save();
      
      return NextResponse.json({ video });
    } catch (error) {
      // Update video status to error if processing fails
      video.status = 'error';
      await video.save();
      
      throw error;
    }
  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json(
      { error: 'Failed to process video' },
      { status: 500 }
    );
  }
} 