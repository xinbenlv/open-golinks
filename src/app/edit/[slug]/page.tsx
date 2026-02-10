'use client';

import React, { useEffect, useState } from 'react';
import { LinkCreationForm } from '@/components/organisms/LinkCreationForm';
import { Card } from '@/components/atoms/Card';
import { Alert } from '@/components/atoms/Alert';
import type { Link } from '@/db/schema';
import { getSupabaseBrowserClient } from '@/lib/auth/client';

/**
 * 编辑页面 - 动态路由
 * 显示链接的编辑表单（如果存在）或创建表单（如果不存在）
 *
 * 权限检查：
 * - 如果链接已存在，用户必须登录
 * - 如果链接有所有者，用户必须是所有者
 * - 如果链接是匿名的，用户需要先声明所有权
 */
export default function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = getSupabaseBrowserClient();
  const [slug, setSlug] = useState<string>('');
  const [existingLink, setExistingLink] = useState<Link | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClaimPrompt, setShowClaimPrompt] = useState(false);

  useEffect(() => {
    (async () => {
      const { slug: slugValue } = await params;
      setSlug(slugValue);

      try {
        // 尝试获取现有链接
        const response = await fetch(`/api/v1/links/${slugValue}`);
        if (response.ok) {
          const data = await response.json();
          const link = data.data as Link;

          // 链接已存在，检查认证状态
          const { data: authData } = await supabase.auth.getUser();
          const user = authData.user;

          // 如果未登录，重定向到登录页面
          if (!user) {
            window.location.href = `/auth/login?returnTo=/edit/${slugValue}`;
            return;
          }

          // 如果链接有所有者且不是当前用户，显示权限错误
          if (link.ownerId && link.ownerId !== user.id) {
            setError('你没有权限编辑这个链接');
            setIsLoading(false);
            return;
          }

          // 如果链接是匿名的，提示需要先声明所有权
          if (!link.ownerId) {
            setShowClaimPrompt(true);
          }

          setExistingLink(link);
        }
      } catch {
        // 链接不存在，继续显示创建表单
      } finally {
        setIsLoading(false);
      }
    })();
  }, [params, supabase]);

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

  // 显示权限错误
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Alert variant="error" className="mb-8">
            <p className="font-semibold">{error}</p>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 页面头部 - 成功时隐藏 */}
        {!isSuccess && (
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
        )}

        {/* 表单卡片 - LinkCreationForm 会在成功时自动显示成功屏幕 */}
        <Card className="shadow-lg">
          <LinkCreationForm
            isAnonymous={!existingLink}
            prefilledSlug={slug}
            existingLink={existingLink}
            onSuccess={() => setIsSuccess(true)}
            showClaimPrompt={showClaimPrompt}
          />
        </Card>

        {/* 提示信息 */}
        {!isSuccess && existingLink && !showClaimPrompt && (
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
