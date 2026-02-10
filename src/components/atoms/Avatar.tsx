'use client';

import React from 'react';
import clsx from 'clsx';

interface AvatarProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar = React.forwardRef<HTMLImageElement, AvatarProps>(
  ({ size = 'md', initials, className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
    };

    if (!props.src && initials) {
      return (
        <div
          className={clsx(
            'rounded-full bg-primary text-white flex items-center justify-center font-medium',
            sizeClasses[size],
            className
          )}
        >
          {initials}
        </div>
      );
    }

    return (
      <img
        ref={ref}
        className={clsx(
          'rounded-full object-cover',
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Avatar.displayName = 'Avatar';
