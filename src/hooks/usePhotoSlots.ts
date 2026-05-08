import { useState } from 'react'

type Slot = { file: File | null; preview: string | null }

export function usePhotoSlots(count = 3) {
  const [slots, setSlots] = useState<Slot[]>(
    () => Array.from({ length: count }, () => ({ file: null, preview: null }))
  )

  function set(i: number, file: File) {
    const preview = URL.createObjectURL(file)
    setSlots(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      if (s.preview) URL.revokeObjectURL(s.preview)
      return { file, preview }
    }))
  }

  function clear(i: number) {
    setSlots(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      if (s.preview) URL.revokeObjectURL(s.preview)
      return { file: null, preview: null }
    }))
  }

  function clearAll() {
    setSlots(prev => {
      prev.forEach(s => { if (s.preview) URL.revokeObjectURL(s.preview) })
      return Array.from({ length: count }, () => ({ file: null, preview: null }))
    })
  }

  // Set preview from an existing URL (e.g. from storage) without a File.
  // revokeObjectURL is a no-op for non-blob URLs so this is always safe.
  function setPreviewOnly(i: number, url: string | null) {
    setSlots(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      if (s.preview) URL.revokeObjectURL(s.preview)
      return { file: null, preview: url }
    }))
  }

  return { slots, set, clear, clearAll, setPreviewOnly }
}
