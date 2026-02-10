'use client';

import React from 'react';
import clsx from 'clsx';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={clsx(
        'block text-sm font-medium text-gray-700 mb-1',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-error">*</span>}
    </label>
  )
);

Label.displayName = 'Label';
