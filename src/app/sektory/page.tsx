import Image from 'next/image'
import Navbar from '@/components/Navbar'

export default function SektoryPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4 w-full flex-1">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-white leading-tight">Sektory</h1>
          <p className="text-sm text-white/60 mt-1">Mapa sektorů — Hlučínské jezero</p>
        </div>

        <div className="bg-white border border-[var(--ds-border)] rounded-[18px] shadow-sm overflow-hidden">
          <Image
            src="/sektory/map-sektory.png"
            alt="Mapa sektorů"
            width={1200}
            height={800}
            className="w-full h-auto"
          />
        </div>

        <div className="bg-white border border-[var(--ds-border)] rounded-[18px] shadow-sm overflow-hidden">
          <iframe
            src="https://www.google.com/maps/d/embed?mid=1G3tWRXjtTNK0iz06Cy1uYcBoE3WK9cQ&ehbc=2E312F"
            className="w-full"
            style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </main>
    </div>
  )
}
