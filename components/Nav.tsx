'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/screening', label: 'Screening' },
  { href: '/app/fairness', label: 'Fairness Check' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-ink/10 bg-cream/80 backdrop-blur-sm sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg tracking-wider">
        <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7 L14.5 12 L12 17 L9.5 12 Z" fill="currentColor" stroke="none"/>
        </svg>
        HireFair
      </Link>
      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                active ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink hover:bg-ink/5'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}