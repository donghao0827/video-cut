import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Initialize FFmpeg
const ffmpeg = new FFmpeg();

// Load FFmpeg
let ffmpegLoaded = false;
async function loadFFmpeg() {
  if (!ffmpegLoaded) {
    // Load FFmpeg core and WASM
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegLoaded = true;
  }
  return ffmpeg;
}

/**
 * Trim a video file
 * @param videoFile Video file to trim
 * @param startTime Start time in seconds
 * @param endTime End time in seconds
 * @returns Trimmed video as Blob
 */
export async function trimVideo(
  videoFile: File,
  startTime: number,
  endTime: number
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  
  // Write the input file to memory
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
  
  // Run the FFmpeg command to trim the video
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-ss', `${startTime}`,
    '-to', `${endTime}`,
    '-c:v', 'copy',
    '-c:a', 'copy',
    'output.mp4'
  ]);
  
  // Read the output file
  const data = await ffmpeg.readFile('output.mp4');
  
  // Clean up
  await ffmpeg.deleteFile('input.mp4');
  await ffmpeg.deleteFile('output.mp4');
  
  // Convert to blob
  return new Blob([data], { type: 'video/mp4' });
}

/**
 * Generate a thumbnail from a video file
 * @param videoFile Video file to generate thumbnail from
 * @param time Time in seconds to capture thumbnail
 * @returns Thumbnail as Blob
 */
export async function generateThumbnail(
  videoFile: File,
  time: number = 0
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg();
  
  // Write the input file to memory
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
  
  // Run the FFmpeg command to generate thumbnail
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-ss', `${time}`,
    '-frames:v', '1',
    'thumbnail.jpg'
  ]);
  
  // Read the output file
  const data = await ffmpeg.readFile('thumbnail.jpg');
  
  // Clean up
  await ffmpeg.deleteFile('input.mp4');
  await ffmpeg.deleteFile('thumbnail.jpg');
  
  // Convert to blob
  return new Blob([data], { type: 'image/jpeg' });
}

/**
 * Get video duration
 * @param videoFile Video file to get duration from
 * @returns Duration in seconds
 */
export async function getVideoDuration(videoFile: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    
    video.src = URL.createObjectURL(videoFile);
  });
}

/**
 * Convert a Blob to a File object
 * @param blob Blob data
 * @param fileName Filename
 * @param type MIME type
 * @returns File object
 */
export function blobToFile(
  blob: Blob,
  fileName: string,
  type: string = 'video/mp4'
): File {
  return new File([blob], fileName, { type });
} 