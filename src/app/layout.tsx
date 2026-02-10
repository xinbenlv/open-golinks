import type { Metadata } from 'next';
import React from 'react';
import { Geist, Inter } from 'next/font/google';
import '../styles/globals.css';
import { initializeApp } from '@/lib/config/startup';

// Initialize app on server startup
void initializeApp();

const geist = Geist({ variable: '--font-display', subsets: ['latin'] });
const inter = Inter({ variable: '--font-body', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Open GoLinks v2',
    template: '%s | Open GoLinks v2',
  },
  description: 'Modern URL shortening service with anonymous creation and analytics',
  keywords: ['url shortener', 'golinks', 'open source', 'link management', 'analytics'],
  authors: [{ name: 'Open GoLinks Team' }],
  creator: 'Open GoLinks Team',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Open GoLinks v2',
    description: 'Modern URL shortening service with anonymous creation and analytics',
    siteName: 'Open GoLinks v2',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Open GoLinks v2',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Open GoLinks v2',
    description: 'Modern URL shortening service with anonymous creation and analytics',
    images: ['/opengraph-image.png'],
    creator: '@opengolinks',
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en" className={`${geist.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
