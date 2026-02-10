import type { Metadata } from 'next';
import { Geist, Inter } from 'next/font/google';
import '../styles/globals.css';
import { initializeApp } from '@/lib/config/startup';

// Initialize app on server startup
void initializeApp();

const geist = Geist({ variable: '--font-display', subsets: ['latin'] });
const inter = Inter({ variable: '--font-body', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Open GoLinks v2',
  description: 'Modern URL shortening service with anonymous creation and analytics',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en" className={`${geist.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
