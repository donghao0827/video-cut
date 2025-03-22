import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useVideoStore } from '@/lib/store/videoStore';

export default function VideoUploader() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const { addVideo, setError } = useVideoStore();
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setFile(acceptedFiles[0]);
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.webm', '.mov']
    },
    maxFiles: 1,
    multiple: false
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !title) {
      setError('请提供标题并选择视频文件');
      return;
    }
    
    try {
      setUploading(true);
      setProgress(0);
      setError(null);
      
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', title);
      if (description) formData.append('description', description);
      
      const response = await axios.post('/api/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      addVideo(response.data.video);
      
      // Reset form
      setTitle('');
      setDescription('');
      setFile(null);
    } catch (error) {
      setError('视频上传失败');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">上传新视频</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
            标题 *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">
            描述
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>
        
        <div className="mb-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'
            }`}
          >
            <input {...getInputProps()} />
            
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div>
                <p>拖拽视频文件到此处，或点击选择</p>
                <p className="text-xs text-gray-500 mt-1">
                  支持格式：MP4、WebM、MOV
                </p>
              </div>
            )}
          </div>
        </div>
        
        <button
          type="submit"
          disabled={uploading}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            uploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {uploading ? '上传中...' : '上传视频'}
        </button>
      </form>
    </div>
  );
} 