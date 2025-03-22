'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 任务类型显示名称
const taskTypeNames = {
  'subtitle_generation': '字幕生成',
  'audio_extraction': '音频提取',
  'transcription': '转录任务'
};

// 任务状态显示名称及样式
const taskStatusConfig = {
  'pending': { name: '等待处理', className: 'bg-yellow-100 text-yellow-800' },
  'processing': { name: '处理中', className: 'bg-blue-100 text-blue-800' },
  'completed': { name: '已完成', className: 'bg-green-100 text-green-800' },
  'failed': { name: '失败', className: 'bg-red-100 text-red-800' }
};

interface Task {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoId: string;
  mediaUrl: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  error: string | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  
  // 加载任务列表
  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 构建查询参数
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);
      params.append('limit', '100');
      
      const response = await axios.get(`/api/tasks?${params.toString()}`);
      setTasks(response.data.tasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError('加载任务失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    loadTasks();
  }, [statusFilter, typeFilter]);
  
  // 处理任务
  const handleProcessTask = async (taskId: string) => {
    try {
      await axios.post(`/api/tasks/${taskId}/process`);
      await loadTasks(); // 重新加载任务列表
    } catch (err) {
      console.error('Error processing task:', err);
      setError('处理任务失败，请重试');
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">离线任务管理</h1>
      
      {/* 筛选器 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 min-w-[120px]"
          >
            <option value="">全部状态</option>
            <option value="pending">等待处理</option>
            <option value="processing">处理中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">任务类型</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 min-w-[120px]"
          >
            <option value="">全部类型</option>
            <option value="subtitle_generation">字幕生成</option>
            <option value="audio_extraction">音频提取</option>
            <option value="transcription">转录任务</option>
          </select>
        </div>
        
        <div className="flex items-end">
          <button
            onClick={() => loadTasks()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
          >
            刷新
          </button>
        </div>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      {/* 加载中 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-500 rounded-full"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : (
        /* 任务列表 */
        tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">视频ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">媒体URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span>{taskTypeNames[task.type as keyof typeof taskTypeNames] || task.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${taskStatusConfig[task.status].className}`}>
                        {taskStatusConfig[task.status].name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/videos/${task.videoId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {task.videoId}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="truncate max-w-xs" title={task.mediaUrl}>
                        {task.mediaUrl}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatDate(task.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleProcessTask(task.id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                        >
                          手动处理
                        </button>
                      )}
                      {task.error && (
                        <div className="mt-1 text-xs text-red-500">
                          错误: {task.error}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-md">
            <p className="text-gray-500">暂无任务数据</p>
          </div>
        )
      )}
    </div>
  );
} 