import type { Metadata, Viewport } from 'next';
import './globals.css';
import MosaicDefs from '@/components/mosaic/MosaicDefs';
import SWRegister from '@/components/SWRegister';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Trove — keep the trove',
  description:
    'An oral-history memory agent. Sit the person you love down and just let them talk. Trove keeps every name, place and story, reconciles the tellings that don’t match, decides what to ask next, forgets the noise on purpose, and hands any piece of a whole life back to you years later.',
  applicationName: 'Trove',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/favicon.png', apple: '/icons/app-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Trove' },
  openGraph: { title: 'Trove — keep the trove', description: 'Everyone you love is a library. Keep the trove.', images: ['/brand/thumbnail.png'] },
};

export const viewport: Viewport = {
  themeColor: '#EDE6D8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MosaicDefs />
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
