import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Position of the monitor screen in works_bg_music.webp (2000x1105, background-size: cover, centred).
const BG = { w: 2000, h: 1105 }
const SCREEN = { x: 1013, y: 259, w: 424, h: 267 }
// Things standing in front of the screen: the pop filter and the microphone.
const POP = { x: 1320, y: 466, rx: 55, ry: 67 }
const MIC = { x: 1331, y: 458, w: 64, h: 100 }

const BASE = import.meta.env.BASE_URL
// the DZ logo sits in the free left part of the screen (fractions of the screen)
const LOGO = { cx: 0.31, cy: 0.47, h: 0.68 }

const PTS = 30 // points along the curve
const F_MIN = 45
const F_MAX = 12000
// three layers of the same wave at different "weights": the back ones lag behind and breathe slower
const LAYERS = [
  { rate: 0.045, scale: 0.72, top: 'rgba(120, 90, 255, 0.55)', bottom: 'rgba(60, 40, 220, 0)' },
  { rate: 0.085, scale: 0.86, top: 'rgba(60, 160, 255, 0.6)', bottom: 'rgba(30, 90, 255, 0)' },
  { rate: 0.16, scale: 1, top: 'rgba(150, 245, 255, 0.85)', bottom: 'rgba(40, 120, 255, 0.02)' },
]

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

    const state = LAYERS.map(() => new Float32Array(PTS))
    let ref = 0.4 // slow auto-gain: the loudest recent level counts as "full"
    const bandRef = new Float32Array(PTS).fill(0.25) // the same, per frequency band
    let data = null
    let vis = 0
    let raf = 0

    const logo = new Image()
    logo.src = `${BASE}logo_dz.png`
    let logoReady = false
    logo.onload = () => {
      logoReady = true
    }
    // the logo on its own canvas, so a light sheen can be clipped to its shape
    const lh = Math.round(H * LOGO.h)
    const lw = Math.round((lh * 426) / 465)
    const sheen = document.createElement('canvas')
    sheen.width = lw
    sheen.height = lh
    const sctx = sheen.getContext('2d')
    let bass = 0
    let mid = 0
    let high = 0
    let bassAvg = 0.2
    let beat = 0
    let lastDraw = 0

    // mic and pop filter, in canvas pixels
    const k = (geo.s * dpr)
    const toX = (ix) => (ix - SCREEN.x) * k
    const toY = (iy) => (iy - SCREEN.y) * k

    // the curve starts and ends on the baseline, like an arch
    const arch = Array.from({ length: PTS }, (_, i) => Math.pow(Math.sin((Math.PI * (i + 0.5)) / PTS), 0.7))

    const trace = (levels, scale, W0, base, amp) => {
      // the arch fits into the part of the screen left of the pop filter
      const pad = W0 * 0.05
      const step = (W0 * 0.56 - pad) / (PTS - 1)
      const pt = (i) => [pad + i * step, base - levels[i] * arch[i] * amp * scale]
      ctx.beginPath()
      ctx.moveTo(pad, base)
      let [px, py] = pt(0)
      ctx.lineTo(px, py)
      for (let i = 1; i < PTS; i++) {
        const [x, y] = pt(i)
        ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
        px = x
        py = y
      }
      ctx.lineTo(px, py)
      ctx.lineTo(pad + (PTS - 1) * step, base)
      ctx.closePath()
    }

    const frame = (t) => {
      raf = 0
      const { playing, volume, analyserRef } = live.current
      const an = analyserRef && analyserRef.current
      vis += ((playing ? 1 : 0) - vis) * 0.07
      canvas.style.opacity = '1'
      // idle breathing does not need 60 fps
      if (!playing && vis < 0.02 && t - lastDraw < 32) {
        raf = requestAnimationFrame(frame)
        return
      }
      lastDraw = t

      // raw level per point
      const raw = new Float32Array(PTS)
      let frameMax = 0
      if (playing && an) {
        if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount)
        an.getByteFrequencyData(data)
        const nyq = an.context.sampleRate / 2
        const gain = 1 / Math.max(volume, 0.25)
        for (let i = 0; i < PTS; i++) {
          const f0 = F_MIN * Math.pow(F_MAX / F_MIN, i / PTS)
          const f1 = F_MIN * Math.pow(F_MAX / F_MIN, (i + 1) / PTS)
          const b0 = Math.floor((f0 / nyq) * data.length)
          const b1 = Math.max(b0 + 1, Math.ceil((f1 / nyq) * data.length))
          let sum = 0
          let n = 0
          for (let b = b0; b < b1 && b < data.length; b++) {
            sum += data[b]
            n++
          }
          raw[i] = ((sum / Math.max(n, 1)) / 255) * gain * (1 + (i / PTS) * 0.6)
          frameMax = Math.max(frameMax, raw[i])
        }
      }
      if (playing && frameMax < 0.02 && volume > 0) {
        // no analyser (or the browser keeps it silent): a believable fake
        for (let i = 0; i < PTS; i++) {
          raw[i] = (0.85 - (i / PTS) * 0.5) * (0.4 + 0.35 * Math.sin(t * 0.0023 + i * 0.5) * Math.sin(t * 0.0011 + i * 0.23) + 0.2 * Math.abs(Math.sin(t * 0.005 + i * 1.3)))
        }
        frameMax = 0.8
      }

      // auto-gain: the level scales to what the track recently did, so it never flat-tops
      ref = Math.max(ref * 0.9965, frameMax, 0.3)
      const shaped = new Float32Array(PTS)
      for (let i = 0; i < PTS; i++) {
        // every band also scales to its own recent peak, so the highs move as much as the bass
        bandRef[i] = Math.max(bandRef[i] * 0.997, raw[i], 0.12)
        const denom = 0.35 * ref + 0.65 * bandRef[i]
        shaped[i] = Math.pow(Math.min(raw[i] / denom, 1), 1.35)
      }
      // blur along the frequency axis: neighbouring points move together
      for (let pass = 0; pass < 2; pass++) {
        const prev = shaped.slice()
        for (let i = 0; i < PTS; i++) {
          const l = prev[Math.max(i - 1, 0)]
          const r = prev[Math.min(i + 1, PTS - 1)]
          shaped[i] = l * 0.25 + prev[i] * 0.5 + r * 0.25
        }
      }

      let alive = false
      LAYERS.forEach((L, li) => {
        const st = state[li]
        for (let i = 0; i < PTS; i++) {
          const rate = shaped[i] > st[i] ? L.rate * 1.8 : L.rate
          st[i] += (shaped[i] - st[i]) * rate
          if (st[i] > 0.004) alive = true
        }
      })

      // band levels that drive the logo
      const avg = (from, to) => {
        let sum = 0
        for (let i = from; i < to; i++) sum += shaped[i]
        return sum / (to - from)
      }
      const tb = playing ? avg(0, 6) : 0
      bass += (tb - bass) * (tb > bass ? 0.5 : 0.12)
      mid += ((playing ? avg(8, 18) : 0) - mid) * 0.2
      high += ((playing ? avg(20, PTS) : 0) - high) * 0.25
      const onset = Math.max(0, tb - bassAvg * 1.2 - 0.05)
      bassAvg += (tb - bassAvg) * 0.04
      beat = Math.max(beat * 0.9, Math.min(onset * 2.4, 1))

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(2, 6, 26, 0.93)'
      ctx.fillRect(0, 0, W, H)

      // the wave stays behind the logo while music plays
      if (vis > 0.01) {
        const base = H * 0.78
        const amp = base * 0.55
        ctx.save()
        ctx.globalAlpha = 0.7 * Math.min(vis, 1)
        LAYERS.forEach((L, li) => {
          const g = ctx.createLinearGradient(0, base - amp * L.scale, 0, base)
          g.addColorStop(0, L.top)
          g.addColorStop(1, L.bottom)
          ctx.fillStyle = g
          trace(state[li], L.scale, W, base, amp)
          ctx.fill()
        })
        ctx.restore()
      }

      // the DZ logo: breathes when it is quiet, hits on the bass, sparkles on the highs
      if (logoReady) {
        const breathe = 0.5 + 0.5 * Math.sin(t * 0.0016)
        const pulse = vis * (0.55 * bass + 0.95 * beat)
        const scale = 1 + 0.014 * breathe * (1 - vis) + 0.075 * pulse
        const cx = W * LOGO.cx
        const cy = H * LOGO.cy

        const R = lh * (0.8 + 0.4 * pulse + 0.05 * breathe)
        const halo = ctx.createRadialGradient(cx, cy, R * 0.08, cx, cy, R)
        halo.addColorStop(0, `rgba(70, 150, 255, ${0.26 + 0.1 * breathe * (1 - vis) + 0.4 * pulse})`)
        halo.addColorStop(0.55, `rgba(60, 90, 255, ${0.1 + 0.2 * pulse})`)
        halo.addColorStop(1, 'rgba(230, 80, 60, 0)')
        ctx.fillStyle = halo
        ctx.fillRect(0, 0, W, H)

        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(scale, scale)
        ctx.shadowColor = `rgba(80, 160, 255, ${0.5 + 0.4 * Math.min(pulse, 1)})`
        ctx.shadowBlur = (8 + 24 * pulse) * dpr
        ctx.globalAlpha = 0.86 + 0.1 * breathe * (1 - vis) + 0.14 * Math.min(pulse, 1)
        ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh)
        ctx.shadowBlur = 0

        // brighter on highs and hits
        const lift = vis * (0.4 * high + 0.55 * beat)
        if (lift > 0.01) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = Math.min(lift, 0.65)
          ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh)
        }

        // a sheen crossing the facets, clipped to the logo's own shape
        const p = ((t % 5600) / 5600) * 1.7 - 0.35
        sctx.clearRect(0, 0, lw, lh)
        sctx.globalCompositeOperation = 'source-over'
        sctx.drawImage(logo, 0, 0, lw, lh)
        sctx.globalCompositeOperation = 'source-atop'
        const px = p * lw
        const sg = sctx.createLinearGradient(px - lw * 0.2, 0, px + lw * 0.2, lh * 0.45)
        sg.addColorStop(0, 'rgba(255, 255, 255, 0)')
        sg.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)')
        sg.addColorStop(1, 'rgba(255, 255, 255, 0)')
        sctx.fillStyle = sg
        sctx.fillRect(0, 0, lw, lh)
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = 0.3 + 0.5 * vis * Math.min(high + beat, 1)
        ctx.drawImage(sheen, -lw / 2, -lh / 2)
        ctx.restore()
      }

      {
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

      raf = requestAnimationFrame(frame)
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
