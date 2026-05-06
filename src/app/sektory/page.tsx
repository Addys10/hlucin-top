import Link from 'next/link'
import Image from 'next/image'

export default function SektoryPage() {
  return (
    <div className="min-h-screen">
      <header className="bg-[var(--ds-forest)] border-b border-[oklch(100%_0_0/0.08)] shadow-[0_2px_12px_oklch(16%_0.02_80/0.18)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Image src="/image.png" alt="Hlučín Top 3" width={36} height={36} className="rounded-xl shrink-0" />
            <span className="font-bold text-white text-sm hidden sm:block">HLUČÍN TOP 3</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-white leading-tight">Sektory</h1>
        <p className="text-sm text-white/60 mt-1">Mapa a informace o sektorech</p>

        <div className="mt-8 bg-white border border-[var(--ds-border)] rounded-[24px] shadow-sm p-8 text-center text-[var(--ds-ink-4)]">
          Mapa sektorů bude brzy k dispozici.
        </div>
      </main>
    </div>
  )
}
