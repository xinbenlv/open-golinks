'use client';

import React, { useEffect, useState } from 'react';
import { LinkCreationForm } from '@/components/organisms/LinkCreationForm';
import { Card } from '@/components/atoms/Card';
import type { Link } from '@/db/schema';

/**
 * 编辑页面 - 动态路由
 * 显示链接的编辑表单（如果存在）或创建表单（如果不存在）
 */
export default function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string>('');
  const [existingLink, setExistingLink] = useState<Link | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { slug: slugValue } = await params;
      setSlug(slugValue);

      try {
        // 尝试获取现有链接
        const response = await fetch(`/api/v1/links/${slugValue}`);
        if (response.ok) {
          const data = await response.json();
          setExistingLink(data.data);
        }
      } catch {
        // 链接不存在，继续显示创建表单
      } finally {
        setIsLoading(false);
      }
    })();
  }, [params]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center">
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 页面头部 */}
        <div className="text-center mb-12">
          {existingLink ? (
            <>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                编辑短链接
              </h1>
              <p className="text-xl text-gray-600">
                修改链接的目标 URL 和设置
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                创建短链接
              </h1>
              <p className="text-xl text-gray-600">
                使用 <code className="bg-gray-100 px-2 py-1 rounded">{slug}</code> 作为短链接
              </p>
            </>
          )}
        </div>

        {/* 表单卡片 */}
        <Card className="shadow-lg">
          <LinkCreationForm
            isAnonymous={true}
            prefilledSlug={slug}
            existingLink={existingLink}
          />
        </Card>

        {/* 提示信息 */}
        {existingLink && (
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              ℹ️ 此链接已存在。修改下方的 URL 后，所有访问都将重定向到新 URL。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
