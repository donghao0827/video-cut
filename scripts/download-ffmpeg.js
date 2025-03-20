import fs from 'fs';
import path from 'path';
import https from 'https';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

const ffmpegCoreVersion = '0.12.10';
const ffmpegDir = path.join(process.cwd(), 'public/ffmpeg');

// FFmpeg核心文件URLs
const coreURLs = [
  {
    url: `https://unpkg.com/@ffmpeg/core@${ffmpegCoreVersion}/dist/umd/ffmpeg-core.js`,
    filename: 'ffmpeg-core.js'
  },
  {
    url: `https://unpkg.com/@ffmpeg/core@${ffmpegCoreVersion}/dist/umd/ffmpeg-core.wasm`,
    filename: 'ffmpeg-core.wasm'
  }
];

async function download(url, filename) {
  console.log(`Downloading ${filename}...`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      const data = [];
      
      response.on('data', (chunk) => {
        data.push(chunk);
      });
      
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(data);
          const filePath = path.join(ffmpegDir, filename);
          await writeFileAsync(filePath, buffer);
          console.log(`Downloaded ${filename}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    // 确保FFmpeg目录存在
    if (!fs.existsSync(ffmpegDir)) {
      await mkdirAsync(ffmpegDir, { recursive: true });
    }
    
    // 下载所有核心文件
    for (const { url, filename } of coreURLs) {
      await download(url, filename);
    }
    
    console.log('All FFmpeg core files downloaded successfully!');
  } catch (error) {
    console.error('Error downloading FFmpeg core files:', error);
    process.exit(1);
  }
}

main(); 