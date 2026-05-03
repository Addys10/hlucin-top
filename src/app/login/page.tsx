'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const email = `${username.trim().toLowerCase()}@hlucin.local`
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Nesprávné uživatelské jméno nebo heslo.')
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--ds-forest)] to-[var(--ds-forest-mid)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <Image src="/image.png" alt="Hlučín Top 3" width={72} height={72} className="rounded-2xl shadow-xl ring-4 ring-white/20" />
          <h1 className="text-2xl font-bold text-white tracking-wide">HLUČÍN TOP 3</h1>
          <p className="text-sm text-[var(--ds-forest-pale)]">Přihlaste se ke svému týmu</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--ds-ink-2)]" htmlFor="username">Uživatelské jméno</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition"
              placeholder="hlucin-duo"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--ds-ink-2)]" htmlFor="password">Heslo</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--ds-forest)] hover:bg-[var(--ds-forest-mid)] disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {loading ? 'Přihlašuji...' : 'Přihlásit se'}
          </button>
        </form>

      </div>
    </div>
  )
}
