'use client'

import Image from 'next/image'

const SPONSORS = [
  { src: '/sponsors/batterypowerbox.png', alt: 'Battery Powerbox' },
  { src: '/sponsors/benncar.png', alt: 'Benncar' },
  { src: '/sponsors/chybik.jpg', alt: 'Chybík' },
]

const TRACK = [...SPONSORS, ...SPONSORS, ...SPONSORS, ...SPONSORS, ...SPONSORS, ...SPONSORS, ...SPONSORS, ...SPONSORS]

export default function SponsorCarousel() {
  return (
    <div
      className="relative bg-[var(--ds-sand-50)] border-b border-[var(--ds-border)] overflow-hidden group py-3"
      style={{
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
      }}
    >
      <div className="flex w-max gap-5 [animation:sponsor-scroll_22s_linear_infinite] group-hover:[animation-play-state:paused]">
        {TRACK.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-center shrink-0 h-12 px-6"
          >
            <Image
              src={s.src}
              alt={s.alt}
              width={160}
              height={40}
              className="h-16 w-auto object-contain"
              style={{ maxWidth: 160 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
