'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',        label: 'Dashboard' },
  { href: '/queue',   label: 'Queue'     },
  { href: '/write',   label: 'Write'     },
  { href: '/upload',  label: 'Upload'    },
  { href: '/history', label: 'History'   },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1e1e1e] bg-[#0a0a0a]/90 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Brand */}
        <span className="text-[#c8a96e] font-semibold tracking-wide text-sm uppercase shrink-0">
          Utopia
        </span>

        {/* Links — scrollable on mobile so they never wrap or get cut off */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1 justify-end">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2 text-sm rounded-lg whitespace-nowrap transition-colors shrink-0 ${
                path === l.href
                  ? 'text-[#c8a96e] bg-[#c8a96e]/10'
                  : 'text-[#666] hover:text-[#ccc] active:bg-white/5'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

      </div>
    </nav>
  )
}
