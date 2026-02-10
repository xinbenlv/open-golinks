'use client';

import { useState } from 'react';
import { LinkCreationForm } from '@/components/organisms/LinkCreationForm';
import { Card } from '@/components/atoms/Card';
import type { Link } from '@/db/schema';

export function EditPageClient({
  slug,
  existingLink,
  showClaimPrompt,
}: {
  slug: string;
  existingLink: Link | null;
  showClaimPrompt: boolean;
}) {
  const [isSuccess, setIsSuccess] = useState(false);

  return (
    <>
      {!isSuccess && (
        <div className="text-center mb-12">
          {existingLink ? (
            <>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">编辑短链接</h1>
              <p className="text-xl text-gray-600">修改链接的目标 URL 和设置</p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">创建短链接</h1>
              <p className="text-xl text-gray-600">
                使用 <code className="bg-gray-100 px-2 py-1 rounded">{slug}</code> 作为短链接
              </p>
            </>
          )}
        </div>
      )}

      <Card className="shadow-lg">
        <LinkCreationForm
          isAnonymous={!existingLink}
          prefilledSlug={slug}
          existingLink={existingLink}
          onSuccess={() => setIsSuccess(true)}
          showClaimPrompt={showClaimPrompt}
        />
      </Card>

      {!isSuccess && existingLink && !showClaimPrompt && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            ℹ️ 此链接已存在。修改下方的 URL 后，所有访问都将重定向到新 URL。
          </p>
        </div>
      )}
    </>
  );
}
