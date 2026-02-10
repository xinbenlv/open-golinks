'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Card } from '@/components/atoms/Card';
import { FilterBar } from '@/components/molecules/FilterBar';
import { Pagination } from '@/components/molecules/Pagination';
import { CopyButton } from '@/components/molecules/CopyButton';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import type { LinkRecord } from '@/types/database';

interface LinksDashboardTableProps {
  initialLinks: LinkRecord[];
  baseUrl: string;
}

export function LinksDashboardTable({
  initialLinks,
  baseUrl,
}: LinksDashboardTableProps) {
  const router = useRouter();
  const { copy } = useCopyToClipboard();
  const [links, setLinks] = useState(initialLinks);
  const [search, setSearch] = useState('');
  const [filterRegex, setFilterRegex] = useState('');
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter and search
  const filteredLinks = useMemo(() => {
    let result = links;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (link) =>
          link.slug.toLowerCase().includes(searchLower) ||
          link.url.toLowerCase().includes(searchLower)
      );
    }

    // Regex filter
    if (filterRegex) {
      try {
        const regex = new RegExp(filterRegex);
        result = result.filter((link) => regex.test(link.slug));
      } catch {
        // Invalid regex, return all
      }
    }

    return result;
  }, [links, search, filterRegex]);

  const totalPages = Math.ceil(filteredLinks.length / itemsPerPage);
  const paginatedLinks = filteredLinks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSelectLink = (slug: string) => {
    const newSelected = new Set(selectedLinks);
    if (newSelected.has(slug)) {
      newSelected.delete(slug);
    } else {
      newSelected.add(slug);
    }
    setSelectedLinks(newSelected);
  };

  const handleCopyLink = async (slug: string) => {
    const fullUrl = `${baseUrl}/${slug}`;
    await copy(fullUrl);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete ${slug}?`)) return;

    try {
      const response = await fetch(`/api/v1/links/${slug}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLinks(links.filter((l) => l.slug !== slug));
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedLinks.size} links?`)) return;

    for (const slug of selectedLinks) {
      await handleDelete(slug);
    }
    setSelectedLinks(new Set());
  };

  if (filteredLinks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          {search || filterRegex ? 'No links match your search' : 'No links yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FilterBar
        onSearch={setSearch}
        onFilter={setFilterRegex}
        onViewChange={setViewMode}
        currentView={viewMode}
      />

      {selectedLinks.size > 0 && (
        <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-900">
            {selectedLinks.size} selected
          </span>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteSelected}
          >
            Delete Selected
          </Button>
        </div>
      )}

      {viewMode === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedLinks.size === paginatedLinks.length && paginatedLinks.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLinks(
                          new Set(paginatedLinks.map((l) => l.slug))
                        );
                      } else {
                        setSelectedLinks(new Set());
                      }
                    }}
                    aria-label="Select all links on this page"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold">Slug</th>
                <th className="text-left px-4 py-3 font-semibold">URL</th>
                <th className="text-center px-4 py-3 font-semibold">Visits</th>
                <th className="text-left px-4 py-3 font-semibold">Created</th>
                <th className="text-center px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLinks.map((link) => (
                <tr
                  key={link.slug}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedLinks.has(link.slug)}
                      onChange={() => toggleSelectLink(link.slug)}
                      aria-label={`Select ${link.slug}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-blue-600">
                    {link.slug}
                  </td>
                  <td className="px-4 py-3 text-sm truncate text-gray-600 max-w-xs">
                    {link.url}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {link.visits ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(link.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/${link.slug}/edit`)}
                    >
                      Edit
                    </Button>
                    <CopyButton
                      text={`${baseUrl}/${link.slug}`}
                      variant="ghost"
                      size="sm"
                      label="Copy"
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(link.slug)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedLinks.map((link) => (
            <Card key={link.slug} interactive>
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-blue-600">{link.slug}</h3>
                  <Badge variant={link.isPublic ? 'success' : 'gray'}>
                    {link.isPublic ? 'Public' : 'Private'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 truncate">{link.url}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    {link.visits ?? 0} visits
                  </span>
                  <div className="space-x-2 flex">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/dashboard/${link.slug}/edit`)
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(link.slug)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
