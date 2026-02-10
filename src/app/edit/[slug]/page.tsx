import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { linkService } from '@/lib/services/link.service';
import { Alert } from '@/components/atoms/Alert';
import { EditPageClient } from './EditPageClient';

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();

  // Try to get the existing link
  const link = await linkService.get(slug);

  // If link exists, check permissions
  if (link) {
    // If not logged in, redirect to login
    if (!user) {
      redirect(`/auth/login?returnTo=/edit/${slug}`);
    }

    // If link has owner and it's not the current user
    if (link.ownerId && link.ownerId !== user.id) {
      // Show permission error
      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
          <div className="max-w-2xl mx-auto">
            <Alert variant="error" className="mb-8">
              <p className="font-semibold">你没有权限编辑这个链接</p>
            </Alert>
          </div>
        </div>
      );
    }
  }

  // If link exists but is anonymous, show claim prompt
  const showClaimPrompt = !!(link && !link.ownerId);

  // Serialize link to pass to Client Component (convert Dates to strings)
  const serializedLink = link
    ? {
        ...link,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
        deletedAt: link.deletedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <EditPageClient
          slug={slug}
          // @ts-expect-error Serialization of Date objects
          existingLink={serializedLink}
          showClaimPrompt={showClaimPrompt}
        />
      </div>
    </div>
  );
}
