import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

/**
 * 加载FFmpeg实例
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();

  if (!ffmpeg.loaded) {
    try {
      // 使用相对路径加载本地文件
      await ffmpeg.load({
        coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
      });
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error('Failed to load FFmpeg');
    }
  }

  return ffmpeg;
}

/**
 * 释放FFmpeg实例
 */
export function unloadFFmpeg(): void {
  if (ffmpeg) {
    try {
      ffmpeg.terminate();
      ffmpeg = null;
    } catch (error) {
      console.error('Error unloading FFmpeg:', error);
    }
  }
} 