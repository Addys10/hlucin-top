'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Camera, Fish, X } from 'lucide-react'
import PhotoViewer from '@/components/PhotoViewer'
import Navbar from '@/components/Navbar'
import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'

type Team = { id: string; name: string; member1?: string | null; member2?: string | null; yellow_cards?: number }
type Catch = { id: string; fish_type: string; weight_g: number; length_mm: number; created_at: string; photo_url_1?: string; photo_url_2?: string; photo_url_3?: string; status: 'pending' | 'approved' | 'rejected' }

type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'done' | 'error'

async function compressImage(file: File): Promise<File> {
  return imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true })
}

async function uploadWithRetry(file: File, path: string, attempts = 3): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.storage
      .from('catches')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from('catches').getPublicUrl(data.path)
      return publicUrl
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)))
  }
  throw new Error('Nahrávání fotky selhalo i po opakovaných pokusech.')
}

function PhotoPicker({
  label,
  preview,
  onChange,
  onClear,
  disabled,
}: {
  label: string
  preview: string | null
  onChange: (file: File) => void
  onClear: () => void
  disabled: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-[var(--ds-ink-2)]">
        {label}<span className="text-red-500 ml-0.5">*</span>
      </label>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-[var(--ds-border)] bg-[var(--ds-sand-50)]" style={{ aspectRatio: '4/3' }}>
          <Image src={preview} alt="Náhled" fill className="object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--ds-border)] bg-[var(--ds-sand-50)] hover:border-[var(--ds-forest-lt)] hover:bg-[var(--ds-forest-wash)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed py-8"
        >
          <Camera className="w-7 h-7 text-[var(--ds-ink-4)]" />
          <span className="text-sm text-[var(--ds-ink-4)]">Vybrat fotku</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onChange(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const map: Record<UploadStatus, { label: string; color: string } | null> = {
    idle: null,
    error: null,
    compressing: { label: 'Komprimuji fotky...', color: 'text-[var(--ds-forest-lt)] bg-[var(--ds-forest-pale)]' },
    uploading: { label: 'Nahrávám fotky...', color: 'text-[var(--ds-forest-lt)] bg-[var(--ds-forest-pale)]' },
    done: { label: 'Úlovek uložen!', color: 'text-green-700 bg-green-50' },
  }
  const entry = map[status]
  if (!entry) return null
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${entry.color}`}>
      {(status === 'compressing' || status === 'uploading') && (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
      )}
      {entry.label}
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [team, setTeam] = useState<Team | null>(null)
  const [catches, setCatches] = useState<Catch[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')

  const [fishType, setFishType] = useState<'Kapr' | 'Amur'>('Kapr')
  const [weightKg, setWeightKg] = useState('')
  const [photo1File, setPhoto1File] = useState<File | null>(null)
  const [photo2File, setPhoto2File] = useState<File | null>(null)
  const [photo3File, setPhoto3File] = useState<File | null>(null)
  const [preview1, setPreview1] = useState<string | null>(null)
  const [preview2, setPreview2] = useState<string | null>(null)
  const [preview3, setPreview3] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name, member1, member2, yellow_cards')
        .eq('auth_user_id', user.id)
        .single()

      if (!teamData) { router.push('/login'); return }
      setTeam(teamData)

      const { data: catchData } = await supabase
        .from('catches')
        .select('id, fish_type, weight_g, length_mm, created_at, photo_url_1, photo_url_2, photo_url_3, status')
        .eq('team_id', teamData.id)
        .order('created_at', { ascending: false })

      setCatches(catchData ?? [])
      setLoading(false)
    }
    load()
  }, [router])

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
    if (!team) return
    setError('')
    setUploadStatus('idle')
    setSubmitting(true)

    const weight_g = Math.round(parseFloat(weightKg) * 1000)
    if (!weightKg || isNaN(weight_g) || weight_g <= 0) {
      setError('Zadejte platnou váhu.')
      setSubmitting(false)
      return
    }
    if (weight_g > 100_000) {
      setError('Váha nesmí překročit 100 kg.')
      setSubmitting(false)
      return
    }
    if (!photo1File || !photo2File || !photo3File) {
      setError('Všechny tři fotky jsou povinné.')
      setSubmitting(false)
      return
    }

    try {
      setUploadStatus('compressing')
      const timestamp = Date.now()
      const [compressed1, compressed2, compressed3] = await Promise.all([
        compressImage(photo1File),
        compressImage(photo2File),
        compressImage(photo3File),
      ])

      setUploadStatus('uploading')
      const ext = (f: File) => f.type === 'image/png' ? 'png' : 'jpg'
      const [photo_url_1, photo_url_2, photo_url_3] = await Promise.all([
        uploadWithRetry(compressed1, `${team.id}/${timestamp}_1.${ext(compressed1)}`),
        uploadWithRetry(compressed2, `${team.id}/${timestamp}_2.${ext(compressed2)}`),
        uploadWithRetry(compressed3, `${team.id}/${timestamp}_3.${ext(compressed3)}`),
      ])

      const { data, error: insertError } = await supabase.from('catches').insert({
        team_id: team.id,
        fish_type: fishType,
        weight_g,
        photo_url_1,
        photo_url_2,
        photo_url_3,
      }).select().single()

      if (insertError) throw new Error('Nepodařilo se uložit úlovek.')

      setCatches(prev => [data, ...prev])
      setFishType('Kapr')
      setWeightKg('')
      clearPhoto(1)
      clearPhoto(2)
      clearPhoto(3)
      setUploadStatus('done')
      setTimeout(() => setUploadStatus('idle'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání. Zkuste to znovu.')
      setUploadStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Načítám...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">

      <Navbar />

      <main className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">

        {/* Team title */}
        <div className="mb-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-white/50">Přihlášen jako</p>
          <h1 className="text-[28px] font-extrabold tracking-tight text-white leading-tight">{team?.name}</h1>
          {(team?.member1 || team?.member2) && (
            <p className="text-[13px] text-white/60 mt-0.5">
              {[team.member1, team.member2].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="h-[3px] w-9 bg-[var(--ds-forest-lt)] rounded-full mt-2.5" />
        </div>

        {/* Catch form */}
        <div className="bg-white border border-[var(--ds-border)] rounded-[24px] shadow-[0_1px_3px_oklch(16%_0.02_80/0.07),0_1px_2px_oklch(16%_0.02_80/0.04)] p-6 mb-4">
          <h2 className="text-[16px] font-bold text-[var(--ds-ink)] mb-5">Přidat úlovek</h2>

          {(team?.yellow_cards ?? 0) >= 2 ? (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
              <span className="inline-block w-[10px] h-[14px] rounded-[2px] bg-red-500 rotate-[-6deg] shadow-sm shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-700 text-sm">Diskvalifikován</p>
                <p className="text-red-600 text-[13px] mt-0.5">Váš tým obdržel červenou kartu a nemůže přidávat další úlovky.</p>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Fish type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--ds-ink-2)]">Druh ryby</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Kapr', 'Amur'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFishType(type)}
                    disabled={submitting}
                    className={`h-[52px] rounded-xl text-sm font-semibold border transition-colors ${
                      fishType === type
                        ? type === 'Kapr'
                          ? 'bg-[var(--ds-forest)] text-white border-[var(--ds-forest)] shadow-[0_2px_8px_oklch(30%_0.10_148/0.30)]'
                          : 'bg-[oklch(45%_0.10_55)] text-white border-[oklch(45%_0.10_55)] shadow-[0_2px_8px_oklch(45%_0.10_55/0.30)]'
                        : 'bg-white text-[var(--ds-ink-3)] border-[var(--ds-border)] hover:border-[var(--ds-border-strong)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Weight */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-[var(--ds-ink-2)]">
                Váha (kg)<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.001"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                placeholder="např. 27"
                disabled={submitting}
                className="w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-4 h-[50px] text-[16px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition disabled:opacity-50"
              />
            </div>

            {/* Photos */}
            <div className="grid grid-cols-2 gap-3">
              <PhotoPicker
                label="Levá strana"
                preview={preview1}
                onChange={f => setPhoto(1, f)}
                onClear={() => clearPhoto(1)}
                disabled={submitting}
              />
              <PhotoPicker
                label="Pravá strana"
                preview={preview2}
                onChange={f => setPhoto(2, f)}
                onClear={() => clearPhoto(2)}
                disabled={submitting}
              />
            </div>
            <PhotoPicker
              label="Fotka váhy"
              preview={preview3}
              onChange={f => setPhoto(3, f)}
              onClear={() => clearPhoto(3)}
              disabled={submitting}
            />

            {error && <p className="text-sm text-red-500">{error}</p>}
            <StatusBadge status={uploadStatus} />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--ds-forest)] hover:bg-[var(--ds-forest-mid)] disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm transition-colors shadow-[0_2px_8px_oklch(30%_0.10_148/0.25)] hover:shadow-[0_4px_14px_oklch(30%_0.10_148/0.35)] hover:-translate-y-px active:translate-y-0"
            >
              {submitting ? 'Ukládám...' : 'Uložit úlovek'}
            </button>
          </form>
          )}
        </div>

        {/* Catches list */}
        <div className="bg-white border border-[var(--ds-border)] rounded-[18px] shadow-[0_1px_3px_oklch(16%_0.02_80/0.07)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--ds-border)] bg-[var(--ds-sand-50)]">
            <h2 className="text-[13px] font-bold text-[var(--ds-ink-3)]">Vaše úlovky</h2>
          </div>

          {catches.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Zatím žádné úlovky</div>
          ) : (
            catches.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-0 border-[var(--ds-border)]">
                <div className="w-6 text-center text-[11px] text-[var(--ds-ink-4)] font-mono shrink-0">#{catches.length - i}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[15px] font-bold text-[var(--ds-ink)]">{c.fish_type}</p>
                    {c.status === 'pending' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">Čeká na schválení</span>
                    )}
                    {c.status === 'approved' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-green-100 text-green-700">Schváleno</span>
                    )}
                    {c.status === 'rejected' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-red-100 text-red-600">Zamítnuto</span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--ds-ink-4)]">
                    {new Date(c.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <span className="text-[17px] font-extrabold font-mono text-[var(--ds-ink)] tabular-nums">
                    {(c.weight_g / 1000).toFixed(2)} kg
                  </span>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {[c.photo_url_1, c.photo_url_2, c.photo_url_3].map((url, pi) => url ? (
                    <button
                      key={pi}
                      type="button"
                      onClick={() => setLightbox({ photos: [c.photo_url_1, c.photo_url_2, c.photo_url_3].filter(Boolean) as string[], index: pi })}
                      className="w-9 h-9 rounded-lg overflow-hidden border border-[var(--ds-border)] shrink-0 hover:opacity-80 transition-opacity"
                    >
                      <Image src={url} alt={`Fotka ${pi + 1}`} width={36} height={36} className="object-cover" />
                    </button>
                  ) : (
                    <div key={pi} className="w-9 h-9 rounded-lg bg-[var(--ds-sand-100)] text-[var(--ds-ink-5)] flex items-center justify-center shrink-0">
                      <Fish className="w-4 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

      </main>

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
