'use client';

import { useState } from 'react';
import { LinkCreationForm } from '@/components/organisms/LinkCreationForm';
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
        <div className="mb-10">
          {existingLink ? (
            <>
              <h1 className="text-3xl font-medium text-secondary mb-1">编辑</h1>
              <p className="text-gray-500 text-sm">{slug}</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-medium text-secondary mb-1">创建</h1>
              <p className="text-gray-500 text-sm">go/{slug}</p>
            </>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <LinkCreationForm
          isAnonymous={!existingLink}
          prefilledSlug={slug}
          existingLink={existingLink}
          onSuccess={() => setIsSuccess(true)}
          showClaimPrompt={showClaimPrompt}
        />
      </div>

      {!isSuccess && existingLink && !showClaimPrompt && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-600 leading-relaxed">
            此链接已存在。修改下方的 URL 后，所有访问都将重定向到新 URL。
          </p>
        </div>
      )}
    </>
  );
}
