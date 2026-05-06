'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Camera, Check, LogOut, Pencil, Trash2, X } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'

type Team = { id: string; name: string; auth_user_id: string; member1?: string | null; member2?: string | null }
type Tab = 'teams' | 'catch' | 'catches'
type Catch = { id: string; team_id: string; fish_type: string; weight_g: number; photo_url_1: string; photo_url_2: string; photo_url_3: string; created_at: string }

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

// ─── ReplacePhoto ─────────────────────────────────────────────────────────────

function ReplacePhoto({ label, preview, onChange, disabled }: {
  label: string
  preview: string | null
  onChange: (f: File) => void
  disabled: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-[var(--ds-ink-4)] truncate">{label}</span>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="relative rounded-lg overflow-hidden border border-[var(--ds-border)] disabled:opacity-50"
        style={{ aspectRatio: '4/3' }}
        title="Klikni pro výměnu fotky"
      >
        {preview && <Image src={preview} alt="náhled" fill className="object-cover" />}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
          <Camera className="w-5 h-5 text-white" />
        </div>
      </button>
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
  const [member1, setMember1] = useState('')
  const [member2, setMember2] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMember1, setEditMember1] = useState('')
  const [editMember2, setEditMember2] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setCreating(true)
    try {
      await adminPost('/api/admin/create-team', { name, username, password, member1, member2 })
      setName(''); setUsername(''); setPassword(''); setMember1(''); setMember2('')
      setSuccess(`Tým "${name}" vytvořen.`)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba.')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(team: Team) {
    setEditingId(team.id)
    setEditMember1(team.member1 ?? '')
    setEditMember2(team.member2 ?? '')
  }

  async function saveEdit(team: Team) {
    setSavingId(team.id)
    try {
      await adminPost('/api/admin/update-team', { teamId: team.id, member1: editMember1, member2: editMember2 })
      setEditingId(null)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při ukládání.')
    } finally {
      setSavingId(null)
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
            const isEditing = editingId === team.id
            const isSaving = savingId === team.id
            return (
              <div key={team.id} className="border-b last:border-0 border-[var(--ds-border)]">
                {/* Display row */}
                <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--ds-sand-50)]">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--ds-ink)] text-[15px]">{team.name}</p>
                    {(team.member1 || team.member2) ? (
                      <p className="text-[12px] text-[var(--ds-ink-3)] truncate">
                        {[team.member1, team.member2].filter(Boolean).join(' · ')}
                      </p>
                    ) : (
                      <p className="text-[12px] text-[var(--ds-ink-5)] italic">Bez závodníků</p>
                    )}
                    <p className="text-xs text-[var(--ds-ink-5)] font-mono truncate">{team.auth_user_id}</p>
                  </div>
                  <button
                    onClick={() => isEditing ? setEditingId(null) : startEdit(team)}
                    className={`p-2 rounded-lg transition-colors ${isEditing ? 'text-[var(--ds-forest-lt)] bg-[var(--ds-forest-pale)]' : 'text-gray-300 hover:text-[var(--ds-forest-lt)] hover:bg-[var(--ds-forest-pale)]'}`}
                    title="Upravit závodníky"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(team)}
                    disabled={deletingId === team.id}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Smazat tým"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div className="px-4 pb-4 bg-[var(--ds-sand-50)] border-t border-[var(--ds-border)]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)] py-3">Závodníci — {team.name}</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)]">Závodník 1</label>
                        <input
                          value={editMember1}
                          onChange={e => setEditMember1(e.target.value)}
                          placeholder="Jméno Příjmení"
                          disabled={isSaving}
                          className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] bg-white px-3 h-[44px] text-[15px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)]">Závodník 2</label>
                        <input
                          value={editMember2}
                          onChange={e => setEditMember2(e.target.value)}
                          placeholder="Jméno Příjmení"
                          disabled={isSaving}
                          className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] bg-white px-3 h-[44px] text-[15px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(team)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 bg-[var(--ds-forest)] hover:bg-[var(--ds-forest-mid)] disabled:opacity-60 text-white font-semibold rounded-xl px-4 h-[38px] text-sm transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isSaving ? 'Ukládám...' : 'Uložit'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 bg-white border border-[var(--ds-border)] hover:bg-[var(--ds-sand-100)] text-[var(--ds-ink-3)] font-semibold rounded-xl px-4 h-[38px] text-sm transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Zrušit
                      </button>
                    </div>
                  </div>
                )}
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
              <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] mb-1.5">Závodník 1</label>
              <input
                value={member1} onChange={e => setMember1(e.target.value)} disabled={creating}
                placeholder="Jméno Příjmení"
                className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] mb-1.5">Závodník 2</label>
              <input
                value={member2} onChange={e => setMember2(e.target.value)} disabled={creating}
                placeholder="Jméno Příjmení"
                className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
              />
            </div>
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
  const [photo1File, setPhoto1File] = useState<File | null>(null)
  const [photo2File, setPhoto2File] = useState<File | null>(null)
  const [photo3File, setPhoto3File] = useState<File | null>(null)
  const [preview1, setPreview1] = useState<string | null>(null)
  const [preview2, setPreview2] = useState<string | null>(null)
  const [preview3, setPreview3] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'compressing' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState('')

  function setPhoto(slot: 1 | 2 | 3, file: File) {
    const url = URL.createObjectURL(file)
    if (slot === 1) { setPhoto1File(file); setPreview1(url) }
    else if (slot === 2) { setPhoto2File(file); setPreview2(url) }
    else { setPhoto3File(file); setPreview3(url) }
  }

  function clearPhoto(slot: 1 | 2 | 3) {
    if (slot === 1) { setPhoto1File(null); if (preview1) URL.revokeObjectURL(preview1); setPreview1(null) }
    else if (slot === 2) { setPhoto2File(null); if (preview2) URL.revokeObjectURL(preview2); setPreview2(null) }
    else { setPhoto3File(null); if (preview3) URL.revokeObjectURL(preview3); setPreview3(null) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const weight_g = Math.round(parseFloat(weightKg) * 1000)

    if (!teamId) { setError('Vyberte tým.'); return }
    if (!weightKg || isNaN(weight_g) || weight_g <= 0) { setError('Zadejte platnou váhu.'); return }
    if (weight_g > 100_000) { setError('Váha nesmí překročit 100 kg.'); return }
    if (!photo1File || !photo2File || !photo3File) { setError('Všechny tři fotky jsou povinné.'); return }

    try {
      setStatus('compressing')
      const timestamp = Date.now()
      const [photo_url_1, photo_url_2, photo_url_3] = await Promise.all([
        compressAndUpload(photo1File, `${teamId}/${timestamp}_1`),
        compressAndUpload(photo2File, `${teamId}/${timestamp}_2`),
        compressAndUpload(photo3File, `${teamId}/${timestamp}_3`),
      ])

      setStatus('uploading')
      await adminPost('/api/admin/add-catch', { team_id: teamId, fish_type: fishType, weight_g, photo_url_1, photo_url_2, photo_url_3 })

      setTeamId(''); setFishType('Kapr'); setWeightKg('')
      clearPhoto(1); clearPhoto(2); clearPhoto(3)
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

        {/* Weight */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] mb-1.5">Váha (kg)<span className="text-red-500 ml-0.5">*</span></label>
          <input type="number" min="0" max="100" step="0.001" value={weightKg} onChange={e => setWeightKg(e.target.value)}
            placeholder="např. 27" disabled={busy}
            className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50" />
        </div>

        {/* Photos */}
        <div className="grid grid-cols-2 gap-3">
          <PhotoPicker label="Levá strana" preview={preview1} onChange={f => setPhoto(1, f)} onClear={() => clearPhoto(1)} disabled={busy} />
          <PhotoPicker label="Pravá strana" preview={preview2} onChange={f => setPhoto(2, f)} onClear={() => clearPhoto(2)} disabled={busy} />
        </div>
        <PhotoPicker label="Fotka váhy" preview={preview3} onChange={f => setPhoto(3, f)} onClear={() => clearPhoto(3)} disabled={busy} />

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

// ─── Catches tab ─────────────────────────────────────────────────────────────

function CatchesTab({ teams }: { teams: Team[] }) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [catches, setCatches] = useState<Catch[]>([])
  const [loadingCatches, setLoadingCatches] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFishType, setEditFishType] = useState<'Kapr' | 'Amur'>('Kapr')
  const [editWeightKg, setEditWeightKg] = useState('')
  const [editPhoto1File, setEditPhoto1File] = useState<File | null>(null)
  const [editPhoto2File, setEditPhoto2File] = useState<File | null>(null)
  const [editPhoto3File, setEditPhoto3File] = useState<File | null>(null)
  const [editPreview1, setEditPreview1] = useState<string | null>(null)
  const [editPreview2, setEditPreview2] = useState<string | null>(null)
  const [editPreview3, setEditPreview3] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadCatches(teamId: string) {
    setLoadingCatches(true)
    const { data } = await supabase
      .from('catches')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
    setCatches(data ?? [])
    setLoadingCatches(false)
  }

  function handleTeamChange(teamId: string) {
    setSelectedTeamId(teamId)
    setEditingId(null)
    setCatches([])
    if (teamId) loadCatches(teamId)
  }

  function startEdit(c: Catch) {
    setEditingId(c.id)
    setEditFishType(c.fish_type as 'Kapr' | 'Amur')
    setEditWeightKg(String(c.weight_g / 1000))
    setEditPhoto1File(null); setEditPreview1(c.photo_url_1)
    setEditPhoto2File(null); setEditPreview2(c.photo_url_2)
    setEditPhoto3File(null); setEditPreview3(c.photo_url_3)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditPhoto1File(null); setEditPreview1(null)
    setEditPhoto2File(null); setEditPreview2(null)
    setEditPhoto3File(null); setEditPreview3(null)
  }

  function setEditPhoto(slot: 1 | 2 | 3, file: File) {
    const url = URL.createObjectURL(file)
    if (slot === 1) { setEditPhoto1File(file); setEditPreview1(url) }
    else if (slot === 2) { setEditPhoto2File(file); setEditPreview2(url) }
    else { setEditPhoto3File(file); setEditPreview3(url) }
  }

  async function saveEdit(c: Catch) {
    const weight_g = Math.round(parseFloat(editWeightKg) * 1000)
    if (!editWeightKg || isNaN(weight_g) || weight_g <= 0) { alert('Zadejte platnou váhu.'); return }

    setSavingId(c.id)
    try {
      let photo_url_1: string | undefined
      let photo_url_2: string | undefined
      let photo_url_3: string | undefined

      const timestamp = Date.now()
      const uploads: Promise<void>[] = []
      if (editPhoto1File) uploads.push(compressAndUpload(editPhoto1File, `${c.team_id}/${timestamp}_1`).then(u => { photo_url_1 = u }))
      if (editPhoto2File) uploads.push(compressAndUpload(editPhoto2File, `${c.team_id}/${timestamp}_2`).then(u => { photo_url_2 = u }))
      if (editPhoto3File) uploads.push(compressAndUpload(editPhoto3File, `${c.team_id}/${timestamp}_3`).then(u => { photo_url_3 = u }))
      await Promise.all(uploads)

      await adminPost('/api/admin/update-catch', { catchId: c.id, fish_type: editFishType, weight_g, photo_url_1, photo_url_2, photo_url_3 })
      setEditingId(null)
      await loadCatches(selectedTeamId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při ukládání.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(c: Catch) {
    if (!confirm('Smazat tento úlovek?')) return
    setDeletingId(c.id)
    try {
      await adminPost('/api/admin/delete-catch', { catchId: c.id })
      setCatches(prev => prev.filter(x => x.id !== c.id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání.')
    } finally {
      setDeletingId(null)
    }
  }

  const isSaving = (id: string) => savingId === id

  return (
    <div className="flex flex-col gap-4 mb-5">

      {/* Team selector */}
      <div className="bg-white border border-[var(--ds-border)] rounded-[18px] shadow-sm p-4">
        <label className="text-[13px] font-semibold text-[var(--ds-ink-2)] block mb-2">Vyber tým</label>
        <select
          value={selectedTeamId}
          onChange={e => handleTeamChange(e.target.value)}
          className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition bg-white"
        >
          <option value="">— Vyberte tým —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Catches list */}
      {selectedTeamId && (
        <div className="bg-white border border-[var(--ds-border)] rounded-[18px] shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 text-[13px] font-bold text-[var(--ds-ink-3)] border-b border-[var(--ds-border)] bg-[var(--ds-sand-50)]">
            Úlovky ({catches.length})
          </div>

          {loadingCatches ? (
            <p className="text-center py-10 text-[var(--ds-ink-4)] text-sm">Načítám...</p>
          ) : catches.length === 0 ? (
            <p className="text-center py-10 text-[var(--ds-ink-4)] text-sm">Žádné úlovky</p>
          ) : catches.map(c => {
            const isEditing = editingId === c.id
            const busy = isSaving(c.id)
            return (
              <div key={c.id} className="border-b last:border-0 border-[var(--ds-border)]">

                {/* Summary row */}
                <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--ds-sand-50)]">
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[var(--ds-sand-100)]">
                    <Image src={c.photo_url_1} alt="" width={56} height={56} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--ds-ink)] text-[15px]">{c.fish_type}</p>
                    <p className="text-[13px] text-[var(--ds-ink-3)]">{(c.weight_g / 1000).toFixed(3)} kg</p>
                    <p className="text-xs text-[var(--ds-ink-5)]">{new Date(c.created_at).toLocaleDateString('cs-CZ')}</p>
                  </div>
                  <button
                    onClick={() => isEditing ? cancelEdit() : startEdit(c)}
                    className={`p-2 rounded-lg transition-colors ${isEditing ? 'text-[var(--ds-forest-lt)] bg-[var(--ds-forest-pale)]' : 'text-gray-300 hover:text-[var(--ds-forest-lt)] hover:bg-[var(--ds-forest-pale)]'}`}
                    title="Upravit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={deletingId === c.id}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Smazat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div className="px-4 pb-5 pt-3 bg-[var(--ds-sand-50)] border-t border-[var(--ds-border)] flex flex-col gap-4">

                    {/* Fish type */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)]">Druh ryby</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Kapr', 'Amur'] as const).map(type => (
                          <button key={type} type="button" onClick={() => setEditFishType(type)} disabled={busy}
                            className={`h-[44px] rounded-xl text-sm font-semibold border transition-colors ${
                              editFishType === type
                                ? type === 'Kapr'
                                  ? 'bg-[var(--ds-forest)] text-white border-[var(--ds-forest)]'
                                  : 'bg-[oklch(45%_0.10_55)] text-white border-[oklch(45%_0.10_55)]'
                                : 'bg-white text-[var(--ds-ink-3)] border-[var(--ds-border)] hover:border-[var(--ds-border-strong)]'
                            }`}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Weight */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)]">Váha (kg)</label>
                      <input
                        type="number" min="0" max="100" step="0.001"
                        value={editWeightKg} onChange={e => setEditWeightKg(e.target.value)}
                        disabled={busy}
                        className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] bg-white px-3 h-[44px] text-[15px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
                      />
                    </div>

                    {/* Photos — replace only */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)]">Fotky (klikni pro výměnu)</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { slot: 1 as const, label: 'Levá strana', preview: editPreview1 },
                          { slot: 2 as const, label: 'Pravá strana', preview: editPreview2 },
                          { slot: 3 as const, label: 'Fotka váhy',   preview: editPreview3 },
                        ]).map(({ slot, label, preview }) => (
                          <ReplacePhoto key={slot} label={label} preview={preview} disabled={busy}
                            onChange={f => setEditPhoto(slot, f)} />
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(c)}
                        disabled={busy}
                        className="flex items-center gap-1.5 bg-[var(--ds-forest)] hover:bg-[var(--ds-forest-mid)] disabled:opacity-60 text-white font-semibold rounded-xl px-4 h-[38px] text-sm transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {busy ? 'Ukládám...' : 'Uložit'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={busy}
                        className="flex items-center gap-1.5 bg-white border border-[var(--ds-border)] hover:bg-[var(--ds-sand-100)] text-[var(--ds-ink-3)] font-semibold rounded-xl px-4 h-[38px] text-sm transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Zrušit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
    const { data } = await supabase.from('teams').select('id, name, auth_user_id, member1, member2').order('name')
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--ds-ink-4)] text-sm">Načítám...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">

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
          {([['teams', 'Týmy'], ['catch', 'Přidat úlovek'], ['catches', 'Úlovky']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 h-10 rounded-lg font-semibold text-sm transition-all ${tab === key ? 'bg-[var(--ds-forest)] text-white shadow-sm' : 'bg-transparent text-[var(--ds-ink-3)] hover:bg-[var(--ds-sand-100)] hover:text-[var(--ds-ink)]'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'teams' && <TeamsTab teams={teams} onRefresh={loadTeams} />}
        {tab === 'catch' && <AddCatchTab teams={teams} />}
        {tab === 'catches' && <CatchesTab teams={teams} />}
      </main>
    </div>
  )
}
