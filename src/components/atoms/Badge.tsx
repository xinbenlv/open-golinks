'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full font-medium text-xs px-2.5 py-0.5',
  {
    variants: {
      variant: {
        primary: 'bg-primary-light text-primary-dark',
        success: 'bg-green-100 text-green-900',
        error: 'bg-red-100 text-red-900',
        warning: 'bg-amber-100 text-amber-900',
        gray: 'bg-gray-100 text-gray-900',
      },
    },
    defaultVariants: {
      variant: 'gray',
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={clsx(badgeVariants({ variant }), className)} {...props} />
  )
);

Badge.displayName = 'Badge';
