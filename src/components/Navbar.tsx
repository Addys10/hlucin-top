'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<{ userId: string } | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    async function loadAuth() {
      const { data: { session: s } } = await supabase.auth.getSession()
      if (s?.user) {
        setSession({ userId: s.user.id })
        const { data: team } = await supabase
          .from('teams')
          .select('is_admin')
          .eq('auth_user_id', s.user.id)
          .single()
        setIsAdmin(team?.is_admin ?? false)
      } else {
        setSession(null)
      }
    }
    loadAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) { setSession(null); setIsAdmin(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setSession(null); setIsAdmin(false); setMenuOpen(false)
    router.push('/')
  }

  function navLinkClass(href: string, mobile = false) {
    const isActive = pathname === href
    if (mobile) {
      return `text-sm font-semibold px-3 py-2.5 rounded-lg transition-colors w-full text-left ${
        isActive
          ? 'text-white bg-[oklch(100%_0_0/0.18)]'
          : 'text-[oklch(100%_0_0/0.80)] hover:text-white hover:bg-[oklch(100%_0_0/0.10)]'
      }`
    }
    return `text-sm font-semibold transition-colors px-3 py-2 rounded-lg ${
      isActive
        ? 'text-white bg-[oklch(100%_0_0/0.18)]'
        : 'text-[oklch(100%_0_0/0.70)] hover:text-white'
    }`
  }

  return (
    <header className="bg-[var(--ds-forest)] border-b border-[oklch(100%_0_0/0.08)] shadow-[0_2px_12px_oklch(16%_0.02_80/0.18)] sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
          <Image src="/image.png" alt="Hlučín Top 3" width={36} height={36} className="rounded-xl shrink-0" />
          <p className="font-bold text-white text-sm whitespace-nowrap">HLUČÍN TOP 3</p>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          <Link href="/" className={navLinkClass('/')}>Výsledky</Link>
          <Link href="/informace" className={navLinkClass('/informace')}>Informace</Link>
          <Link href="/sektory" className={navLinkClass('/sektory')}>Sektory</Link>

          {session && (
            <>
              <Link href="/dashboard" className={navLinkClass('/dashboard')}>Úlovky</Link>
              {isAdmin && (
                <Link href="/admin" className="text-sm font-semibold text-[var(--ds-forest)] bg-white hover:bg-[var(--ds-sand-100)] transition-colors px-3 py-2 rounded-lg">
                  Admin
                </Link>
              )}
            </>
          )}

          {session === undefined ? null : session ? (
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-[oklch(100%_0_0/0.55)] hover:text-white hover:bg-[oklch(100%_0_0/0.12)] transition-colors ml-1"
              title="Odhlásit se"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-[var(--ds-forest)] bg-white hover:bg-[var(--ds-sand-100)] transition-colors px-4 py-2 rounded-lg ml-1">
              Přihlásit se
            </Link>
          )}
        </div>

        {/* Mobile: not logged in */}
        {session === null && (
          <div className="sm:hidden flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="p-2 rounded-lg text-[oklch(100%_0_0/0.70)] hover:text-white hover:bg-[oklch(100%_0_0/0.12)] transition-colors"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/login" className="text-sm font-semibold text-[var(--ds-forest)] bg-white hover:bg-[var(--ds-sand-100)] transition-colors px-3 py-2 rounded-lg whitespace-nowrap">
              Přihlásit se
            </Link>
          </div>
        )}

        {/* Mobile: logged in — CTA + hamburger */}
        {session && (
          <>
            {pathname !== '/dashboard' && (
              <Link href="/dashboard"
                className="sm:hidden text-sm font-bold text-white bg-[oklch(100%_0_0/0.15)] hover:bg-[oklch(100%_0_0/0.22)] transition-colors px-3 py-2 rounded-lg whitespace-nowrap">
                + Přidat úlovek
              </Link>
            )}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="sm:hidden p-2 rounded-lg text-[oklch(100%_0_0/0.70)] hover:text-white hover:bg-[oklch(100%_0_0/0.12)] transition-colors"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </>
        )}
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t border-[oklch(100%_0_0/0.08)] bg-[var(--ds-forest)] px-4 py-3 flex flex-col gap-0.5">
          <Link href="/" onClick={() => setMenuOpen(false)} className={navLinkClass('/', true)}>Výsledky</Link>
          <Link href="/informace" onClick={() => setMenuOpen(false)} className={navLinkClass('/informace', true)}>Informace</Link>
          <Link href="/sektory" onClick={() => setMenuOpen(false)} className={navLinkClass('/sektory', true)}>Sektory</Link>
          {session && (
            <>
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className={navLinkClass('/dashboard', true)}>Úlovky</Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className={navLinkClass('/admin', true)}>Admin</Link>
              )}
              <div className="h-px bg-[oklch(100%_0_0/0.10)] my-1.5" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-semibold text-[oklch(100%_0_0/0.55)] hover:text-white hover:bg-[oklch(100%_0_0/0.10)] px-3 py-2.5 rounded-lg transition-colors w-full text-left"
              >
                <LogOut className="w-4 h-4" />
                Odhlásit se
              </button>
            </>
          )}
        </div>
      )}
    </header>
  )
}
