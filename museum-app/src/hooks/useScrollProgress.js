import { useState, useEffect, useRef } from 'react'

const DURATION = 900 // ms per section transition

function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function useScrollProgress(sectionCount) {
  const [display, setDisplay] = useState({ section: 0, progress: 0, raw: 0 })
  const s = useRef({
    current: 0,   // animated raw position
    target: 0,    // target section index
    startPos: 0,
    startTime: null,
    rafId: null,
    locked: false,
  })

  useEffect(() => {
    const st = s.current

    function tick(now) {
      if (!st.startTime) st.startTime = now
      const t = Math.min(1, (now - st.startTime) / DURATION)
      st.current = st.startPos + (st.target - st.startPos) * ease(t)

      const raw = st.current
      const section = Math.min(Math.floor(raw), sectionCount - 1)
      const progress = raw % 1

      setDisplay({ section, progress, raw })

      if (t < 1) {
        st.rafId = requestAnimationFrame(tick)
      } else {
        st.current = st.target
        st.rafId = null
        setTimeout(() => { st.locked = false }, 150)
        setDisplay({ section: Math.min(st.target, sectionCount - 1), progress: st.target % 1 || 0, raw: st.target })
      }
    }

    function go(dir) {
      if (st.locked) return
      const next = Math.max(0, Math.min(sectionCount - 1, st.target + dir))
      if (next === st.target) return
      st.target = next
      st.startPos = st.current
      st.startTime = null
      st.locked = true
      if (st.rafId) cancelAnimationFrame(st.rafId)
      st.rafId = requestAnimationFrame(tick)
    }

    function onWheel(e) {
      e.preventDefault()
      go(e.deltaY > 0 ? 1 : -1)
    }

    let touchY = 0
    function onTouchStart(e) { touchY = e.touches[0].clientY }
    function onTouchEnd(e) {
      const dy = touchY - e.changedTouches[0].clientY
      if (Math.abs(dy) > 40) go(dy > 0 ? 1 : -1)
    }

    function onKey(e) {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') go(1)
      if (e.key === 'ArrowUp' || e.key === 'PageUp') go(-1)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      if (st.rafId) cancelAnimationFrame(st.rafId)
    }
  }, [sectionCount])

  return display
}
