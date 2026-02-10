import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { linkService } from '@/lib/services/link.service';
import { ErrorCode } from '@/lib/constants/errors';

/**
 * Generate metadata for OG image and social media sharing
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const link = await linkService.get(slug);
    if (!link || link.deletedAt) {
      return {};
    }

    const origin = 'https://golinks.app';
    const shortUrl = `${origin}/${slug}`;
    // Default to SVG for OG images (lightweight, scalable)
    const qrcodeUrl = `${origin}/api/v1/links/${slug}/qrcode?format=svg`;

    // Extract metadata safely from JSON
    const metadata = link.metadata as Record<string, any> | null;
    const title = metadata?.title || `GoLinks - ${slug}`;
    const description = metadata?.description || `Short link: ${shortUrl}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: shortUrl,
        images: [
          {
            url: qrcodeUrl,
            width: 300,
            height: 300,
            alt: `QR code for ${shortUrl}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [qrcodeUrl],
      },
    };
  } catch {
    return {};
  }
}

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
