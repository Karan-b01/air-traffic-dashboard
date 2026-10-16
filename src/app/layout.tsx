// @ts-ignore CSS is processed by Next.js; TypeScript has no declaration for it.
import './globals.css';

export const metadata = {
  title: 'Airspace | CC-VIT Flight Systems',
  description: 'Live air traffic operations dashboard for the Southern India sector.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
