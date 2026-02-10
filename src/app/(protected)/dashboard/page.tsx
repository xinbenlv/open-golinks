import React from 'react';
import { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { LinksDashboardTable } from '@/components/organisms/LinksDashboardTable';
import { Button } from '@/components/atoms/Button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dashboard | Open GoLinks',
  description: 'Manage your short links',
};

// Fetch links from API
async function getUserLinks(userId: string) {
  try {
    // This will be fetched from the API endpoint in a real app
    // For now, return empty array as placeholder
    return [];
  } catch (error) {
    console.error('Failed to fetch links:', error);
    return [];
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const links = await getUserLinks(user.id);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Links</h1>
              <p className="text-gray-600 mt-1">Manage all your short links</p>
            </div>
            <Link href="/create">
              <Button>+ Create New Link</Button>
            </Link>
          </div>

          <LinksDashboardTable
            initialLinks={links}
            baseUrl={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
          />
        </div>
      </div>
    </div>
  );
}
