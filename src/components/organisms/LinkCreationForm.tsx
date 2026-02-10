'use client';

import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { InputField } from '@/components/molecules/InputField';
import { TextAreaField } from '@/components/molecules/TextAreaField';
import { Button } from '@/components/atoms/Button';
import { Alert } from '@/components/atoms/Alert';
import { Badge } from '@/components/atoms/Badge';
import { CreateLinkSchema, type CreateLinkInput } from '@/lib/validations/schemas';
import { generateRandomSlug } from '@/lib/utils/slug-gen';
import type { Link } from '@/db/schema';
import confetti from 'canvas-confetti';

export interface LinkCreationFormProps {
  onSuccess?: (slug: string) => void;
  isAnonymous?: boolean;
  initialSlug?: string;
  initialUrl?: string;
  prefilledSlug?: string;
  existingLink?: Link | null;
  showClaimPrompt?: boolean;
  onClaim?: () => void;
}

/**
 * LinkCreationForm 有机体组件
 * 完整的链接创建表单，包含：
 * - 自定义 slug 和自动生成
 * - 目标 URL 输入
 * - 元数据（标题、描述、警告）
 * - 表单验证和错误处理
 * - API 集成
 */
export function LinkCreationForm({
  onSuccess,
  isAnonymous = true,
  initialSlug,
  initialUrl,
  prefilledSlug,
  existingLink,
  showClaimPrompt = false,
  onClaim,
}: LinkCreationFormProps) {
  // Use isAnonymous or other props as needed
  // ...
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatedSlug, setGeneratedSlug] = useState(initialSlug || prefilledSlug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);

  // Determine if it's edit mode
  const isEditMode = !!existingLink;
  const formSlug = initialSlug || prefilledSlug;

  // Use isAnonymous for logic
  useEffect(() => {
    if (isAnonymous) {
      // Do something if needed
    }
  }, [isAnonymous]);

  // Handle success navigation or confetti
  useEffect(() => {
    if (!success || !generatedSlug) return;

    // If parent provided handler, delegate to it
    if (onSuccess) {
      onSuccess(generatedSlug);
      // We don't return here so confetti can still fire if desired,
      // but usually onSuccess might redirect.
      // If we want confetti ONLY when no onSuccess is provided:
      // return;
    }

    const duration = 3000; // 3 seconds
    const animationEnd = Date.now() + duration;

    const fireConfetti = () => {
      if (Date.now() > animationEnd) return;

      // Left confetti
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.5 },
        colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'],
      });

      // Right confetti
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.5 },
        colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'],
      });

      // Continue animation
      requestAnimationFrame(fireConfetti);
    };

    fireConfetti();
  }, [success, generatedSlug, onSuccess]);

  const methods = useForm<CreateLinkInput>({
    resolver: zodResolver(CreateLinkSchema),
    defaultValues: {
      slug: formSlug,
      customSlug: !!formSlug,
      url: initialUrl || existingLink?.url || '',
      metadata: {
        title: (existingLink?.metadata as any)?.title || '',
        description: (existingLink?.metadata as any)?.description || '',
        showWarning: (existingLink?.metadata as any)?.showWarning || false,
      },
    },
  });

  /**
   * 生成随机 slug
   */
  const handleAutoSlug = () => {
    const newSlug = generateRandomSlug(8);
    setGeneratedSlug(newSlug);
    methods.setValue('slug', newSlug);
    setSlugError(null);
  };

  /**
   * 处理 slug 变更
   */
  const handleSlugChange = (value: string) => {
    setGeneratedSlug(value);
    setSlugError(null);
  };

  /**
   * 表单提交处理
   */
  const onSubmit = async (data: CreateLinkInput) => {
    try {
      setIsLoading(true);
      setError(null);

      // 编辑模式下使用 PUT，创建模式下使用 POST
      const method = isEditMode ? 'PUT' : 'POST';
      const url = isEditMode ? `/api/v1/links/${existingLink!.slug}` : '/api/v1/links';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorCode = errorData.error?.code;

        // 错误代码到用户消息的映射
        const errorMap: Record<string, string> = {
          SLUG_CONFLICT: '此 slug 已被占用',
          SLUG_RESERVED: '此 slug 为保留字符',
          SLUG_INVALID_FORMAT: '无效的 slug 格式（3-50 个字符，字母、数字和连字符）',
          URL_INVALID: '无效的 URL 格式',
          URL_PRIVATE_IP_BLOCKED: '不能使用私有 IP 地址',
          TURNSTILE_REQUIRED: '请完成 Turnstile 验证',
          TURNSTILE_INVALID: 'Turnstile 验证失败',
          RATE_LIMITED: '请求过于频繁，请稍后重试',
        };

        setError(errorMap[errorCode] || '链接创建失败');

        if (errorCode === 'SLUG_CONFLICT') {
          setSlugError('Slug 已被占用');
        }
        return;
      }

      const result = await response.json();
      setSuccess(true);
      setGeneratedSlug(result.data.slug);
      onSuccess?.(result.data.slug);
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 成功状态显示
  if (success && generatedSlug) {
    const shortUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://golinks.app'}/${generatedSlug}`;
    const qrcodeUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://golinks.app'}/api/v1/links/${generatedSlug}/qrcode`;
    const qrcodeDownloadUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://golinks.app'}/api/v1/links/${generatedSlug}/qrcode?download=true`;

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(shortUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // 复制失败，用户可以手动复制
      }
    };

    const handleDownloadQR = async () => {
      try {
        // Trigger PNG download
        const link = document.createElement('a');
        link.href = qrcodeDownloadUrl;
        link.download = `qrcode-${generatedSlug}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('Failed to download QR code:', err);
      }
    };

    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isEditMode ? '链接更新成功！' : '恭喜！短链接创建成功'}
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            {isEditMode ? '链接已更新，现在可以分享啦' : '现在可以去分享啦'}
          </p>

          {/* 短链接显示区域 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
            <p className="text-sm text-gray-600 mb-3">您的短链接</p>
            <div className="flex items-center gap-2 bg-white rounded-lg p-4 border border-gray-200">
              <code className="flex-1 text-center font-mono text-lg text-gray-900">{shortUrl}</code>
              <Button
                type="button"
                variant={copied ? 'primary' : 'primary'}
                size="sm"
                onClick={handleCopy}
              >
                {copied ? '✓ 已复制' : '复制'}
              </Button>
            </div>
          </div>

          {/* QR 码显示区域 */}
          <div className="bg-white rounded-lg p-6 mb-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-4">二维码</p>
            <div className="flex flex-col items-center gap-4">
              <img
                src={qrcodeUrl}
                alt="QR code"
                className="w-40 h-40 border border-gray-200 rounded-lg"
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleDownloadQR}>
                📥 下载二维码 (PNG)
              </Button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                window.open(shortUrl, '_blank');
              }}
            >
              {isEditMode ? '查看链接' : '测试链接'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                methods.reset();
                setGeneratedSlug(undefined);
                setSuccess(false);
                setCopied(false);
              }}
            >
              创建另一个
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        {showClaimPrompt && !isClaimed && (
          <Alert variant="warning" onClose={() => {}} className="mb-4">
            <div>
              <p className="font-semibold">⚠️ 这是一个匿名链接</p>
              <p className="text-sm mt-1">要修改此链接，请先声明所有权。</p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="mt-3"
                disabled={claimLoading}
                isLoading={claimLoading}
                onClick={async () => {
                  try {
                    setClaimLoading(true);
                    const response = await fetch(`/api/v1/links/${existingLink!.slug}/claim`, {
                      method: 'POST',
                    });
                    if (response.ok) {
                      setIsClaimed(true);
                      onClaim?.();
                    } else {
                      const data = await response.json();
                      setError(data.error?.message || '声明所有权失败，请重试');
                    }
                  } catch (err) {
                    setError('声明所有权失败，请重试');
                  } finally {
                    setClaimLoading(false);
                  }
                }}
              >
                声明所有权
              </Button>
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Slug</h3>
            {!isEditMode && (
              <Button type="button" variant="ghost" size="sm" onClick={handleAutoSlug}>
                生成
              </Button>
            )}
          </div>
          <InputField
            name="slug"
            label="自定义 slug（可选）"
            placeholder="my-link"
            helperText={
              isEditMode
                ? '无法编辑现有链接的 slug'
                : '3-50 个字符，字母/数字/连字符。留空可自动生成'
            }
            onChange={(e) => !isEditMode && handleSlugChange(e.target.value)}
            disabled={isEditMode}
          />
          {slugError && <p className="text-sm text-red-600 mt-1">{slugError}</p>}
          {generatedSlug && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="primary">生成: {generatedSlug}</Badge>
            </div>
          )}
        </div>

        <InputField
          name="url"
          label="目标 URL"
          type="url"
          required
          placeholder="https://example.com"
          helperText="必须是有效的 HTTPS URL"
        />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">元数据（可选）</h3>

          <InputField
            name="metadata.title"
            label="标题"
            placeholder="我的很棒的链接"
            helperText="链接的显示名称"
          />

          <TextAreaField
            name="metadata.description"
            label="描述"
            placeholder="简短描述..."
            helperText="最多 1000 个字符"
            rows={3}
          />

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...methods.register('metadata.showWarning')}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">重定向前显示警告</span>
            </label>
          </div>
        </div>

        <Button type="submit" disabled={isLoading} isLoading={isLoading} className="w-full">
          {isLoading
            ? isEditMode
              ? '更新中...'
              : '创建中...'
            : isEditMode
              ? '更新链接'
              : '创建链接'}
        </Button>

        <p className="text-xs text-gray-500 text-center">创建链接即表示您同意我们的服务条款</p>
      </form>
    </FormProvider>
  );
}

LinkCreationForm.displayName = 'LinkCreationForm';
