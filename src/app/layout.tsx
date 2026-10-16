// @ts-ignore CSS is processed by Next.js; TypeScript has no declaration for it.
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://airspace-ops.vercel.app'),
  title: 'Airspace · Night Operations Control Room',
  description: 'Tactical live air traffic control operations console with 3D vector dead reckoning and OpenSky ADS-B telemetry.',
  openGraph: {
    title: 'Airspace · Night Operations Control Room',
    description: 'Tactical live air traffic control operations console with 3D vector dead reckoning and OpenSky ADS-B telemetry.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1024,
        height: 1024,
        alt: 'Tactical 3D Earth Globe with glowing flight arcs over India',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
