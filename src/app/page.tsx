'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronRight, ArrowLeft, Fish } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import SponsorCarousel from '@/components/SponsorCarousel'
import PhotoViewer from '@/components/PhotoViewer'
import Navbar from '@/components/Navbar'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function abbrevName(full: string | null | undefined): string {
  if (!full) return ''
  const parts = full.trim().split(/\s+/)
  if (parts.length < 2) return full
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Team = { id: string; name: string; member1?: string | null; member2?: string | null; yellow_cards?: number }
type Catch = { id: string; team_id: string; weight_g: number; fish_type: string }
type TeamScore = {
  id: string
  name: string
  member1?: string | null
  member2?: string | null
  yellow_cards: number
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
        yellow_cards: team.yellow_cards ?? 0,
        totalWeight,
        catchCount: teamCatches.length,
        heaviestWeight: heaviest?.weight_g ?? 0,
        heaviestFish: heaviest?.fish_type ?? '—',
      }
    })
    .sort((a, b) => b.totalWeight - a.totalWeight || a.name.localeCompare(b.name, 'cs'))
}

function PenaltyCards({ yellow_cards }: { yellow_cards: number }) {
  if (yellow_cards === 0) return null
  if (yellow_cards >= 2) return (
    <span className="inline-flex items-center gap-0.5 ml-1.5" title="Diskvalifikován">
      <span className="inline-block w-[9px] h-[13px] rounded-[2px] bg-red-500 rotate-[-6deg] shadow-sm" />
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5" title="Žlutá karta">
      <span className="inline-block w-[9px] h-[13px] rounded-[2px] bg-yellow-400 rotate-[-6deg] shadow-sm" />
    </span>
  )
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
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('catches')
        .select('id, fish_type, weight_g, length_mm, created_at, photo_url_1, photo_url_2, photo_url_3')
        .eq('team_id', team.id)
        .eq('status', 'approved')
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
                  {[c.photo_url_1, c.photo_url_2, c.photo_url_3].filter(Boolean).map((url, pi, arr) => (
                    <button
                      key={pi}
                      onClick={() => setLightbox({ photos: arr as string[], index: pi })}
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
        <PhotoViewer
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
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

  useEffect(() => {
    async function load() {
      const [{ data: teams }, { data: catches }] = await Promise.all([
        supabase.from('teams').select('id, name, auth_user_id, member1, member2, yellow_cards'),
        supabase.from('catches').select('id, team_id, weight_g, fish_type').eq('status', 'approved'),
      ])
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

      <Navbar />
      <SponsorCarousel />

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="mb-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-extrabold text-white leading-tight tracking-tight">Výsledky závodu</h2>
              <p className="text-sm text-white/60 mt-1">Součet 3 nejtěžších úlovků na tým</p>
            </div>
            <div className="bg-white border border-[var(--ds-border)] rounded-full px-4 py-2 shadow-sm text-[13px] font-medium text-[var(--ds-ink-3)] shrink-0 whitespace-nowrap">
              {loading ? 'Načítám…' : `Aktualizováno ${updatedAt.toLocaleTimeString('cs-CZ')}`}
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
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-full bg-[var(--ds-forest-pale)] flex items-center justify-center">
                <Fish className="w-7 h-7 text-[var(--ds-forest-lt)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--ds-ink-3)]">Závod ještě nezačal</p>
              <p className="text-sm text-[var(--ds-ink-5)]">Úlovky se zobrazí hned po prvním schválení</p>
            </div>
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
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-bold text-[var(--ds-ink)] truncate text-[17px]">{team.name}</span>
                      <span className="shrink-0"><PenaltyCards yellow_cards={team.yellow_cards} /></span>
                    </div>
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
          {(() => {
            const rank = selectedTeam ? scores.findIndex(s => s.id === selectedTeam.id) + 1 : 0
            const medalClass = rank === 1 ? 'bg-[var(--ds-gold)] text-[oklch(22%_0.06_80)] shadow-[0_2px_6px_var(--ds-gold)]'
              : rank === 2 ? 'bg-[var(--ds-silver)] text-white'
              : rank === 3 ? 'bg-[var(--ds-bronze)] text-white'
              : 'bg-[var(--ds-sand-200)] text-[var(--ds-ink-3)]'
            return (
              <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--ds-border)] bg-white sticky top-0 z-10">
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--ds-sand-100)] text-[var(--ds-ink-3)] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {rank > 0 && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] font-extrabold font-mono ${medalClass}`}>
                    {rank}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <DialogTitle className="font-extrabold text-[var(--ds-ink)] text-[15px] truncate leading-tight flex items-center gap-1">
                    {selectedTeam?.name}<PenaltyCards yellow_cards={selectedTeam?.yellow_cards ?? 0} />
                  </DialogTitle>
                  {(selectedTeam?.member1 || selectedTeam?.member2) && (
                    <p className="text-[12px] text-[var(--ds-ink-4)] truncate">
                      {[selectedTeam.member1, selectedTeam.member2].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            )
          })()}


          {selectedTeam && <TeamDetail team={selectedTeam} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
