import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { linkService } from '@/lib/services/link.service';
import { headers } from 'next/headers';

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
export default async function LinkResolver({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let url: string;

  try {
    // Try to resolve the link
    const result = await linkService.resolve(slug);
    url = result.url;
  } catch (error: any) {
    // If link not found or deleted, redirect to edit page
    // For any other error, also redirect to edit
    redirect(`/edit/${slug}`);
  }

  // Get warning probability and random value from headers (set by middleware)
  const headersList = await headers();
  const warnPercent = parseInt(headersList.get('x-debug-warn-percent') || '50', 10);
  const randomVal = parseFloat(headersList.get('x-debug-warn-random') || '');

  // Calculate probability
  const warnProbability = isNaN(warnPercent) ? 0.5 : Math.max(0, Math.min(100, warnPercent)) / 100;

  // Use middleware random value if available, otherwise generate new one (fallback)
  const randomCheck = isNaN(randomVal) ? Math.random() : randomVal;

  // Chance to show a warning page based on probability
  if (randomCheck < warnProbability) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full border border-yellow-200">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold mb-2 text-center text-gray-900">Redirect Warning</h1>
          <p className="mb-6 text-center text-gray-600">
            You are being redirected to an external site.
            <br />
            Please verify the URL below:
          </p>
          <div className="mb-8 p-3 bg-gray-50 rounded border border-gray-200 break-all text-sm text-center font-mono text-gray-700">
            {url}
          </div>
          <a
            href={url}
            className="block w-full text-center bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-200"
          >
            Continue to Site
          </a>
        </div>
      </div>
    );
  }

  // Redirect to the target URL with 302 (temporary redirect)
  redirect(url);
}
