'use client';

import React from 'react';
import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { useFormContext } from 'react-hook-form';

export interface InputFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  required?: boolean;
  helperText?: string;
}

/**
 * InputField 分子组件
 * 结合 Input 原子组件和 react-hook-form 集成
 * 提供表单字段的完整功能：标签、输入框、错误提示和辅助文本
 */
export function InputField({
  name,
  label,
  required,
  helperText,
  ...props
}: InputFieldProps) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name]?.message as string | undefined;

  return (
    <div className="space-y-1">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <Input
        id={name}
        {...register(name)}
        {...props}
        error={error}
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

InputField.displayName = 'InputField';
