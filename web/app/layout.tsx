import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'Utopia OS',
  description: 'LinkedIn content management for Utopia Advanced Composites Manufacturing',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-[#e8e8e8] min-h-screen">
        <Nav />
        <main className="max-w-5xl mx-auto px-4 md:px-6 pt-20 pb-16">
          {children}
        </main>
      </body>
    </html>
  )
}
