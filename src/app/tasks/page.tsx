'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { Table, Tag, Button, Space, Select, message, Typography, Card } from 'antd';
import { SyncOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Option } = Select;

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

// 任务状态样式配置
const taskStatusConfig = {
  'pending': { name: '等待处理', color: 'warning' },
  'processing': { name: '处理中', color: 'processing' },
  'completed': { name: '已完成', color: 'success' },
  'failed': { name: '失败', color: 'error' }
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
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  
  // 加载任务列表
  const loadTasks = async () => {
    try {
      setLoading(true);
      
      // 构建查询参数
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);
      params.append('limit', '100');
      
      const response = await axios.get(`/api/tasks?${params.toString()}`);
      setTasks(response.data.tasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      message.error('加载任务失败，请刷新页面重试');
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
      message.success('任务处理已提交');
      await loadTasks(); // 重新加载任务列表
    } catch (err) {
      console.error('Error processing task:', err);
      message.error('处理任务失败，请重试');
    }
  };

  // 表格列定义
  const columns: ColumnsType<Task> = [
    {
      title: '任务类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => taskTypeNames[type as keyof typeof taskTypeNames] || type,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={taskStatusConfig[status as keyof typeof taskStatusConfig].color}>
          {taskStatusConfig[status as keyof typeof taskStatusConfig].name}
        </Tag>
      ),
    },
    {
      title: '视频ID',
      dataIndex: 'videoId',
      key: 'videoId',
      render: (videoId, record) => (
        <>
          <Link href={`${record.mediaUrl}`} style={{ color: '#1890ff' }}>
            {videoId}
          </Link>
        </>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <a href={`${window.location.origin}${record.mediaUrl}`} download={true}>下载</a>
          {record.status === 'pending' && (
            <Button 
              type="primary" 
              size="small" 
              icon={<PlayCircleOutlined />}
              onClick={() => handleProcessTask(record.id)}
            >
              手动处理
            </Button>
          )}
          {record.error && (
            <Typography.Text type="danger" ellipsis style={{ fontSize: '12px' }} title={record.error}>
              错误: {record.error}
            </Typography.Text>
          )}
        </Space>
      ),
    },
  ];
  
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={2}>离线任务管理</Title>
      
      <Card style={{ marginBottom: 24 }}>
        <Space size="middle" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small">
            <Typography.Text>状态</Typography.Text>
            <Select 
              style={{ width: 120 }}
              value={statusFilter} 
              onChange={setStatusFilter}
              placeholder="选择状态"
            >
              <Option value="">全部状态</Option>
              <Option value="pending">等待处理</Option>
              <Option value="processing">处理中</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
            </Select>
          </Space>
          
          <Space direction="vertical" size="small">
            <Typography.Text>任务类型</Typography.Text>
            <Select 
              style={{ width: 120 }}
              value={typeFilter} 
              onChange={setTypeFilter}
              placeholder="选择类型"
            >
              <Option value="">全部类型</Option>
              <Option value="subtitle_generation">字幕生成</Option>
              <Option value="audio_extraction">音频提取</Option>
              <Option value="transcription">转录任务</Option>
            </Select>
          </Space>
          
          <Button 
            type="primary" 
            icon={<SyncOutlined />} 
            onClick={loadTasks}
            style={{ marginTop: 22 }}
          >
            刷新
          </Button>
        </Space>
        
        <Table 
          columns={columns} 
          dataSource={tasks.map(task => ({ ...task, key: task.id }))} 
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
          locale={{ emptyText: '暂无任务数据' }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
} 