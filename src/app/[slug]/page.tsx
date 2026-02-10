import { redirect } from 'next/navigation';
import { linkService } from '@/lib/services/link.service';
import { ErrorCode } from '@/lib/constants/errors';

/**
 * Dynamic route for short links
 * - If link exists and is valid: redirect to target URL
 * - If link not found or deleted: redirect to /edit/:slug
 */
export default async function LinkResolver({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const { slug } = await params;

  try {
    // Try to resolve the link
    const { url } = await linkService.resolve(slug);

    // Redirect to the target URL with 302 (temporary redirect)
    redirect(url);
  } catch (error: any) {
    // If link not found or deleted, redirect to edit page
    if (
      error.code === ErrorCode.LINK_NOT_FOUND ||
      error.code === ErrorCode.LINK_DELETED
    ) {
      redirect(`/edit/${slug}`);
    }

    // For any other error, also redirect to edit
    redirect(`/edit/${slug}`);
  }
}
