'use client';

import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'bg-white border border-gray-200 rounded-lg p-6',
        'shadow-sm hover:shadow-md transition-shadow',
        interactive && 'cursor-pointer hover:border-gray-300',
        className
      )}
      {...props}
    />
  )
);

Card.displayName = 'Card';
