'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type Props = {
  photos: string[]
  initialIndex: number
  onClose: () => void
}

export default function PhotoViewer({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex(i => (i > 0 ? i - 1 : photos.length - 1))
      if (e.key === 'ArrowRight') setIndex(i => (i < photos.length - 1 ? i + 1 : 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, photos.length])

  function prev() { setIndex(i => (i > 0 ? i - 1 : photos.length - 1)) }
  function next() { setIndex(i => (i < photos.length - 1 ? i + 1 : 0)) }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 40) delta > 0 ? next() : prev()
    touchStartX.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-safe-top py-3 shrink-0">
        <span className="text-white/50 text-sm font-medium tabular-nums">{index + 1} / {photos.length}</span>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white p-2 -mr-2 transition-colors"
          aria-label="Zavřít"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Photo area */}
      <div className="flex-1 relative">
        <Image
          key={photos[index]}
          src={photos[index]}
          alt={`Fotka ${index + 1}`}
          fill
          className="object-contain"
          priority
          sizes="100vw"
        />

        {/* Desktop prev/next hit areas */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-0 inset-y-0 w-16 flex items-center justify-start pl-3 text-white/0 hover:text-white/70 transition-colors hidden sm:flex"
              aria-label="Předchozí"
            >
              <ChevronLeft className="w-8 h-8 drop-shadow-lg" />
            </button>
            <button
              onClick={next}
              className="absolute right-0 inset-y-0 w-16 flex items-center justify-end pr-3 text-white/0 hover:text-white/70 transition-colors hidden sm:flex"
              aria-label="Další"
            >
              <ChevronRight className="w-8 h-8 drop-shadow-lg" />
            </button>
          </>
        )}
      </div>

      {/* Bottom dots */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-3 py-5 shrink-0">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all ${i === index ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/30'}`}
              aria-label={`Fotka ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
