'use client';

import React from 'react';
import { Label } from '@/components/atoms/Label';
import { useFormContext } from 'react-hook-form';
import clsx from 'clsx';

export interface TextAreaFieldProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label: string;
  required?: boolean;
  helperText?: string;
}

/**
 * TextAreaField 分子组件
 * 文本区域表单字段，集成 react-hook-form
 * 提供标签、文本输入、错误提示和辅助文本
 */
export function TextAreaField({
  name,
  label,
  required,
  helperText,
  ...props
}: TextAreaFieldProps) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name]?.message as string | undefined;

  return (
    <div className="space-y-1">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <textarea
        id={name}
        className={clsx(
          'w-full px-3 py-2 border border-gray-300 rounded-md resize-none',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'placeholder:text-gray-400',
          'disabled:bg-gray-100 disabled:cursor-not-allowed',
          error && 'border-red-600 focus:ring-red-500'
        )}
        {...register(name)}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

TextAreaField.displayName = 'TextAreaField';
