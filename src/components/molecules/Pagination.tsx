'use client';

import React from 'react';
import { Button } from '@/components/atoms/Button';
import clsx from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxButtons?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxButtons = 5,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const halfWindow = Math.floor(maxButtons / 2);

    let start = Math.max(1, currentPage - halfWindow);
    let end = Math.min(totalPages, currentPage + halfWindow);

    if (currentPage - halfWindow < 1) {
      end = Math.min(totalPages, end + (halfWindow - currentPage + 1));
    }
    if (currentPage + halfWindow > totalPages) {
      start = Math.max(1, start - (currentPage + halfWindow - totalPages));
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        ← Prev
      </Button>

      {pages.map((page, idx) =>
        page === '...' ? (
          <span key={`${page}-${idx}`} className="text-gray-400">
            {page}
          </span>
        ) : (
          <Button
            key={page}
            variant={currentPage === page ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onPageChange(page as number)}
          >
            {page}
          </Button>
        )
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next →
      </Button>
    </div>
  );
}
