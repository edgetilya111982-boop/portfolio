import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Position of the monitor screen in works_bg_music.webp (2000x1105, background-size: cover, centred).
const BG = { w: 2000, h: 1105 }
const SCREEN = { x: 1013, y: 259, w: 424, h: 267 }
// Things standing in front of the screen: the pop filter and the microphone.
const POP = { x: 1320, y: 466, rx: 55, ry: 67 }
const MIC = { x: 1331, y: 458, w: 64, h: 100 }

const BARS = 46
const F_MIN = 45
const F_MAX = 14000

function place(vp) {
  const s = Math.max(vp.w / BG.w, vp.h / BG.h)
  const ox = (vp.w - BG.w * s) / 2
  const oy = (vp.h - BG.h * s) / 2
  return {
    s,
    left: ox + SCREEN.x * s,
    top: oy + SCREEN.y * s,
    width: SCREEN.w * s,
    height: SCREEN.h * s,
    ox,
    oy,
  }
}

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [vp, setVp] = useState(read)
  useEffect(() => {
    const on = () => setVp(read())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

// A live spectrum on the studio monitor while a track plays.
export default function MonitorViz({ player }) {
  const [host, setHost] = useState(null)
  const canvasRef = useRef(null)
  const vp = useViewport()
  const geo = place(vp)
  const live = useRef({ playing: false, volume: 1, analyserRef: null })
  const kick = useRef(() => {})

  live.current.playing = player.playing
  live.current.volume = player.muted ? 0 : player.volume
  live.current.analyserRef = player.analyserRef

  useEffect(() => {
    setHost(document.querySelector('.works-page'))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = Math.round(geo.width * dpr)
    const H = Math.round(geo.height * dpr)
    canvas.width = W
    canvas.height = H

    const bars = new Float32Array(BARS)
    const peaks = new Float32Array(BARS)
    let data = null
    let vis = 0
    let raf = 0
    let last = 0

    // mic and pop filter, in canvas pixels
    const k = (geo.s * dpr)
    const toX = (ix) => (ix - SCREEN.x) * k
    const toY = (iy) => (iy - SCREEN.y) * k

    const frame = (t) => {
      raf = 0
      const { playing, volume, analyserRef } = live.current
      const an = analyserRef && analyserRef.current
      vis += ((playing ? 1 : 0) - vis) * 0.07
      canvas.style.opacity = vis > 0.01 ? String(Math.min(vis, 1)) : '0'

      // levels per bar
      let energy = 0
      const target = new Float32Array(BARS)
      if (playing && an) {
        if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount)
        an.getByteFrequencyData(data)
        const nyq = an.context.sampleRate / 2
        const gain = 1 / Math.max(volume, 0.25)
        for (let i = 0; i < BARS; i++) {
          const f0 = F_MIN * Math.pow(F_MAX / F_MIN, i / BARS)
          const f1 = F_MIN * Math.pow(F_MAX / F_MIN, (i + 1) / BARS)
          const b0 = Math.floor((f0 / nyq) * data.length)
          const b1 = Math.max(b0 + 1, Math.ceil((f1 / nyq) * data.length))
          let m = 0
          for (let b = b0; b < b1 && b < data.length; b++) m = Math.max(m, data[b])
          // the top of the spectrum is always quieter: lift it a little
          const tilt = 1 + (i / BARS) * 0.55
          target[i] = Math.min(1, Math.pow((m / 255) * gain * tilt, 1.35))
          energy += target[i]
        }
      }
      if (playing && energy < 0.02 && volume > 0) {
        // no analyser (or the browser keeps it silent): a believable fake
        for (let i = 0; i < BARS; i++) {
          const env = 0.85 - (i / BARS) * 0.55
          target[i] = env * (0.35 + 0.35 * Math.sin(t * 0.0042 + i * 0.7) * Math.sin(t * 0.0017 + i * 0.31) + 0.25 * Math.abs(Math.sin(t * 0.009 + i * 1.9)))
        }
      }

      let alive = false
      for (let i = 0; i < BARS; i++) {
        const v = target[i]
        bars[i] += (v - bars[i]) * (v > bars[i] ? 0.6 : 0.14)
        if (bars[i] > peaks[i]) peaks[i] = bars[i]
        else peaks[i] = Math.max(0, peaks[i] - 0.006)
        if (bars[i] > 0.004 || peaks[i] > 0.004) alive = true
      }

      // draw
      ctx.clearRect(0, 0, W, H)
      if (vis > 0.01) {
        ctx.fillStyle = 'rgba(2, 6, 26, 0.93)'
        ctx.fillRect(0, 0, W, H)
        // faint scale lines
        ctx.strokeStyle = 'rgba(90, 160, 255, 0.08)'
        ctx.lineWidth = dpr
        const base = H * 0.76
        for (let g = 1; g <= 4; g++) {
          const y = base - (base * 0.86 * g) / 4
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(W, y)
          ctx.stroke()
        }

        const pad = W * 0.04
        const slot = (W - pad * 2) / BARS
        const bw = slot * 0.64
        const maxH = base * 0.88
        const grad = ctx.createLinearGradient(0, base - maxH, 0, base)
        grad.addColorStop(0, '#b9fbff')
        grad.addColorStop(0.35, '#4cc2ff')
        grad.addColorStop(1, '#2145ff')
        const refl = ctx.createLinearGradient(0, base, 0, base + maxH * 0.4)
        refl.addColorStop(0, 'rgba(70, 150, 255, 0.35)')
        refl.addColorStop(1, 'rgba(70, 150, 255, 0)')

        ctx.shadowColor = 'rgba(70, 190, 255, 0.75)'
        ctx.shadowBlur = 9 * dpr
        ctx.fillStyle = grad
        for (let i = 0; i < BARS; i++) {
          const h = Math.max(dpr * 2, bars[i] * maxH)
          ctx.fillRect(pad + i * slot + (slot - bw) / 2, base - h, bw, h)
        }
        ctx.shadowBlur = 0
        ctx.fillStyle = refl
        for (let i = 0; i < BARS; i++) {
          const h = Math.max(dpr * 2, bars[i] * maxH) * 0.4
          ctx.fillRect(pad + i * slot + (slot - bw) / 2, base + dpr * 2, bw, h)
        }
        ctx.fillStyle = 'rgba(225, 250, 255, 0.95)'
        for (let i = 0; i < BARS; i++) {
          if (peaks[i] > 0.02) {
            const y = base - Math.max(dpr * 2, peaks[i] * maxH) - dpr * 4
            ctx.fillRect(pad + i * slot + (slot - bw) / 2, y, bw, dpr * 2)
          }
        }
        // baseline
        ctx.fillStyle = 'rgba(120, 200, 255, 0.55)'
        ctx.fillRect(pad, base, W - pad * 2, dpr)

        // keep the microphone and pop filter in front of the screen
        ctx.globalCompositeOperation = 'destination-out'
        ctx.filter = `blur(${2.2 * dpr}px)`
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.ellipse(toX(POP.x), toY(POP.y), POP.rx * k, POP.ry * k, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(toX(MIC.x), toY(MIC.y), MIC.w * k, MIC.h * k)
        ctx.filter = 'none'
        ctx.globalCompositeOperation = 'source-over'
      }

      last = t
      if (playing || vis > 0.01 || alive) raf = requestAnimationFrame(frame)
    }

    kick.current = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    kick.current()
    return () => {
      cancelAnimationFrame(raf)
      kick.current = () => {}
    }
  }, [host, geo.width, geo.height, geo.s])

  useEffect(() => {
    kick.current()
  }, [player.playing])

  if (!host) return null
  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        zIndex: -1,
        left: geo.left,
        top: geo.top,
        width: geo.width,
        height: geo.height,
        opacity: 0,
        pointerEvents: 'none',
        borderRadius: 2,
      }}
    />,
    host
  )
}
