'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Pencil, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SponsorCarousel from '@/components/SponsorCarousel'

type InformaceContent = {
  losovani_datum: string
  losovani_misto: string
  start_datum: string
  start_cas: string
  konec_datum: string
  konec_cas: string
  pravidla: string
  vazeni: string
  startovne: string
  cena_1: string
  cena_2: string
  cena_3_title: string
  cena_3_subtitle: string
  ukonceni_datum: string
  ukonceni_misto: string
  schvaleno: string
}

const DEFAULT: InformaceContent = {
  losovani_datum: '31. 5. 2026 · 15:00',
  losovani_misto: 'Restaurace Sv. Jiří, Hlučín',
  start_datum: '1. 6. 2026',
  start_cas: '04:00',
  konec_datum: '6. 6. 2026',
  konec_cas: '09:00',
  pravidla: 'Loví se dle pravidel ČRS (4:00–24:00 + bližší podmínky revíru)\nPočítají se 3 nejtěžší ryby (kapr, amur)',
  vazeni: 'Každý úlovek musí být zdokumentován ve WhatsApp skupině — video jasně prokazující, že do vážicího saku se dává pouze vážená ryba, celý průběh vážení a odvážení saku.\nFotodokumentace ryby z obou stran.\nRyby nad 20 kg se váží za přítomnosti člena nejbližšího sousedního týmu.',
  startovne: '10 000 Kč',
  cena_1: '50 000 Kč',
  cena_2: '30 000 Kč',
  cena_3_title: 'BATTERY POWER BOX',
  cena_3_subtitle: '+ nabíječka 16,8V · 100Ah',
  ukonceni_datum: '6. 6. 2026 · po 11:00',
  ukonceni_misto: 'Restaurace Sv. Jiří, Hlučín',
  schvaleno: 'Povoleno vyjíždět za ulovenou rybou (pouze za účelem zdolání)\nPovoleno krmení ze člunu pouze mimo dobu lovu od 00:00 do 4:00\nPovoleno si svůj lovný sektor zmapovat echolotem',
}

// ─── Display components ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[var(--ds-border)] rounded-[18px] shadow-[0_1px_3px_oklch(16%_0.02_80/0.07)] overflow-hidden">
      <div className="px-5 py-3.5 bg-[var(--ds-forest)]">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.10em] text-white/80">{title}</h2>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
      <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)] sm:w-32 shrink-0">{label}</span>
      <span className="text-[15px] font-semibold text-[var(--ds-ink)]">{value}</span>
    </div>
  )
}

function BulletList({ text }: { text: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {text.split('\n').filter(Boolean).map((line, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px] text-[var(--ds-ink)]">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ds-forest-lt)] shrink-0" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Edit components ──────────────────────────────────────────────────────────

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[var(--ds-border)] rounded-[18px] overflow-hidden shadow-[0_1px_3px_oklch(16%_0.02_80/0.07)]">
      <div className="px-5 py-3 bg-[var(--ds-forest-pale)] border-b border-[var(--ds-border)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-[var(--ds-forest-lt)]">{title}</p>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, multiline }: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
}) {
  const cls = "w-full rounded-xl border-[1.5px] border-[var(--ds-border)] px-3 py-2.5 text-[14px] text-[var(--ds-ink)] outline-none focus:border-[var(--ds-forest-lt)] focus:shadow-[0_0_0_3px_var(--ds-forest-wash)] transition resize-none"
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--ds-ink-4)]">{label}</label>
      {multiline
        ? <textarea rows={4} value={value} onChange={e => onChange(e.target.value)} className={cls} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} />
      }
      {multiline && <p className="text-[11px] text-[var(--ds-ink-5)]">Každý bod na nový řádek</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InformacePage() {
  const [content, setContent] = useState<InformaceContent>(DEFAULT)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<InformaceContent>(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: pageData }, { data: { session } }] = await Promise.all([
        supabase.from('page_content').select('content').eq('page', 'informace').single(),
        supabase.auth.getSession(),
      ])

      if (pageData?.content) {
        const c = pageData.content as InformaceContent
        setContent(c)
        setDraft(c)
      }

      if (session?.user) {
        const { data: team } = await supabase
          .from('teams')
          .select('is_admin')
          .eq('auth_user_id', session.user.id)
          .single()
        setIsAdmin(team?.is_admin ?? false)
      }
    }
    load()
  }, [])

  function startEditing() {
    setDraft({ ...content })
    setSaveError('')
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setSaveError('')
  }

  function set(key: keyof InformaceContent, value: string) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/api/admin/update-informace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: draft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Chyba serveru.')
      setContent(draft)
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Chyba při ukládání.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen">

      {/* Navbar */}
      <header className="bg-[var(--ds-forest)] border-b border-[oklch(100%_0_0/0.08)] shadow-[0_2px_12px_oklch(16%_0.02_80/0.18)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Image src="/image.png" alt="Hlučín Top 3" width={36} height={36} className="rounded-xl shrink-0" />
            <p className="font-bold text-white text-sm">HLUČÍN TOP 3</p>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm font-semibold text-[oklch(100%_0_0/0.70)] hover:text-white transition-colors px-3 py-2 rounded-lg">
              Výsledky
            </Link>
            <Link href="/informace" className="text-sm font-semibold text-white bg-[oklch(100%_0_0/0.15)] px-3 py-2 rounded-lg">
              Informace
            </Link>
          </div>
        </div>
      </header>

      <SponsorCarousel />

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Page title + edit toggle */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-[var(--ds-forest-pale)] mb-1">Hlučín TOP 3 · 2026</p>
            <h1 className="text-[28px] font-extrabold tracking-tight text-white leading-tight">Informace</h1>
            <p className="text-sm text-white/60 mt-1">Závody v lovu kaprů a amurů</p>
            <div className="h-[3px] w-9 bg-[var(--ds-forest-pale)] rounded-full mt-3" />
          </div>
          {isAdmin && !editing && (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ds-forest)] bg-white border border-[var(--ds-border)] hover:border-[var(--ds-forest-lt)] px-3 py-2 rounded-xl transition-colors shadow-sm shrink-0 mt-1"
            >
              <Pencil className="w-4 h-4" />
              Upravit
            </button>
          )}
        </div>

        {editing ? (
          /* ── EDIT MODE ── */
          <>
            <EditSection title="Losování">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Datum" value={draft.losovani_datum} onChange={v => set('losovani_datum', v)} />
                <Field label="Místo" value={draft.losovani_misto} onChange={v => set('losovani_misto', v)} />
              </div>
            </EditSection>

            <EditSection title="Termín závodů">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Start datum" value={draft.start_datum} onChange={v => set('start_datum', v)} />
                <Field label="Start čas" value={draft.start_cas} onChange={v => set('start_cas', v)} />
                <Field label="Konec datum" value={draft.konec_datum} onChange={v => set('konec_datum', v)} />
                <Field label="Konec čas" value={draft.konec_cas} onChange={v => set('konec_cas', v)} />
              </div>
            </EditSection>

            <EditSection title="Pravidla">
              <Field label="Pravidla" value={draft.pravidla} onChange={v => set('pravidla', v)} multiline />
            </EditSection>

            <EditSection title="Vážení + dokumentace">
              <Field label="Podmínky" value={draft.vazeni} onChange={v => set('vazeni', v)} multiline />
            </EditSection>

            <EditSection title="Startovné + ceny">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Startovné" value={draft.startovne} onChange={v => set('startovne', v)} />
                <Field label="1. místo" value={draft.cena_1} onChange={v => set('cena_1', v)} />
                <Field label="2. místo" value={draft.cena_2} onChange={v => set('cena_2', v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="3. místo — název" value={draft.cena_3_title} onChange={v => set('cena_3_title', v)} />
                <Field label="3. místo — popis" value={draft.cena_3_subtitle} onChange={v => set('cena_3_subtitle', v)} />
              </div>
            </EditSection>

            <EditSection title="Ukončení závodů">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Datum" value={draft.ukonceni_datum} onChange={v => set('ukonceni_datum', v)} />
                <Field label="Místo" value={draft.ukonceni_misto} onChange={v => set('ukonceni_misto', v)} />
              </div>
            </EditSection>

            <EditSection title="Schváleno vnitřním hlasováním">
              <Field label="Body" value={draft.schvaleno} onChange={v => set('schvaleno', v)} multiline />
            </EditSection>

            {saveError && <p className="text-sm text-red-500 text-center">{saveError}</p>}

            <div className="flex gap-3 pb-4">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 bg-[var(--ds-forest)] hover:bg-[var(--ds-forest-mid)] disabled:opacity-60 text-white font-semibold rounded-xl px-5 py-3 text-sm transition-colors shadow-[0_2px_8px_oklch(30%_0.10_148/0.25)]"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Ukládám...' : 'Uložit změny'}
              </button>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-2 bg-white border border-[var(--ds-border)] hover:bg-[var(--ds-sand-100)] text-[var(--ds-ink-2)] font-semibold rounded-xl px-5 py-3 text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                Zrušit
              </button>
            </div>
          </>
        ) : (
          /* ── DISPLAY MODE ── */
          <>
            <Section title="Losování">
              <Row label="Datum" value={content.losovani_datum} />
              <Row label="Místo" value={content.losovani_misto} />
              <p className="text-[14px] text-[var(--ds-ink-3)]">Po losování přesun na lovná místa.</p>
            </Section>

            <Section title="Termín závodů">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[var(--ds-forest-pale)] border border-[oklch(46%_0.13_148/0.2)] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ds-forest-lt)] mb-1">Start</p>
                  <p className="text-[20px] font-extrabold font-mono text-[var(--ds-ink)] tabular-nums leading-tight">{content.start_datum}</p>
                  <p className="text-[13px] font-semibold text-[var(--ds-forest-mid)]">{content.start_cas}</p>
                </div>
                <div className="bg-[var(--ds-sand-100)] border border-[var(--ds-border)] rounded-xl px-4 py-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ds-ink-4)] mb-1">Konec</p>
                  <p className="text-[20px] font-extrabold font-mono text-[var(--ds-ink)] tabular-nums leading-tight">{content.konec_datum}</p>
                  <p className="text-[13px] font-semibold text-[var(--ds-ink-3)]">{content.konec_cas}</p>
                </div>
              </div>
            </Section>

            <Section title="Pravidla">
              <BulletList text={content.pravidla} />
            </Section>

            <Section title="Vážení + dokumentace">
              <BulletList text={content.vazeni} />
            </Section>

            <Section title="Startovné + ceny">
              <div className="flex items-center justify-between bg-[var(--ds-sand-100)] border border-[var(--ds-border)] rounded-xl px-4 py-3 mb-1">
                <span className="text-[13px] font-bold text-[var(--ds-ink-3)] uppercase tracking-wide">Startovné / tým</span>
                <span className="text-[22px] font-extrabold font-mono text-[var(--ds-ink)] tabular-nums">{content.startovne}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-gradient-to-r from-[oklch(98%_0.05_82)] to-white border-[1.5px] border-[var(--ds-gold)] rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--ds-gold)] text-[oklch(22%_0.06_80)] flex items-center justify-center font-extrabold font-mono text-[15px] shadow-[0_2px_8px_var(--ds-gold)] shrink-0">1</div>
                  <span className="text-[22px] font-extrabold font-mono text-[var(--ds-ink)] tabular-nums">{content.cena_1}</span>
                </div>
                <div className="flex items-center gap-3 bg-gradient-to-r from-[oklch(98%_0.005_240)] to-white border-[1.5px] border-[oklch(78%_0.01_240)] rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--ds-silver)] text-white flex items-center justify-center font-extrabold font-mono text-[15px] shrink-0">2</div>
                  <span className="text-[22px] font-extrabold font-mono text-[var(--ds-ink)] tabular-nums">{content.cena_2}</span>
                </div>
                <div className="flex items-center gap-3 bg-gradient-to-r from-[oklch(97%_0.035_55)] to-white border-[1.5px] border-[oklch(78%_0.07_55)] rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--ds-bronze)] text-white flex items-center justify-center font-extrabold font-mono text-[15px] shrink-0">3</div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-extrabold text-[var(--ds-ink)] leading-tight">{content.cena_3_title}</span>
                    <span className="text-[12px] text-[var(--ds-ink-3)]">{content.cena_3_subtitle}</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Ukončení závodů">
              <Row label="Datum" value={content.ukonceni_datum} />
              <Row label="Místo" value={content.ukonceni_misto} />
            </Section>

            <Section title="Schváleno vnitřním hlasováním">
              <BulletList text={content.schvaleno} />
            </Section>
          </>
        )}

      </main>
    </div>
  )
}
