import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Position of the monitor screen in works_bg_music.webp (2000x1105, background-size: cover, centred).
const BG = { w: 2000, h: 1105 }
const SCREEN = { x: 1013, y: 259, w: 424, h: 267 }
// Things standing in front of the screen: the pop filter and the microphone.
const POP = { x: 1320, y: 466, rx: 55, ry: 67 }
const MIC = { x: 1331, y: 458, w: 64, h: 100 }

const BASE = import.meta.env.BASE_URL
// The crystal DZ (music/logo_crystal.webp) is a crop of a 2000x1105 render, saved at half size.
// Its columns are stretched like equalizer bars; BASE_* is the line where they meet the plate.
const CRYSTAL = {
  x0: 380, // crop origin in the original render
  y0: 0,
  scale: 0.4, // saved size / original size
  w: 496,
  h: 432,
  left: 440, // crystals span this range (the gap between D and Z has no columns)
  right: 1550,
  gap: [1045, 1065],
  // where the columns stand on the plate, a few px above the real tips
  baseD: [[450, 804], [480, 806], [495, 842], [545, 846], [580, 854], [625, 854], [662, 861], [705, 861], [750, 856], [795, 846], [845, 829], [895, 814], [937, 776], [977, 736], [1003, 689], [1025, 640], [1045, 620]],
  baseZ: [[1070, 794], [1120, 779], [1160, 774], [1200, 771], [1250, 771], [1300, 769], [1340, 766], [1370, 761], [1410, 756], [1450, 754], [1495, 749], [1540, 739]],
  anchorX: 995, // the point of the render that is put at the logo position
  anchorY: 830,
  cx: 0.44, // logo position on the screen, fractions
  by: 0.69,
  k: 0.145, // screen heights per 267 px of original render
}

function lerpLine(line, x) {
  if (x <= line[0][0]) return line[0][1]
  for (let i = 1; i < line.length; i++) {
    if (x <= line[i][0]) {
      const [x0, y0] = line[i - 1]
      const [x1, y1] = line[i]
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return line[line.length - 1][1]
}

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
  const spillRef = useRef(null)
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
    logo.src = `${BASE}music/logo_crystal_v2.webp`
    let logoReady = false
    logo.onload = () => {
      logoReady = true
    }
    // The picture is cut into thin vertical strips. Each strip is stretched up from the
    // line where its crystals stand on the plate; what is below that line stays put.
    const SW = 2 // strip width in saved px
    const strips = []
    for (let sx = 0; sx < CRYSTAL.w; sx += SW) {
      const xo = CRYSTAL.x0 + (sx + SW / 2) / CRYSTAL.scale
      const inCrystals = xo >= CRYSTAL.left && xo <= CRYSTAL.right && !(xo > CRYSTAL.gap[0] && xo < CRYSTAL.gap[1])
      const baseO = inCrystals ? lerpLine(xo < CRYSTAL.gap[0] ? CRYSTAL.baseD : CRYSTAL.baseZ, xo) : 0
      strips.push({
        sx,
        xo,
        baseO,
        baseS: inCrystals ? (baseO - CRYSTAL.y0) * CRYSTAL.scale : 0,
        u: Math.min(Math.max((xo - CRYSTAL.left) / (CRYSTAL.right - CRYSTAL.left), 0), 1),
        live: inCrystals,
        lvl: 0,
      })
    }
    const sl = document.createElement('canvas')
    sl.width = 1
    sl.height = Math.max(3, Math.round(4 * dpr))
    const slc = sl.getContext('2d')
    slc.fillStyle = 'rgba(0, 0, 10, 0.55)'
    slc.fillRect(0, 0, 1, Math.max(1, Math.round(dpr)))
    const scan = ctx.createPattern(sl, 'repeat')
    const lc = document.createElement('canvas')
    lc.width = W
    lc.height = H
    const lctx = lc.getContext('2d')
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
      const back = ctx.createRadialGradient(W * 0.48, H * 0.62, 0, W * 0.48, H * 0.62, W * 0.72)
      back.addColorStop(0, 'rgba(10, 34, 96, 0.95)')
      back.addColorStop(0.6, 'rgba(4, 14, 48, 0.95)')
      back.addColorStop(1, 'rgba(1, 4, 18, 0.97)')
      ctx.fillStyle = back
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

      // the crystal DZ: columns grow with their frequency band, the whole thing hits on the bass
      if (logoReady) {
        const kk = (CRYSTAL.k * H) / 267 // screen px per px of the original render
        const cxPx = W * CRYSTAL.cx
        const byPx = H * CRYSTAL.by
        const pulse = vis * (0.5 * bass + 0.9 * beat)

        lctx.clearRect(0, 0, W, H)
        const fpos = (u) => u * (PTS - 1)
        for (let j = 0; j < strips.length; j++) {
          const st = strips[j]
          let target = 0
          if (st.live) {
            const fi = fpos(st.u)
            const i0 = Math.floor(fi)
            const i1 = Math.min(i0 + 1, PTS - 1)
            const band = shaped[i0] * (1 - (fi - i0)) + shaped[i1] * (fi - i0)
            const vary = 0.9 + 0.2 * Math.sin(j * 0.53) * Math.sin(j * 0.19 + 1.3)
            const idle = 0.03 * Math.sin(t * 0.0013 + st.u * 6.5) + 0.02 * Math.sin(t * 0.0021 + st.u * 15)
            // the highs (Z) are quieter in any music, so they get a little more gain
            target = vis * (0.34 * band * vary * (1 + 0.6 * st.u) + 0.08 * beat) + (1 - vis) * idle
          }
          st.lvl += (target - st.lvl) * (target > st.lvl ? 0.45 : 0.14)
          const f = 1 + Math.min(Math.max(st.lvl, -0.06), 0.32)
          const dx = cxPx + (st.xo - CRYSTAL.anchorX) * kk
          const dw = (SW / CRYSTAL.scale) * kk + 0.7
          const baseDest = byPx + ((st.live ? st.baseO : CRYSTAL.y0) - CRYSTAL.anchorY) * kk
          if (st.live) {
            const hTop = (st.baseO - CRYSTAL.y0) * kk * f
            lctx.drawImage(logo, st.sx, 0, SW, st.baseS, dx, baseDest - hTop, dw, hTop + 0.6)
          }
          const srcY = st.live ? st.baseS : 0
          lctx.drawImage(logo, st.sx, srcY, SW, CRYSTAL.h - srcY, dx, baseDest, dw, ((CRYSTAL.h - srcY) / CRYSTAL.scale) * kk)
        }
        // soft edges: the plate fades into the dark screen
        lctx.globalCompositeOperation = 'destination-in'
        const mx = cxPx
        const my = byPx - H * 0.12
        const mg = lctx.createRadialGradient(mx, my, H * 0.2, mx, my, H * 0.78)
        mg.addColorStop(0, 'rgba(0, 0, 0, 1)')
        mg.addColorStop(0.62, 'rgba(0, 0, 0, 1)')
        mg.addColorStop(1, 'rgba(0, 0, 0, 0)')
        lctx.fillStyle = mg
        lctx.fillRect(0, 0, W, H)
        lctx.globalCompositeOperation = 'source-over'

        // light spilled around it
        const R = H * (0.62 + 0.3 * pulse)
        const hy = byPx - H * 0.22
        const halo = ctx.createRadialGradient(cxPx, hy, R * 0.08, cxPx, hy, R)
        halo.addColorStop(0, `rgba(70, 150, 255, ${0.16 + 0.34 * pulse})`)
        halo.addColorStop(0.55, `rgba(70, 80, 255, ${0.06 + 0.18 * pulse})`)
        halo.addColorStop(1, 'rgba(230, 80, 60, 0)')
        ctx.fillStyle = halo
        ctx.fillRect(0, 0, W, H)

        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        ctx.shadowColor = `rgba(80, 160, 255, ${0.35 + 0.4 * Math.min(pulse, 1)})`
        ctx.shadowBlur = (6 + 18 * pulse) * dpr
        ctx.globalAlpha = 1
        ctx.drawImage(lc, 0, 0)
        ctx.shadowBlur = 0
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = 0.22
        ctx.drawImage(lc, 0, 0)
        const lift = vis * (0.3 * high + 0.5 * beat)
        if (lift > 0.01) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = Math.min(lift, 0.6)
          ctx.drawImage(lc, 0, 0)
        }
        ctx.restore()
      }

      // make it part of the screen: cool grade, scan lines, glass glare, dark corners
      {
        ctx.save()
        ctx.globalCompositeOperation = 'soft-light'
        ctx.fillStyle = `rgba(40, 110, 255, ${0.22 + 0.08 * (1 - vis)})`
        ctx.fillRect(0, 0, W, H)
        ctx.restore()

        if (scan) {
          ctx.save()
          ctx.globalAlpha = 0.16
          ctx.fillStyle = scan
          ctx.fillRect(0, 0, W, H)
          ctx.restore()
        }

        const glare = ctx.createLinearGradient(0, 0, W * 0.75, H * 0.9)
        glare.addColorStop(0, 'rgba(190, 220, 255, 0.11)')
        glare.addColorStop(0.32, 'rgba(190, 220, 255, 0.03)')
        glare.addColorStop(0.55, 'rgba(190, 220, 255, 0)')
        ctx.fillStyle = glare
        ctx.fillRect(0, 0, W, H)

        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.66)
        vig.addColorStop(0, 'rgba(0, 4, 20, 0)')
        vig.addColorStop(1, 'rgba(0, 4, 20, 0.42)')
        ctx.fillStyle = vig
        ctx.fillRect(0, 0, W, H)

        // the screen lights the room: spill on the wall and desk follows the beat
        if (spillRef.current) spillRef.current.style.opacity = String(0.55 + 0.4 * Math.min(1, vis * (0.5 * bass + beat)))
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
  const spillW = geo.width * 1.9
  const spillH = geo.height * 2.1
  return createPortal(
    <>
      <div
        ref={spillRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          zIndex: -1,
          left: geo.left + geo.width / 2 - spillW / 2,
          top: geo.top + geo.height * 0.55 - spillH / 2,
          width: spillW,
          height: spillH,
          background:
            'radial-gradient(closest-side, rgba(60, 150, 255, 0.34), rgba(40, 90, 255, 0.14) 55%, rgba(30, 60, 255, 0) 100%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
          opacity: 0.55,
        }}
      />
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
    />
    </>,
    host
  )
}
