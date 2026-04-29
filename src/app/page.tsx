'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, ArrowLeft, Fish, LogOut } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type Team = { id: string; name: string }
type Catch = { id: string; team_id: string; weight_g: number; fish_type: string }
type TeamScore = {
  id: string
  name: string
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
        totalWeight,
        catchCount: teamCatches.length,
        heaviestWeight: heaviest?.weight_g ?? 0,
        heaviestFish: heaviest?.fish_type ?? '—',
      }
    })
    .sort((a, b) => b.totalWeight - a.totalWeight)
}

const RANKS = [
  { bg: 'bg-yellow-400', text: 'text-yellow-900', row: 'bg-yellow-50 border-yellow-100' },
  { bg: 'bg-gray-300',   text: 'text-gray-700',   row: 'bg-gray-50 border-gray-100' },
  { bg: 'bg-orange-300', text: 'text-orange-900',  row: 'bg-orange-50 border-orange-100' },
]

// ─── Bar chart ───────────────────────────────────────────────────────────────

function BarChart({ catches }: { catches: CatchDetail[] }) {
  const byTime = [...catches].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const maxWeight = Math.max(...byTime.map(c => c.weight_g), 1)
  const top3Ids = [...catches].sort((a, b) => b.weight_g - a.weight_g).slice(0, 3).map(c => c.id)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-end gap-1.5 flex-1 pb-1">
        {byTime.map(c => {
          const pct = (c.weight_g / maxWeight) * 100
          const isTop3 = top3Ids.includes(c.id)
          return (
            <div key={c.id} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <span className="text-[10px] font-mono text-gray-500 tabular-nums leading-none">
                {(c.weight_g / 1000).toFixed(2)}
              </span>
              <div className="w-full flex items-end" style={{ height: 100 }}>
                <div
                  className={`w-full rounded-t-lg transition-all duration-700 ${isTop3 ? 'bg-blue-500' : 'bg-blue-200'}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5 border-t border-gray-100 pt-1">
        {byTime.map(c => (
          <div key={c.id} className="flex-1 text-center text-[10px] text-gray-400 tabular-nums">
            {new Date(c.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
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

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('catches')
        .select('id, fish_type, weight_g, length_mm, created_at')
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
      {/* Stats + chart */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row">
          {/* Stats */}
          <div className="sm:w-52 shrink-0 px-5 py-5 flex flex-col gap-3 border-b sm:border-b-0 sm:border-r border-gray-200">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded-lg animate-pulse" />
              ))
            ) : (
              <>
                <Stat label="Váha (top 3)" value={catches.length > 0 ? `${(totalWeight / 1000).toFixed(1)} kg` : '—'} />
                <Stat label="Celková váha" value={catches.length > 0 ? `${(catches.reduce((s, c) => s + c.weight_g, 0) / 1000).toFixed(3)} kg` : '—'} />
                <Stat label="Počet úlovků" value={String(catches.length)} />
              </>
            )}
          </div>

          {/* Chart */}
          <div className="flex-1 px-5 py-5" style={{ minHeight: 140 }}>
            {loading ? (
              <div className="h-28 flex items-end gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex-1 bg-gray-200 rounded-t-lg animate-pulse" style={{ height: `${30 + i * 12}%` }} />
                ))}
              </div>
            ) : catches.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-gray-400 text-sm">Žádné úlovky</div>
            ) : (
              <BarChart catches={catches} />
            )}
          </div>
        </div>
      </div>

      {/* Catches list */}
      <div>
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-900 text-sm">Všechny úlovky</p>
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
          catches.map((c, i) => {
            const isTop3 = top3Ids.includes(c.id)
            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 px-4 py-3.5 border-b last:border-0 ${isTop3 ? 'bg-blue-50 border-blue-100' : 'border-gray-50'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isTop3 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Fish className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-[15px]">{c.fish_type}</p>
                  <p className="text-xs text-gray-400">
                    {c.length_mm} mm · {new Date(c.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-gray-800 tabular-nums">{(c.weight_g / 1000).toFixed(3)} kg</span>
                  {isTop3 && <p className="text-[10px] text-blue-500 font-semibold">TOP 3</p>}
                </div>
                <div className="w-6 text-center text-xs text-gray-300 font-mono">#{i + 1}</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">{label}</p>
      <p className="text-sm text-gray-700 font-semibold mt-0.5">{value}</p>
    </div>
  )
}

// ─── Leaderboard page ─────────────────────────────────────────────────────────

export default function Leaderboard() {
  const [scores, setScores] = useState<TeamScore[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date())
  const [selectedTeam, setSelectedTeam] = useState<TeamScore | null>(null)
  const [teamName, setTeamName] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()

      const [{ data: teams }, { data: catches }] = await Promise.all([
        supabase.from('teams').select('id, name, auth_user_id').eq('is_admin', false),
        supabase.from('catches').select('id, team_id, weight_g, fish_type'),
      ])

      if (session?.user && teams) {
        const mine = teams.find(t => t.auth_user_id === session.user.id)
        setTeamName(mine?.name ?? null)
      } else {
        setTeamName(null)
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
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Left: logo + title */}
          <div className="flex items-center gap-2.5">
            <Image src="/image.png" alt="Hlučín Top 3" width={36} height={36} className="rounded-xl shrink-0" />
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">HLUČÍN TOP 3</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  {loading ? 'Načítám...' : updatedAt.toLocaleTimeString('cs-CZ')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: auth */}
          {teamName === undefined ? null : teamName ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-[11px] text-gray-400 leading-tight">Přihlášen jako</span>
                <span className="text-sm font-semibold text-gray-800 leading-tight">{teamName}</span>
              </div>
              <div className="w-px h-6 bg-gray-200 mx-1" />
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors px-4 py-2 rounded-xl"
              >
                Úlovky
              </Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); setTeamName(null) }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Odhlásit se"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors px-4 py-2 rounded-xl"
            >
              Přihlásit se
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Výsledky závodu</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pořadí dle součtu 3 nejtěžších úlovků</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100">
            <div className="w-8 shrink-0" />
            <div className="flex-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tým</div>
            <div className="w-28 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">Váha (top 3)</div>
            <div className="w-32 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 hidden sm:block">NR</div>
            <div className="w-12 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 hidden sm:block">PÚ</div>
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
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-0 text-left transition-opacity active:opacity-70 ${rank ? rank.row : 'border-gray-50 hover:bg-gray-50'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${rank ? `${rank.bg} ${rank.text}` : 'bg-gray-100 text-gray-400'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate text-[15px]">{team.name}</p>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <span className="font-mono font-bold text-gray-800 tabular-nums text-[15px]">
                      {team.totalWeight > 0
                        ? `${(team.totalWeight / 1000).toFixed(3)} kg`
                        : <span className="text-gray-300 font-normal">—</span>}
                    </span>
                  </div>
                  <div className="w-32 text-right shrink-0 hidden sm:block">
                    {team.heaviestWeight > 0 ? (
                      <div>
                        <span className="font-mono font-semibold text-gray-700 tabular-nums text-sm">
                          {(team.heaviestWeight / 1000).toFixed(3)} kg
                        </span>
                        <p className="text-xs text-gray-400 truncate">{team.heaviestFish}</p>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </div>
                  <div className="w-12 text-right shrink-0 text-sm text-gray-500 tabular-nums font-medium hidden sm:block">
                    {team.catchCount}
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-400 shrink-0" />
                </button>
              )
            })
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-1">
          <p className="text-xs text-gray-400"><span className="font-semibold text-gray-500">Váha (top 3)</span> — součet hmotností 3 nejtěžších úlovků</p>
          <p className="text-xs text-gray-400"><span className="font-semibold text-gray-500">NR</span> — nejtěžší ryba</p>
          <p className="text-xs text-gray-400"><span className="font-semibold text-gray-500">PÚ</span> — počet úlovků</p>
        </div>

      </main>

      {/* Team detail dialog */}
      <Dialog open={!!selectedTeam} onOpenChange={open => { if (!open) setSelectedTeam(null) }}>
        <DialogContent className="p-0 gap-0 w-full h-[100dvh] max-w-none sm:max-w-2xl sm:h-[90vh] rounded-none sm:rounded-2xl overflow-y-auto" showCloseButton={false}>
          {/* Sticky header */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 bg-white sticky top-0 z-10">
            <button
              onClick={() => setSelectedTeam(null)}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <DialogTitle className="font-semibold text-gray-900 text-[15px] truncate">
              {selectedTeam?.name}
            </DialogTitle>
          </div>

          {selectedTeam && <TeamDetail team={selectedTeam} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
