'use client';

import Link from 'next/link';
import { FiVideo, FiUsers, FiClock } from 'react-icons/fi';

interface AdminCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

function AdminCard({ title, description, href, icon }: AdminCardProps) {
  return (
    <Link href={href}>
      <div className="p-6 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white">
        <div className="flex items-center space-x-4">
          <div className="text-blue-500">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-medium">{title}</h3>
            <p className="text-gray-600">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">系统管理</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminCard
          title="视频管理"
          description="管理所有上传的视频"
          href="/admin/videos"
          icon={<FiVideo className="w-8 h-8" />}
        />
        <AdminCard
          title="用户管理"
          description="管理系统用户"
          href="/admin/users"
          icon={<FiUsers className="w-8 h-8" />}
        />
        <AdminCard
          title="任务管理"
          description="管理音频转录任务"
          href="/admin/tasks"
          icon={<FiClock className="w-8 h-8" />}
        />
      </div>
    </div>
  );
} 