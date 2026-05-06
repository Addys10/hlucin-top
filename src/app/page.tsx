'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, ArrowLeft, Fish, LogOut, Menu, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import SponsorCarousel from '@/components/SponsorCarousel'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function abbrevName(full: string | null | undefined): string {
  if (!full) return ''
  const parts = full.trim().split(/\s+/)
  if (parts.length < 2) return full
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Team = { id: string; name: string; member1?: string | null; member2?: string | null }
type Catch = { id: string; team_id: string; weight_g: number; fish_type: string }
type TeamScore = {
  id: string
  name: string
  member1?: string | null
  member2?: string | null
  totalWeight: number
  catchCount: number
  heaviestWeight: number
  heaviestFish: string
}
type CatchDetail = {
  id: string
  fish_type: string
  weight_g: number
  length_mm: number
  created_at: string
  photo_url_1?: string | null
  photo_url_2?: string | null
  photo_url_3?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateScores(teams: Team[], catches: Catch[]): TeamScore[] {
  return teams
    .map(team => {
      const teamCatches = catches.filter(c => c.team_id === team.id)
      const sorted = [...teamCatches].sort((a, b) => b.weight_g - a.weight_g)
      const totalWeight = sorted.slice(0, 3).reduce((s, c) => s + c.weight_g, 0)
      const heaviest = sorted[0]
      return {
        id: team.id,
        name: team.name,
        member1: team.member1,
        member2: team.member2,
        totalWeight,
        catchCount: teamCatches.length,
        heaviestWeight: heaviest?.weight_g ?? 0,
        heaviestFish: heaviest?.fish_type ?? '—',
      }
    })
    .sort((a, b) => b.totalWeight - a.totalWeight)
}

const RANKS = [
  { card: 'bg-gradient-to-r from-[oklch(98%_0.05_82)] to-white border-[var(--ds-gold)] border-[1.5px]', medal: 'bg-[var(--ds-gold)] text-[oklch(22%_0.06_80)] shadow-[0_2px_8px_var(--ds-gold)]', row: '' },
  { card: 'bg-gradient-to-r from-[oklch(98%_0.005_240)] to-white border-[oklch(78%_0.01_240)] border-[1.5px]', medal: 'bg-[var(--ds-silver)] text-white', row: '' },
  { card: 'bg-gradient-to-r from-[oklch(97%_0.035_55)] to-white border-[oklch(78%_0.07_55)] border-[1.5px]', medal: 'bg-[var(--ds-bronze)] text-white', row: '' },
]

// ─── Bar chart ───────────────────────────────────────────────────────────────

function BarChart({ catches }: { catches: CatchDetail[] }) {
  const byDay = Object.entries(
    catches.reduce<Record<string, number>>((acc, c) => {
      const day = new Date(c.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
      acc[day] = (acc[day] ?? 0) + c.weight_g
      return acc
    }, {})
  ).sort(([a], [b]) => {
    const parse = (s: string) => { const [d, m] = s.split('.').map(Number); return m * 100 + d }
    return parse(a) - parse(b)
  })

  const maxWeight = Math.max(...byDay.map(([, w]) => w), 1)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-end gap-2 flex-1 pb-1">
        {byDay.map(([day, weight_g]) => {
          const pct = (weight_g / maxWeight) * 100
          return (
            <div key={day} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <span className="text-[10px] font-mono text-[var(--ds-ink-3)] tabular-nums leading-none">
                {(weight_g / 1000).toFixed(2)} kg
              </span>
              <div className="w-full flex items-end" style={{ height: 100 }}>
                <div
                  className="w-full rounded-t-lg bg-[var(--ds-forest-mid)] hover:bg-[var(--ds-forest)] transition-colors transition-all duration-700"
                  style={{ height: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 border-t border-[var(--ds-border)] pt-1">
        {byDay.map(([day]) => (
          <div key={day} className="flex-1 text-center text-[10px] text-[var(--ds-ink-4)] tabular-nums">
            {day}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Team detail (inside dialog) ─────────────────────────────────────────────

function TeamDetail({ team }: { team: TeamScore }) {
  const [catches, setCatches] = useState<CatchDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('catches')
        .select('id, fish_type, weight_g, length_mm, created_at, photo_url_1, photo_url_2, photo_url_3')
        .eq('team_id', team.id)
        .order('weight_g', { ascending: false })
      setCatches(data ?? [])
      setLoading(false)
    }
    load()
  }, [team.id])

  const top3Ids = catches.slice(0, 3).map(c => c.id)
  const totalWeight = catches.slice(0, 3).reduce((s, c) => s + c.weight_g, 0)


  return (
    <div className="flex flex-col">
      {/* Stats + chart — only when loading or data present */}
      {(loading || catches.length > 0) && (
        <div className="bg-[var(--ds-sand-50)] border-b border-[var(--ds-border)]">
          <div className="flex flex-col sm:flex-row">
            {/* Stats */}
            <div className="sm:w-52 shrink-0 px-5 py-5 flex flex-col gap-3 border-b sm:border-b-0 sm:border-r border-[var(--ds-border)]">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 bg-gray-200 rounded-lg animate-pulse" />
                ))
              ) : (
                <>
                  <Stat label="Váha (top 3)" value={`${(totalWeight / 1000).toFixed(1)} kg`} />
                  <Stat label="Celková váha" value={`${(catches.reduce((s, c) => s + c.weight_g, 0) / 1000).toFixed(2)} kg`} />
                  <Stat label="Počet úlovků" value={String(catches.length)} />
                </>
              )}
            </div>

            {/* Chart */}
            <div className="flex-1 px-5 py-5 flex flex-col" style={{ minHeight: 140 }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)] mb-2">Váha dle dne</p>
              {loading ? (
                <div className="h-28 flex items-end gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex-1 bg-gray-200 rounded-t-lg animate-pulse" style={{ height: `${30 + i * 12}%` }} />
                  ))}
                </div>
              ) : (
                <BarChart catches={catches} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Catches list */}
      <div>
        <div className="px-4 py-3 border-b border-[var(--ds-border)]">
          <p className="font-bold text-[var(--ds-ink-2)] text-sm">Všechny úlovky</p>
        </div>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4 border-b last:border-0">
              <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
              <div className="flex-1 h-4 bg-gray-100 rounded-full animate-pulse" />
              <div className="w-20 h-4 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))
        ) : catches.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Zatím žádné úlovky</div>
        ) : (
          catches.map((c) => {
            const isTop3 = top3Ids.includes(c.id)
            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 px-4 py-3.5 border-b last:border-0 ${isTop3 ? 'bg-[var(--ds-gold-pale)] border-[var(--ds-border)]' : 'border-[var(--ds-border)]'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isTop3 ? 'bg-[var(--ds-gold-pale)] text-[oklch(48%_0.12_82)]' : 'bg-[var(--ds-forest-pale)] text-[var(--ds-forest-mid)]'}`}>
                  <Fish className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--ds-ink)] text-[14px]">{c.fish_type}</p>
                  <p className="text-xs text-[var(--ds-ink-4)]">
                    {new Date(c.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-extrabold text-[var(--ds-ink)] tabular-nums text-[16px]">{(c.weight_g / 1000).toFixed(2)} kg</span>
                  {isTop3 && <span className="text-[10px] font-bold bg-[var(--ds-gold-pale)] text-[oklch(40%_0.13_82)] px-2 py-0.5 rounded-full mt-1 inline-block">TOP 3</span>}
                </div>
                <div className="flex gap-1 shrink-0">
                  {[c.photo_url_1, c.photo_url_2, c.photo_url_3].filter(Boolean).map((url, pi) => (
                    <button
                      key={pi}
                      onClick={() => setLightbox(url!)}
                      className="w-9 h-9 rounded-lg overflow-hidden border border-[var(--ds-border)] shrink-0 active:opacity-70"
                    >
                      <Image src={url!} alt="foto" width={36} height={36} className="object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <Image
            src={lightbox}
            alt="foto"
            fill
            className="object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--ds-sand-100)] border border-[var(--ds-border)] rounded-xl px-3 py-3">
      <p className="text-[10px] font-bold text-[var(--ds-forest-lt)] uppercase tracking-[0.08em] mb-0.5">{label}</p>
      <p className="text-[22px] font-extrabold font-mono text-[var(--ds-ink)] leading-tight">{value}</p>
    </div>
  )
}

// ─── Leaderboard page ─────────────────────────────────────────────────────────

export default function Leaderboard() {
  const [scores, setScores] = useState<TeamScore[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date())
  const [selectedTeam, setSelectedTeam] = useState<TeamScore | null>(null)
  const [session, setSession] = useState<{ userId: string } | null | undefined>(undefined)
  const [menuOpen, setMenuOpen] = useState(false)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()

      const [{ data: teams }, { data: catches }] = await Promise.all([
        supabase.from('teams').select('id, name, auth_user_id, member1, member2'),
        supabase.from('catches').select('id, team_id, weight_g, fish_type'),
      ])

      if (session?.user) {
        setSession({ userId: session.user.id })
        const { data: myTeam } = await supabase
          .from('teams')
          .select('name, is_admin')
          .eq('auth_user_id', session.user.id)
          .single()
        setIsAdmin(myTeam?.is_admin ?? false)
        setTeamName(myTeam?.name ?? null)
      } else {
        setSession(null)
        setIsAdmin(false)
      }
      if (teams && catches) {
        setScores(calculateScores(teams, catches))
        setUpdatedAt(new Date())
      }
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catches' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="min-h-screen">

      {/* Navbar */}
      <header className="bg-[var(--ds-forest)] border-b border-[oklch(100%_0_0/0.08)] shadow-[0_2px_12px_oklch(16%_0.02_80/0.18)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Left: logo + title */}
          <div className="flex items-center gap-2.5">
            <Image src="/image.png" alt="Hlučín Top 3" width={36} height={36} className="rounded-xl shrink-0" />
            <p className="font-bold text-white text-sm">HLUČÍN TOP 3</p>
          </div>

          {/* Desktop nav — always visible on sm+ */}
          <div className="hidden sm:flex items-center gap-2">
            {session === null && (
              <>
                <Link href="/informace" className="text-sm font-semibold text-[oklch(100%_0_0/0.70)] hover:text-white transition-colors px-3 py-2 rounded-lg">
                  Informace
                </Link>
                <Link href="/sektory" className="text-sm font-semibold text-[oklch(100%_0_0/0.70)] hover:text-white transition-colors px-3 py-2 rounded-lg">
                  Sektory
                </Link>
              </>
            )}
            {session && teamName && (
              <>
                <div className="flex flex-col items-end shrink-0 max-w-[160px]">
                  <span className="text-[11px] text-[oklch(100%_0_0/0.65)] leading-tight">Přihlášen jako</span>
                  <span className="text-sm font-semibold text-white leading-tight truncate w-full text-right">{teamName}</span>
                </div>
                <div className="w-px h-5 bg-[oklch(100%_0_0/0.15)] mx-1" />
                <Link href="/informace" className="text-sm font-semibold text-white bg-[oklch(100%_0_0/0.15)] hover:bg-[oklch(100%_0_0/0.22)] transition-colors px-3 py-2 rounded-lg">
                  Informace
                </Link>
                <Link href="/sektory" className="text-sm font-semibold text-white bg-[oklch(100%_0_0/0.15)] hover:bg-[oklch(100%_0_0/0.22)] transition-colors px-3 py-2 rounded-lg">
                  Sektory
                </Link>
                <Link href="/dashboard" className="text-sm font-semibold text-white bg-[oklch(100%_0_0/0.15)] hover:bg-[oklch(100%_0_0/0.22)] transition-colors px-3 py-2 rounded-lg">
                  Úlovky
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="text-sm font-semibold text-[var(--ds-forest)] bg-white hover:bg-[var(--ds-sand-100)] transition-colors px-3 py-2 rounded-lg">
                    Admin
                  </Link>
                )}
              </>
            )}
            {session === undefined ? null : session ? (
              <button
                onClick={async () => { await supabase.auth.signOut(); setSession(null); setTeamName(null); setIsAdmin(false) }}
                className="p-2 rounded-lg text-[oklch(100%_0_0/0.55)] hover:text-white hover:bg-[oklch(100%_0_0/0.12)] transition-colors"
                title="Odhlásit se"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-[var(--ds-forest)] bg-white hover:bg-[var(--ds-sand-100)] transition-colors px-4 py-2 rounded-lg">
                Přihlásit se
              </Link>
            )}
          </div>

          {/* Mobile: not logged in — show links inline */}
          {session === null && (
            <div className="sm:hidden flex items-center gap-1">
              <Link href="/informace" className="text-sm font-semibold text-[oklch(100%_0_0/0.70)] hover:text-white transition-colors px-2.5 py-2 rounded-lg">
                Informace
              </Link>
              <Link href="/sektory" className="text-sm font-semibold text-[oklch(100%_0_0/0.70)] hover:text-white transition-colors px-2.5 py-2 rounded-lg">
                Sektory
              </Link>
              <Link href="/login" className="text-sm font-semibold text-[var(--ds-forest)] bg-white hover:bg-[var(--ds-sand-100)] transition-colors px-3 py-2 rounded-lg">
                Přihlásit se
              </Link>
            </div>
          )}

          {/* Mobile: logged in — hamburger in middle, logout at end */}
          {session && (
            <>
              <Link href="/dashboard"
                className="sm:hidden text-sm font-bold text-white bg-[oklch(100%_0_0/0.15)] hover:bg-[oklch(100%_0_0/0.22)] transition-colors px-3 py-2 rounded-lg whitespace-nowrap">
                + Přidat úlovek
              </Link>
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

        {/* Mobile dropdown — only when logged in */}
        {menuOpen && session && (
          <div className="sm:hidden border-t border-[oklch(100%_0_0/0.08)] bg-[var(--ds-forest)] px-4 py-3 flex flex-col gap-1">
            <Link href="/informace" onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-[oklch(100%_0_0/0.80)] hover:text-white hover:bg-[oklch(100%_0_0/0.10)] px-3 py-2.5 rounded-lg transition-colors">
              Informace
            </Link>
            <Link href="/sektory" onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-[oklch(100%_0_0/0.80)] hover:text-white hover:bg-[oklch(100%_0_0/0.10)] px-3 py-2.5 rounded-lg transition-colors">
              Sektory
            </Link>
            <Link href="/dashboard" onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-[oklch(100%_0_0/0.80)] hover:text-white hover:bg-[oklch(100%_0_0/0.10)] px-3 py-2.5 rounded-lg transition-colors">
              Úlovky
            </Link>
            {isAdmin && (
              <Link href="/admin" onClick={() => setMenuOpen(false)}
                className="text-sm font-semibold text-[oklch(100%_0_0/0.80)] hover:text-white hover:bg-[oklch(100%_0_0/0.10)] px-3 py-2.5 rounded-lg transition-colors">
                Admin
              </Link>
            )}
            <div className="h-px bg-[oklch(100%_0_0/0.10)] my-1" />
            <button
              onClick={async () => { await supabase.auth.signOut(); setSession(null); setTeamName(null); setIsAdmin(false); setMenuOpen(false) }}
              className="flex items-center gap-2 text-sm font-semibold text-[oklch(100%_0_0/0.55)] hover:text-white hover:bg-[oklch(100%_0_0/0.10)] px-3 py-2.5 rounded-lg transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              Odhlásit se
            </button>
          </div>
        )}
      </header>

      <SponsorCarousel />

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="mb-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-[var(--ds-forest-pale)] mb-1">Živé pořadí</p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-extrabold text-white leading-tight tracking-tight">Výsledky závodu</h2>
              <p className="text-sm text-white/60 mt-1">Součet 3 nejtěžších úlovků na tým</p>
            </div>
            <div className="flex items-center gap-2 bg-white border border-[var(--ds-border)] rounded-full px-4 py-2 shadow-sm font-mono text-[15px] font-medium text-[var(--ds-ink-2)] shrink-0 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[oklch(60%_0.20_148)] shrink-0 shadow-[0_0_0_0_oklch(60%_0.20_148)] animate-pulse" />
              {loading ? 'Načítám...' : updatedAt.toLocaleTimeString('cs-CZ')}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[18px] border border-[var(--ds-border)] overflow-hidden shadow-[0_3px_10px_oklch(16%_0.02_80/0.09),0_1px_3px_oklch(16%_0.02_80/0.05)]">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--ds-border)]">
            <div className="w-8 shrink-0" />
            <div className="flex-1 text-xs font-semibold text-[var(--ds-ink-4)] uppercase tracking-wide">Tým</div>
            <div className="w-28 text-right text-xs font-semibold text-[var(--ds-ink-4)] uppercase tracking-wide shrink-0">Váha (top 3)</div>
            <div className="w-32 text-right text-xs font-semibold text-[var(--ds-ink-4)] uppercase tracking-wide shrink-0 hidden sm:block">NR</div>
            <div className="w-12 text-right text-xs font-semibold text-[var(--ds-ink-4)] uppercase tracking-wide shrink-0 hidden sm:block">PÚ</div>
            <div className="w-5 shrink-0" />
          </div>

          {/* Rows */}
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse shrink-0" />
                <div className="flex-1 h-4 bg-gray-100 rounded-full animate-pulse" />
                <div className="w-20 h-4 bg-gray-100 rounded-full animate-pulse shrink-0" />
                <div className="w-16 h-4 bg-gray-100 rounded-full animate-pulse shrink-0" />
              </div>
            ))
          ) : scores.length === 0 ? (
            <div className="text-center py-14 text-gray-400 text-sm">Zatím žádné úlovky</div>
          ) : (
            scores.map((team, i) => {
              const rank = RANKS[i]
              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full flex items-center gap-3 px-5 py-4 border-b last:border-0 text-left transition-all hover:-translate-y-px hover:shadow-[0_3px_10px_oklch(16%_0.02_80/0.09)] ${rank ? rank.card : 'border-[var(--ds-border)] hover:bg-[var(--ds-sand-50)]'}`}
                >
                  <div className={rank ? `${rank.medal} w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[15px] font-extrabold font-mono` : 'bg-[var(--ds-sand-200)] text-[var(--ds-ink-3)] w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[14px] font-extrabold font-mono'}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--ds-ink)] truncate text-[17px]">{team.name}</p>
                    {(team.member1 || team.member2) && (
                      <p className="text-[12px] text-[var(--ds-ink-4)] truncate">
                        <span className="sm:hidden">{[team.member1, team.member2].filter(Boolean).map(abbrevName).join(' · ')}</span>
                        <span className="hidden sm:inline">{[team.member1, team.member2].filter(Boolean).join(' · ')}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-extrabold text-[var(--ds-ink)] tabular-nums text-[20px] leading-tight">{team.totalWeight > 0 ? (team.totalWeight / 1000).toFixed(2) : '—'}</div>
                    <div className="text-[12px] text-[var(--ds-ink-3)] font-medium">kg TOP 3</div>
                  </div>
                  <div className="w-32 text-right shrink-0 hidden sm:block">
                    {team.heaviestWeight > 0 ? (
                      <div>
                        <span className="font-mono font-bold text-[var(--ds-ink-2)] tabular-nums text-sm">
                          {(team.heaviestWeight / 1000).toFixed(2)} kg
                        </span>
                        <p className="text-xs text-[var(--ds-ink-4)] truncate">{team.heaviestFish}</p>
                      </div>
                    ) : <span className="text-[var(--ds-ink-5)]">—</span>}
                  </div>
                  <div className="w-12 text-right shrink-0 text-[var(--ds-ink-3)] font-bold font-mono tabular-nums hidden sm:block">
                    {team.catchCount}
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--ds-ink-5)] shrink-0" />
                </button>
              )
            })
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-1">
          <p className="text-xs text-white/50"><span className="font-semibold text-white/70">Váha (top 3)</span> — součet hmotností 3 nejtěžších úlovků</p>
          <p className="text-xs text-white/50"><span className="font-semibold text-white/70">NR</span> — nejtěžší ryba</p>
          <p className="text-xs text-white/50"><span className="font-semibold text-white/70">PÚ</span> — počet úlovků</p>
        </div>

      </main>

      {/* Team detail dialog */}
      <Dialog open={!!selectedTeam} onOpenChange={open => { if (!open) setSelectedTeam(null) }}>
        <DialogContent className="p-0 gap-0 w-full h-[100dvh] max-w-none sm:max-w-2xl sm:h-[90vh] rounded-none sm:rounded-2xl overflow-y-auto" showCloseButton={false} aria-describedby={undefined}>
          {/* Sticky header */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--ds-border)] bg-white sticky top-0 z-10">
            <button
              onClick={() => setSelectedTeam(null)}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--ds-sand-100)] text-[var(--ds-ink-3)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col min-w-0">
              <DialogTitle className="font-extrabold text-[var(--ds-ink)] text-[15px] truncate leading-tight">
                {selectedTeam?.name}
              </DialogTitle>
              {(selectedTeam?.member1 || selectedTeam?.member2) && (
                <p className="text-[12px] text-[var(--ds-ink-4)] truncate">
                  {[selectedTeam.member1, selectedTeam.member2].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>

          {selectedTeam && <TeamDetail team={selectedTeam} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
