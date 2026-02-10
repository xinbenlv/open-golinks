'use client';

import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  isLoading?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, isLoading, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        'w-full px-3 py-2 border border-gray-300 rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
        'placeholder:text-gray-400',
        'disabled:bg-gray-100 disabled:cursor-not-allowed',
        error && 'border-error focus:ring-error',
        className
      )}
      {...props}
    />
  )
);

Input.displayName = 'Input';
