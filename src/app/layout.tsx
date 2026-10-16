// @ts-ignore CSS is processed by Next.js; TypeScript has no declaration for it.
import './globals.css';

export const metadata = {
  title: 'CC-VIT Airspace',
  description: 'Live air traffic dashboard',
}

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
