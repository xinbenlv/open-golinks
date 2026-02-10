'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

const alertVariants = cva(
  'relative w-full px-4 py-3 rounded-md border',
  {
    variants: {
      variant: {
        success:
          'border-green-200 bg-green-50 text-green-900',
        error:
          'border-red-200 bg-red-50 text-red-900',
        warning:
          'border-amber-200 bg-amber-50 text-amber-900',
        info:
          'border-blue-200 bg-blue-50 text-blue-900',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  onClose?: () => void;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, title, onClose, children, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(alertVariants({ variant }), className)}
      role="alert"
      {...props}
    >
      {title && <h3 className="font-medium mb-1">{title}</h3>}
      <div className="text-sm">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close alert"
        >
          ✕
        </button>
      )}
    </div>
  )
);

Alert.displayName = 'Alert';
