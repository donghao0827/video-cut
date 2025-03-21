'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Task {
  id: string;
  videoId: string;
  status: string;
  localAudioUrl: string;
  obsAudioUrl: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  error: string | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [totalPending, setTotalPending] = useState(0);
  
  useEffect(() => {
    fetchTasks();
  }, [filter]);
  
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const url = filter ? `/api/tasks?status=${filter}` : '/api/tasks';
      const response = await axios.get(url);
      setTasks(response.data.tasks);
      setTotalPending(response.data.totalPending);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">转写任务管理</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">待处理任务: {totalPending}</span>
          <button 
            onClick={fetchTasks}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            刷新
          </button>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex space-x-2">
          <button 
            onClick={() => setFilter('')}
            className={`px-4 py-2 rounded-md ${!filter ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            全部
          </button>
          <button 
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-md ${filter === 'pending' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            待处理
          </button>
          <button 
            onClick={() => setFilter('processing')}
            className={`px-4 py-2 rounded-md ${filter === 'processing' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            处理中
          </button>
          <button 
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-md ${filter === 'completed' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            已完成
          </button>
          <button 
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 rounded-md ${filter === 'failed' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            失败
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          没有找到符合条件的任务
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-left">ID</th>
                <th className="py-2 px-4 border-b text-left">视频ID</th>
                <th className="py-2 px-4 border-b text-left">状态</th>
                <th className="py-2 px-4 border-b text-left">创建时间</th>
                <th className="py-2 px-4 border-b text-left">处理时间</th>
                <th className="py-2 px-4 border-b text-left">本地音频</th>
                <th className="py-2 px-4 border-b text-left">OBS音频</th>
                <th className="py-2 px-4 border-b text-left">错误信息</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{task.id}</td>
                  <td className="py-2 px-4 border-b">
                    <Link 
                      href={`/videos/${task.videoId}`}
                      className="text-blue-500 hover:underline"
                    >
                      {task.videoId}
                    </Link>
                  </td>
                  <td className="py-2 px-4 border-b">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${getStatusClass(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b">{formatDate(task.createdAt)}</td>
                  <td className="py-2 px-4 border-b">{task.processedAt ? formatDate(task.processedAt) : '-'}</td>
                  <td className="py-2 px-4 border-b">
                    {task.localAudioUrl && (
                      <a 
                        href={task.localAudioUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        查看
                      </a>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {task.obsAudioUrl && (
                      <a 
                        href={task.obsAudioUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        查看
                      </a>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b">
                    <div className="max-w-xs truncate text-red-500">
                      {task.error || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 