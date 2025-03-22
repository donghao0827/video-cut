'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { Table, Tag, Button, Space, Select, message, Typography, Card, Modal, Upload, Form, Input } from 'antd';
import { SyncOutlined, PlayCircleOutlined, InboxOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<UploadFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  
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
  
  // 打开手动处理模态框
  const openManualProcessModal = (task: Task) => {
    setCurrentTask(task);
    form.resetFields();
    setSubtitleFile(null);
    setIsModalOpen(true);
  };

  // 处理模态框关闭
  const handleCancel = () => {
    setIsModalOpen(false);
    setCurrentTask(null);
  };

  // 处理手动任务提交
  const handleManualSubmit = async () => {
    if (!currentTask) return;
    
    try {
      await form.validateFields();
      
      if (!subtitleFile && currentTask.type === 'subtitle_generation') {
        message.error('请上传字幕文件');
        return;
      }
      
      setSubmitting(true);
      
      // 创建表单数据
      const formData = new FormData();
      formData.append('id', currentTask.id);
      formData.append('storageLocation', form.getFieldValue('storageLocation'));
      
      // 添加字幕文件（如果有）
      if (subtitleFile && subtitleFile.originFileObj) {
        formData.append('subtitleFile', subtitleFile.originFileObj);
      }
      
      // 提交到API
      await axios.post(`/api/tasks/${currentTask.id}/manual-process`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      message.success('任务已成功处理');
      setIsModalOpen(false);
      loadTasks();
    } catch (err) {
      console.error('Error submitting manual process:', err);
      message.error('处理任务失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 字幕文件上传配置
  const uploadProps: UploadProps = {
    maxCount: 1,
    beforeUpload: (file) => {
      // 检查文件类型
      const isValidType = file.type === 'application/json' || 
                          file.name.endsWith('.json') || 
                          file.name.endsWith('.srt') || 
                          file.name.endsWith('.vtt');
      
      if (!isValidType) {
        message.error('只支持上传 JSON, SRT 或 VTT 格式的字幕文件');
        return Upload.LIST_IGNORE;
      }
      
      setSubtitleFile(file as UploadFile);
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setSubtitleFile(null);
    },
    fileList: subtitleFile ? [subtitleFile] : [],
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
              onClick={() => openManualProcessModal(record)}
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

      {/* 手动处理模态框 */}
      <Modal
        title={`手动处理任务 - ${currentTask ? taskTypeNames[currentTask.type as keyof typeof taskTypeNames] : ''}`}
        open={isModalOpen}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={submitting} 
            onClick={handleManualSubmit}
          >
            提交处理
          </Button>,
        ]}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ storageLocation: '/uploads/processed' }}
        >
          {/* 当任务类型是字幕生成时，显示字幕文件上传 */}
          {currentTask?.type === 'subtitle_generation' && (
            <Form.Item
              label="上传字幕文件"
              name="subtitleFile"
              rules={[{ required: true, message: '请上传字幕文件' }]}
            >
              <Dragger {...uploadProps}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  支持 JSON, SRT 或 VTT 格式的字幕文件
                </p>
              </Dragger>
            </Form.Item>
          )}

          <Form.Item
            label="存储位置"
            name="storageLocation"
            rules={[{ required: true, message: '请输入存储位置' }]}
          >
            <Input placeholder="指定视频文件的存储路径" />
          </Form.Item>

          {currentTask && (
            <div style={{ marginTop: 16 }}>
              <Text strong>任务信息：</Text>
              <br />
              <Text>ID: {currentTask.id}</Text>
              <br />
              <Text>视频ID: {currentTask.videoId}</Text>
              <br />
              <Text>媒体链接: <a href={currentTask.mediaUrl} target="_blank" rel="noopener noreferrer">{currentTask.mediaUrl}</a></Text>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
} 