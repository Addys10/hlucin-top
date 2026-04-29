'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Fish, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Team = { id: string; name: string }
type Catch = { id: string; fish_type: string; weight_g: number; length_mm: number; created_at: string }

export default function Dashboard() {
  const router = useRouter()
  const [team, setTeam] = useState<Team | null>(null)
  const [catches, setCatches] = useState<Catch[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [fishType, setFishType] = useState<'Kapr' | 'Amur'>('Kapr')
  const [weightKg, setWeightKg] = useState('')
  const [lengthCm, setLengthCm] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()

      if (!teamData) { router.push('/login'); return }
      setTeam(teamData)

      const { data: catchData } = await supabase
        .from('catches')
        .select('id, fish_type, weight_g, length_mm, created_at')
        .eq('team_id', teamData.id)
        .order('created_at', { ascending: false })

      setCatches(catchData ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!team) return
    setError('')
    setSuccess(false)
    setSubmitting(true)

    const weight_g = Math.round(parseFloat(weightKg) * 1000)
    const length_mm = lengthCm ? Math.round(parseFloat(lengthCm) * 10) : null

    if (!weightKg || isNaN(weight_g)) {
      setError('Zadejte váhu.')
      setSubmitting(false)
      return
    }
    if (weight_g <= 0) {
      setError('Váha musí být větší než 0.')
      setSubmitting(false)
      return
    }
    if (weight_g > 100_000) {
      setError('Váha nesmí překročit 100 kg.')
      setSubmitting(false)
      return
    }
    if (length_mm !== null && length_mm <= 0) {
      setError('Délka musí být větší než 0.')
      setSubmitting(false)
      return
    }

    const { data, error } = await supabase.from('catches').insert({
      team_id: team.id,
      fish_type: fishType.trim(),
      weight_g,
      length_mm,
    }).select().single()

    if (error) {
      setError('Nepodařilo se uložit úlovek. Zkuste to znovu.')
      setSubmitting(false)
      return
    }

    setCatches(prev => [data, ...prev])
    setFishType('Kapr')
    setWeightKg('')
    setLengthCm('')
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    setSubmitting(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Načítám...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Image src="/image.png" alt="Hlučín Top 3" width={32} height={32} className="rounded-lg shrink-0" />
            <span className="font-bold text-gray-900 text-base">HLUČÍN TOP 3</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors">
              Výsledky
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <LogOut className="w-4 h-4" />
              Odhlásit
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Team title */}
        <div>
          <p className="text-sm text-gray-400 font-medium">Tým</p>
          <h1 className="text-2xl font-bold text-gray-900">{team?.name}</h1>
        </div>

        {/* Catch form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Přidat úlovek</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Druh ryby</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Kapr', 'Amur'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFishType(type)}
                    className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                      fishType === type
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Váha (kg)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  value={weightKg}
                  onChange={e => setWeightKg(e.target.value)}
                  placeholder="např. 27"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Délka (cm)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={lengthCm}
                  onChange={e => setLengthCm(e.target.value)}
                  placeholder="např. 30"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-600 font-medium">Úlovek uložen!</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm transition-colors mt-1"
            >
              {submitting ? 'Ukládám...' : 'Uložit úlovek'}
            </button>
          </form>
        </div>

        {/* Catches list */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Vaše úlovky</h2>
          </div>

          {catches.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Zatím žádné úlovky</div>
          ) : (
            catches.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-0 border-gray-50">
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                  <Fish className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-[15px]">{c.fish_type}</p>
                  <p className="text-xs text-gray-400">{c.length_mm} mm · {new Date(c.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className="font-mono font-bold text-gray-800 tabular-nums text-[15px]">
                  {(c.weight_g / 1000).toFixed(3)} kg
                </span>
                <div className="w-6 text-center text-xs text-gray-300 font-mono">#{catches.length - i}</div>
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  )
}
