'use client';

import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { InputField } from '@/components/molecules/InputField';
import { TextAreaField } from '@/components/molecules/TextAreaField';
import { Button } from '@/components/atoms/Button';
import { Alert } from '@/components/atoms/Alert';
import { Badge } from '@/components/atoms/Badge';
import { CreateLinkSchema, type CreateLinkInput } from '@/lib/validations/schemas';
import { generateRandomSlug } from '@/lib/utils/slug-gen';

export interface LinkCreationFormProps {
  onSuccess?: (slug: string) => void;
  isAnonymous?: boolean;
  initialSlug?: string;
  initialUrl?: string;
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
}: LinkCreationFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatedSlug, setGeneratedSlug] = useState(initialSlug);
  const [slugError, setSlugError] = useState<string | null>(null);

  const methods = useForm<CreateLinkInput>({
    resolver: zodResolver(CreateLinkSchema),
    defaultValues: {
      slug: initialSlug,
      url: initialUrl,
      metadata: {
        title: '',
        description: '',
        showWarning: false,
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

      const response = await fetch('/api/v1/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorCode = errorData.error?.code;

        // 错误代码到用户消息的映射
        const errorMap: Record<string, string> = {
          'SLUG_CONFLICT': '此 slug 已被占用',
          'SLUG_RESERVED': '此 slug 为保留字符',
          'SLUG_INVALID_FORMAT': '无效的 slug 格式（3-50 个字符，字母、数字和连字符）',
          'URL_INVALID': '无效的 URL 格式',
          'URL_PRIVATE_IP_BLOCKED': '不能使用私有 IP 地址',
          'TURNSTILE_REQUIRED': '请完成 Turnstile 验证',
          'TURNSTILE_INVALID': 'Turnstile 验证失败',
          'RATE_LIMITED': '请求过于频繁，请稍后重试',
        };

        setError(errorMap[errorCode] || '链接创建失败');

        if (errorCode === 'SLUG_CONFLICT') {
          setSlugError('Slug 已被占用');
        }
        return;
      }

      const result = await response.json();
      setSuccess(true);
      onSuccess?.(result.data.slug);

      // 重置表单
      methods.reset();
      setGeneratedSlug(undefined);
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 成功状态显示
  if (success && generatedSlug) {
    return (
      <Alert variant="success" title="链接创建成功！">
        <p className="mb-2">您的新短链接：</p>
        <code className="bg-white bg-opacity-50 px-2 py-1 rounded text-sm">
          {typeof window !== 'undefined' ? window.location.origin : 'https://golinks.app'}/{generatedSlug}
        </code>
      </Alert>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="space-y-6 max-w-2xl"
      >
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Slug</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAutoSlug}
            >
              生成
            </Button>
          </div>
          <InputField
            name="slug"
            label="自定义 slug（可选）"
            placeholder="my-link"
            helperText="3-50 个字符，字母/数字/连字符。留空可自动生成"
            onChange={(e) => handleSlugChange(e.target.value)}
          />
          {slugError && (
            <p className="text-sm text-red-600 mt-1">{slugError}</p>
          )}
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

        <Button
          type="submit"
          disabled={isLoading}
          isLoading={isLoading}
          className="w-full"
        >
          {isLoading ? '创建中...' : '创建链接'}
        </Button>

        <p className="text-xs text-gray-500 text-center">
          创建链接即表示您同意我们的服务条款
        </p>
      </form>
    </FormProvider>
  );
}

LinkCreationForm.displayName = 'LinkCreationForm';
