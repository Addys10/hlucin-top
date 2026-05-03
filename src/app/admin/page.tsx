'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Camera, LogOut, Trash2, X } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'

type Team = { id: string; name: string; auth_user_id: string }
type Tab = 'teams' | 'catch'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

async function adminPost(path: string, body: object) {
  const token = await getToken()
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Chyba serveru.')
  return json
}

async function compressAndUpload(file: File, path: string): Promise<string> {
  const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true })
  const ext = compressed.type === 'image/png' ? 'png' : 'jpg'
  const fullPath = `${path}.${ext}`
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.storage
      .from('catches')
      .upload(fullPath, compressed, { upsert: true, contentType: compressed.type })
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(data.path)
      return publicUrl
    }
    if (i < 2) await new Promise(r => setTimeout(r, 1200 * (i + 1)))
  }
  throw new Error('Nahrávání fotky selhalo.')
}

// ─── PhotoPicker ─────────────────────────────────────────────────────────────

function PhotoPicker({ label, preview, onChange, onClear, disabled }: {
  label: string
  preview: string | null
  onChange: (f: File) => void
  onClear: () => void
  disabled: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-[var(--ds-ink-2)]">{label}<span className="text-red-500 ml-0.5">*</span></label>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-[var(--ds-border)]" style={{ aspectRatio: '4/3' }}>
          <Image src={preview} alt="náhled" fill className="object-cover" />
          {!disabled && (
            <button type="button" onClick={onClear} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={disabled}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--ds-border)] bg-[var(--ds-sand-50)] hover:border-[var(--ds-forest-lt)] hover:bg-[var(--ds-forest-wash)] transition-colors disabled:opacity-50 py-8">
          <Camera className="w-6 h-6 text-[var(--ds-ink-4)]" />
          <span className="text-sm text-[var(--ds-ink-4)]">Vybrat fotku</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = '' }} />
    </div>
  )
}

// ─── Teams tab ───────────────────────────────────────────────────────────────

function TeamsTab({ teams, onRefresh }: { teams: Team[]; onRefresh: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setCreating(true)
    try {
      await adminPost('/api/admin/create-team', { name, username, password })
      setName(''); setUsername(''); setPassword('')
      setSuccess(`Tým "${name}" vytvořen.`)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(team: Team) {
    if (!confirm(`Smazat tým "${team.name}" včetně všech úlovků?`)) return
    setDeletingId(team.id)
    try {
      await adminPost('/api/admin/delete-team', { teamId: team.id })
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Team list */}
      <div className="bg-white border border-[var(--ds-border)] rounded-[18px] shadow-sm overflow-hidden mb-5">
        <div className="px-4 py-3.5 text-[13px] font-bold text-[var(--ds-ink-3)] border-b border-[var(--ds-border)] bg-[var(--ds-sand-50)]">
          Týmy ({teams.length})
        </div>
        {teams.length === 0 ? (
          <p className="text-center py-10 text-[var(--ds-ink-4)] text-sm">Žádné týmy</p>
        ) : (
          teams.map(team => {
            return (
              <div key={team.id} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-0 border-[var(--ds-border)] hover:bg-[var(--ds-sand-50)]">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--ds-ink)] text-[15px]">{team.name}</p>
                  <p className="text-xs text-[var(--ds-ink-4)] font-mono truncate">{team.auth_user_id}</p>
                </div>
                <button
                  onClick={() => handleDelete(team)}
                  disabled={deletingId === team.id}
                  className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  title="Smazat tým"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Create team form */}
      <div className="bg-white border border-[var(--ds-border)] rounded-[24px] shadow-sm p-6 mb-5">
        <h2 className="text-[16px] font-bold text-[var(--ds-ink)] mb-5">Přidat tým</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] mb-1.5">Název týmu<span className="text-red-500 ml-0.5">*</span></label>
            <input
              value={name} onChange={e => setName(e.target.value)} required disabled={creating}
              placeholder="Tým Hlučín"
              className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] mb-1.5">Uživatelské jméno<span className="text-red-500 ml-0.5">*</span></label>
              <input
                value={username} onChange={e => setUsername(e.target.value)} required disabled={creating}
                placeholder="hlucin-duo"
                className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] mb-1.5">Heslo<span className="text-red-500 ml-0.5">*</span></label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={creating}
                placeholder="••••••••"
                className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600 font-medium">{success}</p>}
          <button type="submit" disabled={creating}
            className="w-full bg-[var(--ds-forest)] hover:bg-[var(--ds-forest-mid)] disabled:opacity-60 text-white font-bold rounded-xl h-[52px] text-sm transition-colors shadow-[0_2px_8px_oklch(30%_0.10_148/0.25)]">
            {creating ? 'Vytvářím...' : 'Vytvořit tým'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Add catch tab ────────────────────────────────────────────────────────────

function AddCatchTab({ teams }: { teams: Team[] }) {
  const [teamId, setTeamId] = useState('')
  const [fishType, setFishType] = useState<'Kapr' | 'Amur'>('Kapr')
  const [weightKg, setWeightKg] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [photo1File, setPhoto1File] = useState<File | null>(null)
  const [photo2File, setPhoto2File] = useState<File | null>(null)
  const [preview1, setPreview1] = useState<string | null>(null)
  const [preview2, setPreview2] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'compressing' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState('')

  function setPhoto(slot: 1 | 2, file: File) {
    const url = URL.createObjectURL(file)
    if (slot === 1) { setPhoto1File(file); setPreview1(url) }
    else { setPhoto2File(file); setPreview2(url) }
  }

  function clearPhoto(slot: 1 | 2) {
    if (slot === 1) { setPhoto1File(null); if (preview1) URL.revokeObjectURL(preview1); setPreview1(null) }
    else { setPhoto2File(null); if (preview2) URL.revokeObjectURL(preview2); setPreview2(null) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const weight_g = Math.round(parseFloat(weightKg) * 1000)
    const length_mm = lengthCm ? Math.round(parseFloat(lengthCm) * 10) : null

    if (!teamId) { setError('Vyberte tým.'); return }
    if (!weightKg || isNaN(weight_g) || weight_g <= 0) { setError('Zadejte platnou váhu.'); return }
    if (weight_g > 100_000) { setError('Váha nesmí překročit 100 kg.'); return }
    if (!photo1File || !photo2File) { setError('Obě fotky jsou povinné.'); return }

    try {
      setStatus('compressing')
      const timestamp = Date.now()
      const [photo_url_1, photo_url_2] = await Promise.all([
        compressAndUpload(photo1File, `${teamId}/${timestamp}_1`),
        compressAndUpload(photo2File, `${teamId}/${timestamp}_2`),
      ])

      setStatus('uploading')
      await adminPost('/api/admin/add-catch', { team_id: teamId, fish_type: fishType, weight_g, length_mm, photo_url_1, photo_url_2 })

      setTeamId(''); setFishType('Kapr'); setWeightKg(''); setLengthCm('')
      clearPhoto(1); clearPhoto(2)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.')
      setStatus('idle')
    }
  }

  const busy = status === 'compressing' || status === 'uploading'

  return (
    <div className="bg-white border border-[var(--ds-border)] rounded-[24px] shadow-sm p-6 mb-5">
      <h2 className="text-[16px] font-bold text-[var(--ds-ink)] mb-5">Přidat úlovek za tým</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Team picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] mb-1.5">Tým<span className="text-red-500 ml-0.5">*</span></label>
          <select value={teamId} onChange={e => setTeamId(e.target.value)} disabled={busy} required
            className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50 bg-white">
            <option value="">— Vyberte tým —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Fish type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--ds-ink-2)]">Druh ryby</label>
          <div className="grid grid-cols-2 gap-2">
            {(['Kapr', 'Amur'] as const).map(type => (
              <button key={type} type="button" onClick={() => setFishType(type)} disabled={busy}
                className={`h-[52px] rounded-xl text-sm font-semibold border transition-colors ${
                  fishType === type
                    ? type === 'Kapr'
                      ? 'bg-[var(--ds-forest)] text-white border-[var(--ds-forest)] shadow-[0_2px_8px_oklch(30%_0.10_148/0.30)]'
                      : 'bg-[oklch(45%_0.10_55)] text-white border-[oklch(45%_0.10_55)] shadow-[0_2px_8px_oklch(45%_0.10_55/0.30)]'
                    : 'bg-white text-[var(--ds-ink-3)] border-[var(--ds-border)] hover:border-[var(--ds-border-strong)]'
                }`}>
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Weight + length */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] mb-1.5">Váha (kg)<span className="text-red-500 ml-0.5">*</span></label>
            <input type="number" min="0" max="100" step="0.001" value={weightKg} onChange={e => setWeightKg(e.target.value)}
              placeholder="např. 27" disabled={busy}
              className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--ds-ink-2)]">Délka (cm)</label>
            <input type="number" min="0" step="0.1" value={lengthCm} onChange={e => setLengthCm(e.target.value)}
              placeholder="např. 30" disabled={busy}
              className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50" />
          </div>
        </div>

        {/* Photos */}
        <div className="grid grid-cols-2 gap-3">
          <PhotoPicker label="Fotka 1" preview={preview1} onChange={f => setPhoto(1, f)} onClear={() => clearPhoto(1)} disabled={busy} />
          <PhotoPicker label="Fotka 2" preview={preview2} onChange={f => setPhoto(2, f)} onClear={() => clearPhoto(2)} disabled={busy} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {status === 'compressing' && (
          <div className="flex items-center gap-2 text-sm text-[var(--ds-forest-lt)] bg-[var(--ds-forest-pale)] px-3 py-2 rounded-xl">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
            Komprimuji fotky...
          </div>
        )}
        {status === 'uploading' && (
          <div className="flex items-center gap-2 text-sm text-[var(--ds-forest-lt)] bg-[var(--ds-forest-pale)] px-3 py-2 rounded-xl">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
            Nahrávám...
          </div>
        )}
        {status === 'done' && (
          <p className="text-sm text-green-600 font-medium bg-green-50 px-3 py-2 rounded-xl">Úlovek uložen!</p>
        )}

        <button type="submit" disabled={busy}
          className="w-full bg-[var(--ds-forest)] hover:bg-[var(--ds-forest-mid)] disabled:opacity-60 text-white font-bold rounded-xl h-[52px] text-sm transition-colors shadow-[0_2px_8px_oklch(30%_0.10_148/0.25)]">
          {busy ? 'Ukládám...' : 'Uložit úlovek'}
        </button>
      </form>
    </div>
  )
}

// ─── Admin page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('teams')
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  async function loadTeams() {
    const { data } = await supabase.from('teams').select('id, name, auth_user_id').eq('is_admin', false).order('name')
    setTeams(data ?? [])
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: teamData } = await supabase
        .from('teams')
        .select('is_admin')
        .eq('auth_user_id', user.id)
        .single()

      if (!teamData?.is_admin) { router.push('/'); return }

      await loadTeams()
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--ds-bg)] flex items-center justify-center">
        <p className="text-[var(--ds-ink-4)] text-sm">Načítám...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--ds-bg)]">

      {/* Navbar */}
      <header className="bg-[var(--ds-forest)] border-b border-[oklch(100%_0_0/0.08)] shadow-[0_2px_12px_oklch(16%_0.02_80/0.18)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Image src="/image.png" alt="Hlučín Top 3" width={32} height={32} className="rounded-lg shrink-0" />
            <span className="font-bold text-white text-base">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold text-[oklch(100%_0_0/0.70)] hover:text-white transition-colors">
              Výsledky
            </Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
              className="flex items-center gap-1.5 text-xs text-[oklch(100%_0_0/0.55)] hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Odhlásit
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-[var(--ds-border)] rounded-xl p-1 shadow-sm mb-6">
          {([['teams', 'Týmy'], ['catch', 'Přidat úlovek']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 h-10 rounded-lg font-semibold text-sm transition-all ${tab === key ? 'bg-[var(--ds-forest)] text-white shadow-sm' : 'bg-transparent text-[var(--ds-ink-3)] hover:bg-[var(--ds-sand-100)] hover:text-[var(--ds-ink)]'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'teams' && <TeamsTab teams={teams} onRefresh={loadTeams} />}
        {tab === 'catch' && <AddCatchTab teams={teams} />}
      </main>
    </div>
  )
}
