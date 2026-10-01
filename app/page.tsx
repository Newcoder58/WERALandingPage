import LandingPage from './landing-page';

function safeHttpsUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export default function Home() {
  return <LandingPage config={{
    embedUrl: safeHttpsUrl(process.env.VITE_APP_EMBED_URL),
    gaId: process.env.VITE_GA_MEASUREMENT_ID || '',
    instagram: safeHttpsUrl(process.env.WERA_INSTAGRAM_URL),
    tiktok: safeHttpsUrl(process.env.WERA_TIKTOK_URL),
  }} />;
}
