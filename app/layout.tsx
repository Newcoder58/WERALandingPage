import type { Metadata } from 'next';
import './globals.css';

const description = 'WERA is an AI-powered outfit planner that turns the clothes you already own into personalized outfits for university, work, presentations, and everyday life.';
const configuredUrl = process.env.WERA_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
let siteUrl: URL;
try { siteUrl = new URL(configuredUrl); }
catch { siteUrl = new URL('http://localhost:3000'); }

export const metadata: Metadata = {
  title: 'WERA — Your Closet. Reimagined.',
  description,
  metadataBase: siteUrl,
  alternates: { canonical: '/' },
  openGraph: { title: 'WERA — Your Closet. Reimagined.', description, type: 'website', locale: 'en_CA' },
  twitter: { card: 'summary', title: 'WERA — Your Closet. Reimagined.', description },
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
