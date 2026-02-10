import React from 'react';
import { Metadata } from 'next';
import { LinkCreationForm } from '@/components/organisms/LinkCreationForm';
import { Card } from '@/components/atoms/Card';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '创建短链接 | Open GoLinks',
  description: '立即创建自定义短链接',
};

/**
 * 创建页面 - 公开路由
 * 允许匿名用户创建短链接
 * 包含链接创建表单和功能介绍
 */
export default function CreatePage() {
  const handleSuccess = (slug: string) => {
    // 导向仪表板或成功页面
    redirect(`/dashboard`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 页面头部 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            创建短链接
          </h1>
          <p className="text-xl text-gray-600">
            将长 URL 转换成简单易记的短链接
          </p>
        </div>

        {/* 表单卡片 */}
        <Card className="shadow-lg">
          <LinkCreationForm
            onSuccess={handleSuccess}
            isAnonymous={true}
          />
        </Card>

        {/* 功能介绍 */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-semibold text-gray-900 mb-2">快速</h3>
            <p className="text-gray-600 text-sm">
              数秒内创建短链接
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-semibold text-gray-900 mb-2">安全</h3>
            <p className="text-gray-600 text-sm">
              使用机器人验证保护
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-900 mb-2">分析</h3>
            <p className="text-gray-600 text-sm">
              跟踪点击和访问
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
