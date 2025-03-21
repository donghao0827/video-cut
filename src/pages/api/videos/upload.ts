import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Fields, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import connectDB from '@/lib/db/connectDB';
import VideoModel from '@/lib/db/models/video';

// 禁用默认的body解析器，因为我们将使用formidable处理文件上传
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    // 连接数据库
    await connectDB();

    // 创建上传目录
    const uploadDir = path.join(process.cwd(), 'public', 'videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 解析表单数据和文件
    const form = new IncomingForm({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 200 * 1024 * 1024, // 200MB 最大上传大小
    });

    return new Promise<void>((resolve) => {
      form.parse(req, async (err: Error | null, fields: Fields, files: Files) => {
        if (err) {
          console.error('文件上传出错:', err);
          res.status(500).json({ error: '文件上传失败' });
          return resolve();
        }

        try {
          // 获取上传的视频文件
          const videoFile = Array.isArray(files.video) 
            ? files.video[0] 
            : files.video;

          if (!videoFile) {
            res.status(400).json({ error: '未提供视频文件' });
            return resolve();
          }

          // 获取文件名和扩展名
          const originalFilename = videoFile.originalFilename || 'video';
          const fileExt = path.extname(videoFile.filepath);
          
          // 获取视频标题
          const titleField = fields.title;
          let title: string;
          if (Array.isArray(titleField)) {
            title = titleField[0] || originalFilename;
          } else {
            title = titleField ? String(titleField) : originalFilename;
          }
          
          // 获取视频描述
          const descriptionField = fields.description;
          let description: string;
          if (Array.isArray(descriptionField)) {
            description = descriptionField[0] || '';
          } else {
            description = descriptionField ? String(descriptionField) : '';
          }

          // 创建一个新的视频记录
          const video = await VideoModel.create({
            title,
            description,
          });

          // 根据视频ID重命名文件
          const newFilename = `${video._id}${fileExt}`;
          const newFilepath = path.join(uploadDir, newFilename);
          
          fs.renameSync(videoFile.filepath, newFilepath);

          // 构建URL并保存到数据库
          const videoUrl = `/videos/${newFilename}`;
          
          // 更新视频记录以包含URL
          video.url = videoUrl;
          await video.save();

          res.status(201).json({
            message: '视频上传成功',
            video: {
              id: video._id,
              title: video.title,
              description: video.description,
              url: video.url,
            },
          });
          
          return resolve();
        } catch (error) {
          console.error('处理上传文件时出错:', error);
          res.status(500).json({ error: '处理视频文件失败' });
          return resolve();
        }
      });
    });
  } catch (error) {
    console.error('视频上传API出错:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
} 