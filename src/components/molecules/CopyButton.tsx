'use client';

import React from 'react';
import { Button } from '@/components/atoms/Button';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { CheckIcon } from '@/components/atoms/Icon';
import type { VariantProps } from 'class-variance-authority';

interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function CopyButton({
  text,
  label = 'Copy',
  variant = 'secondary',
  size = 'md',
  ...props
}: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => copy(text)}
      {...props}
    >
      {copied ? (
        <>
          <CheckIcon className="w-4 h-4 mr-1" />
          Copied!
        </>
      ) : (
        label
      )}
    </Button>
  );
}
