'use client';

import React, { useState, useCallback } from 'react';
import { Input } from '@/components/atoms/Input';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchInput({
  onSearch,
  placeholder = 'Search...',
  debounceMs = 300,
}: SearchInputProps) {
  const [value, setValue] = useState('');
  const debouncedValue = useDebounce(value, debounceMs);

  // JUSTIFICATION: useEffect is necessary because:
  // 1. We need to trigger search when debounced value changes, not on every keystroke
  // 2. Cannot be handled in render time - the debouncing logic is asynchronous
  // 3. Alternative considered: Could debounce in onChange, but that would duplicate logic
  React.useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  return (
    <Input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full"
    />
  );
}
