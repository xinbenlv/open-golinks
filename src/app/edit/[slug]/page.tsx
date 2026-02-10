import React from 'react';
import { Metadata } from 'next';
import { LinkCreationForm } from '@/components/organisms/LinkCreationForm';
import { Card } from '@/components/atoms/Card';
import { linkService } from '@/lib/services/link.service';
import { redirect } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `编辑短链接: ${slug} | Open GoLinks`,
    description: '编辑短链接或使用此 slug 创建新链接',
  };
}

/**
 * 编辑页面 - 动态路由
 * 显示链接的编辑表单（如果存在）或创建表单（如果不存在）
 */
export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let existingLink = null;

  try {
    // 尝试获取现有链接
    const link = await linkService.get(slug);
    if (link && !link.deletedAt) {
      existingLink = link;
    }
  } catch {
    // 链接不存在，继续显示创建表单
  }

  const handleSuccess = (createdSlug: string) => {
    // 重定向到仪表板或成功页面
    redirect(`/dashboard`);
  };

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
            onSuccess={handleSuccess}
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
