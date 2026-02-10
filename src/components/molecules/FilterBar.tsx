'use client';

import React, { useState } from 'react';
import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';
import { Alert } from '@/components/atoms/Alert';
import { SearchInput } from './SearchInput';

interface FilterBarProps {
  onSearch: (search: string) => void;
  onFilter: (regex: string) => void;
  onViewChange: (mode: 'table' | 'grid') => void;
  currentView?: 'table' | 'grid';
}

export function FilterBar({
  onSearch,
  onFilter,
  onViewChange,
  currentView = 'table',
}: FilterBarProps) {
  const [filterRegex, setFilterRegex] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);

  const validateRegex = (pattern: string) => {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  };

  const handleFilterChange = (value: string) => {
    setFilterRegex(value);

    if (value && !validateRegex(value)) {
      setFilterError('Invalid regex pattern');
    } else {
      setFilterError(null);
      onFilter(value);
    }
  };

  const clearFilter = () => {
    setFilterRegex('');
    setFilterError(null);
    onFilter('');
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <SearchInput
          onSearch={onSearch}
          placeholder="Search by slug or URL..."
          debounceMs={300}
        />

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => onViewChange('table')}
            className={currentView === 'table' ? 'bg-gray-300' : ''}
          >
            ⊞ Table
          </Button>
          <Button
            variant="secondary"
            onClick={() => onViewChange('grid')}
            className={currentView === 'grid' ? 'bg-gray-300' : ''}
          >
            ≣ Grid
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by regex pattern
          </label>
          <Input
            type="text"
            placeholder="e.g., ^event- or meeting.*2024$"
            value={filterRegex}
            onChange={(e) => handleFilterChange(e.target.value)}
            error={filterError}
          />
        </div>

        {filterRegex && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilter}
            className="self-end"
          >
            Clear filter
          </Button>
        )}
      </div>

      {filterError && (
        <Alert variant="error" onClose={() => setFilterError(null)}>
          {filterError}
        </Alert>
      )}
    </div>
  );
}
