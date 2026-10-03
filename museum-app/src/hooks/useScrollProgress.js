import { useState, useEffect, useRef } from 'react'

export function useScrollProgress(sectionCount = 3) {
  const [scrollData, setScrollData] = useState({ section: 0, progress: 0, raw: 0 })
  const rafRef = useRef(null)

  useEffect(() => {
    const update = () => {
      const scrollY = window.scrollY
      const winH = window.innerHeight
      const docH = document.documentElement.scrollHeight
      const maxScroll = docH - winH

      const raw = maxScroll > 0 ? scrollY / maxScroll : 0
      const totalSections = sectionCount
      const sectionF = raw * totalSections
      const section = Math.min(Math.floor(sectionF), totalSections - 1)
      const progress = sectionF - section

      setScrollData({ section, progress, raw })
    }

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [sectionCount])

  return scrollData
}
