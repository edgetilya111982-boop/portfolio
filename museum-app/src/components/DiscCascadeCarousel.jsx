import * as React from 'react'

/*
 * Disc Cascade Carousel — a catalogue told in discs on a slanted line that climbs toward
 * the viewer. One number (the position) is chased by two springs: a stiff one for the slide
 * and a looser one for depth, turn and roll. Drag, flick, wheel, arrow keys, the index menu
 * and the buttons all just move the target; frames are written straight to the DOM and stop
 * when the springs settle. Disc labels are either an image (`src`) or generated as SVG.
 *
 * Item: { title, credits?: [{label, value}], reviews?: [{source, quote, stars}], src?, alt?,
 *         pattern?, palette?: [bg, figure, accent], label?, labelStyle?: 'arc'|'block',
 *         ink?, fine? }
 */

// #region motion
const wrapIndex = (i, n) => (n <= 0 ? 0 : ((i % n) + n) % n)

/** The slide showing at a position. Without looping, a drag past an end still means the end slide. */
function indexAt(pos, n, loop) {
  if (n <= 0) return 0
  const i = Math.round(pos)
  return loop ? wrapIndex(i, n) : Math.min(Math.max(i, 0), n - 1)
}

/** Signed distance from the position to slide i, in slides. Looping takes the short way round. */
function offsetOf(i, pos, n, loop) {
  const d = i - pos
  return loop && n > 0 ? d - n * Math.round(d / n) : d
}

/** Past either end the line still follows a drag, at a third of the speed. */
function rubber(pos, n) {
  if (pos < 0) return pos / 3
  if (pos > n - 1) return n - 1 + (pos - (n - 1)) / 3
  return pos
}

/** Natural frequency and damping ratios from a framer-style bounce and duration. */
function springOf(bounce, duration) {
  const b = Math.min(Math.max(bounce, 0), 0.9)
  return { omega: (2 * Math.PI) / Math.max(duration, 0.1), slide: 1 - b / 2, tilt: 1 - b }
}

/** One semi-implicit Euler step, sub-stepped so a long frame can't blow it up. */
function springStep(x, v, target, omega, zeta, dt) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)))
  const h = dt / steps
  for (let k = 0; k < steps; k++) {
    v += (-omega * omega * (x - target) - 2 * zeta * omega * v) * h
    x += v * h
  }
  return [x, v]
}

/** Where a released drag comes to rest: about a fifth of a second of the flick, at most three slides on. */
function releaseTarget(pos, velocity, n, loop) {
  const here = Math.round(pos)
  let t = Math.round(pos + velocity * 0.2)
  t = Math.min(Math.max(t, here - 3), here + 3)
  return loop ? t : Math.min(Math.max(t, 0), n - 1)
}

/** The nearest position showing slide i, from where the target is now. */
function targetFor(i, target, n, loop) {
  if (!loop) return Math.min(Math.max(i, 0), n - 1)
  const here = Math.round(target)
  let d = i - wrapIndex(here, n)
  d -= n * Math.round(d / n)
  return here + d
}

/**
 * A disc's pose. `dx` is its distance from the sliding line, `d` from the trailing spring.
 * Position follows the line; depth, turn and roll follow the trailing spring, which is what
 * makes the discs swing. Discs coming toward the viewer stop approaching so perspective can't explode.
 */
function poseOf(dx, d, c) {
  const near = Math.min(d, 2.2)
  return {
    x: dx * c.spacing,
    y: -dx * c.rise,
    z: near * c.depth,
    yaw: c.yaw + d * c.fan,
    roll: d * c.roll,
    zIndex: 100 + Math.round(d * 10),
    opacity: d < -2.5 ? Math.max(0, 1 - (-d - 2.5) / 1.2) : 1,
    hidden: dx < -4 || dx > c.ahead,
  }
}
// #endregion

// #region art
/** Small deterministic PRNG, so a label is the same on every render. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Black or white print against a hex background. Anything unparseable gets white. */
function inkFor(bg) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(bg.trim())
  if (!m) return '#ffffff'
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  const lin = (i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4)
  return L > 0.36 ? '#111111' : '#ffffff'
}

/** Greedy word wrap for the block label. A word longer than the line gets a line to itself. */
function wrapLabel(text, max) {
  const out = []
  let cur = ''
  for (const w of text.trim().split(/\s+/)) {
    if (!w) continue
    if (cur && (cur + ' ' + w).length > max) {
      out.push(cur)
      cur = w
    } else cur = cur ? cur + ' ' + w : w
  }
  if (cur) out.push(cur)
  return out
}

/** Font size (in the 200-unit disc) for `chars` condensed caps across `room` units, capped at `max`. */
const fitSize = (chars, room, max) => Math.max(6, Math.min(max, room / (Math.max(chars, 1) * 0.56)))

/** The width `chars` condensed caps take at size `fs`: what the label is pinned to whatever font arrives. */
const textWidth = (chars, fs) => Math.max(chars, 1) * fs * 0.56
// #endregion

const PATTERNS = ['horizon', 'mosaic', 'eclipse', 'sunburst', 'halftone', 'rings', 'stripes']
const PALETTES = [
  ['#1b1d1f', '#3f6b3a', '#c9d6c4'],
  ['#f2e3c6', '#d2452b', '#2a5d8f'],
  ['#141414', '#e9e4da', '#c8a24a'],
  ['#f0c94c', '#e8572b', '#2b2622'],
  ['#e9e6df', '#1d1d1d', '#d84b3c'],
  ['#2d3f7a', '#e8b4c8', '#f4efe6'],
  ['#d9e3df', '#16443f', '#f08a5d'],
]

const CSS =
  '.dcc-root{position:relative;overflow:hidden;width:100%;container-type:inline-size;' +
  'color:var(--color-foreground,#1a1a1a);user-select:none;-webkit-user-select:none;touch-action:pan-y;' +
  'outline:none;-webkit-tap-highlight-color:transparent;--dcc-pad:clamp(16px,3.6cqw,44px)}' +
  '.dcc-root:focus-visible{box-shadow:inset 0 0 0 2px var(--color-primary,#171717)}' +
  '.dcc-root[data-dragging],.dcc-root[data-dragging] .dcc-slide{cursor:grabbing}' +
  '.dcc-frame{position:absolute;inset:calc(var(--dcc-pad) * .45);pointer-events:none;z-index:1;' +
  'border:1px solid color-mix(in oklab,currentColor 14%,transparent)}' +
  '.dcc-stage{position:absolute;left:var(--dcc-x,50%);top:52%;width:var(--dcc-s);aspect-ratio:1/1;' +
  'transform:translate(-50%,-50%);perspective:calc(var(--dcc-s) * 3.2)}' +
  '.dcc-slide{position:absolute;inset:0;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;' +
  'border-radius:50%;cursor:pointer;will-change:transform;transform-style:preserve-3d;' +
  '-webkit-tap-highlight-color:transparent;outline:none}' +
  '.dcc-tilt{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.7,.2,1)}' +
  '.dcc-slide[data-active] .dcc-tilt{transform:translateZ(var(--dcc-lift,0px)) ' +
  'rotateX(calc(var(--dcc-py,0) * -12deg)) rotateY(calc(var(--dcc-px,0) * 12deg))}' +
  '.dcc-slide[data-active]:hover{--dcc-lift:calc(var(--dcc-s) * .05)}' +
  '.dcc-shade{position:absolute;inset:0;border-radius:50%;pointer-events:none;' +
  'transform:translate3d(0,7%,-18px) scale(.97);' +
  'background:radial-gradient(circle closest-side,transparent 30%,rgba(0,0,0,.2) 52%,rgba(0,0,0,.1) 80%,transparent 100%)}' +
  '.dcc-edge,.dcc-disc{position:absolute;inset:0;border-radius:50%;' +
  '-webkit-mask:radial-gradient(circle closest-side,transparent 16.6%,#000 17.1%);' +
  'mask:radial-gradient(circle closest-side,transparent 16.6%,#000 17.1%)}' +
  '.dcc-edge{transform:translateZ(-4px);background:linear-gradient(160deg,#d7d9dc,#8d9196 55%,#c4c7cb)}' +
  '.dcc-disc{overflow:hidden;background:#cfd2d6;' +
  'box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),inset 0 0 0 2px rgba(0,0,0,.08)}' +
  '.dcc-roll,.dcc-idle{position:absolute;inset:0;border-radius:50%}' +
  '.dcc-roll{transform:rotate(var(--dcc-roll,0deg))}' +
  '.dcc-root[data-spin] .dcc-idle{animation:dcc-spin var(--dcc-spin) linear infinite;animation-play-state:paused}' +
  '.dcc-root[data-spin] .dcc-slide[data-active] .dcc-idle{animation-play-state:running}' +
  '.dcc-root[data-dragging] .dcc-slide .dcc-idle{animation-play-state:paused}' +
  '@keyframes dcc-spin{to{transform:rotate(1turn)}}' +
  '.dcc-idle>img{position:absolute;inset:0;width:100%;height:100%;max-width:none;display:block;object-fit:cover}' +
  '.dcc-idle>svg,.dcc-hub{position:absolute;inset:0;width:100%;height:100%;max-width:none;display:block;overflow:visible}' +
  '.dcc-hub{pointer-events:none}' +
  '.dcc-sheen{position:absolute;inset:0;border-radius:50%;pointer-events:none;mix-blend-mode:screen;opacity:var(--dcc-sheen);' +
  'background:conic-gradient(from calc(var(--dcc-glint,0deg) + var(--dcc-px,0) * 70deg),' +
  'transparent 0deg,rgba(255,255,255,.5) 16deg,transparent 38deg,transparent 140deg,' +
  'rgba(150,215,255,.32) 168deg,rgba(255,170,225,.32) 186deg,rgba(255,236,170,.26) 200deg,transparent 224deg,transparent 360deg),' +
  'radial-gradient(circle at 32% 24%,rgba(255,255,255,.3),transparent 46%)}' +
  '.dcc-slide:focus-visible .dcc-disc{box-shadow:inset 0 0 0 3px var(--color-background,#fff),inset 0 0 0 6px var(--color-primary,#171717)}' +
  '.dcc-nav{position:absolute;top:calc(var(--dcc-pad) * .9);left:50%;transform:translateX(-50%);z-index:5;' +
  'display:flex;align-items:center;gap:clamp(12px,1.8cqw,22px);font-size:12px;white-space:nowrap}' +
  '.dcc-brand{font-weight:800;font-size:15px;letter-spacing:-.04em;margin-right:clamp(6px,1.4cqw,18px)}' +
  '.dcc-link{position:relative;color:inherit;text-decoration:none;opacity:.6;transition:opacity .2s;padding:4px 0}' +
  '.dcc-link:hover,.dcc-link[aria-current]{opacity:1}' +
  '.dcc-link[aria-current]::after{content:"";position:absolute;left:50%;bottom:-5px;width:3px;height:3px;margin-left:-1.5px;' +
  'border-radius:50%;background:currentColor}' +
  '.dcc-menu{position:relative}' +
  '.dcc-menubtn{display:inline-flex;align-items:center;gap:4px;margin:0;padding:4px 0;border:0;background:none;' +
  'color:inherit;font:inherit;cursor:pointer;opacity:.6;transition:opacity .2s}' +
  '.dcc-menubtn:hover,.dcc-menubtn[aria-expanded=true]{opacity:1}' +
  '.dcc-menubtn svg{transition:transform .25s}.dcc-menubtn[aria-expanded=true] svg{transform:rotate(180deg)}' +
  '.dcc-list{position:absolute;top:calc(100% + 10px);left:50%;transform:translateX(-50%);min-width:240px;margin:0;' +
  'padding:6px;list-style:none;border-radius:10px;' +
  'background:color-mix(in oklab,var(--color-background,#fff) 86%,transparent);' +
  'border:1px solid color-mix(in oklab,currentColor 12%,transparent);' +
  '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 12px 32px -12px rgba(0,0,0,.28);' +
  'animation:dcc-drop .22s cubic-bezier(.2,.7,.2,1) both}' +
  '@keyframes dcc-drop{from{opacity:0;transform:translate(-50%,-6px)}}' +
  '.dcc-opt{display:flex;align-items:baseline;gap:10px;width:100%;margin:0;padding:7px 10px;border:0;border-radius:6px;' +
  'background:none;color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer}' +
  '.dcc-opt:hover,.dcc-opt:focus-visible{outline:none;background:color-mix(in oklab,currentColor 8%,transparent)}' +
  '.dcc-opt[aria-current] .dcc-optt{font-weight:600}' +
  '.dcc-optn{font-size:10px;opacity:.45;font-variant-numeric:tabular-nums}' +
  '.dcc-opty{margin-left:auto;font-size:10px;opacity:.45}' +
  '.dcc-head{position:absolute;top:var(--dcc-pad);left:var(--dcc-pad);z-index:4;width:clamp(170px,21cqw,290px);pointer-events:none}' +
  '.dcc-title{margin:0 0 10px;font-weight:400;font-size:clamp(20px,2.5cqw,34px);line-height:.98;' +
  'letter-spacing:-.01em;text-transform:uppercase;text-wrap:balance}' +
  '.dcc-dl{margin:0}' +
  '.dcc-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0 6px;' +
  'border-top:1px solid color-mix(in oklab,currentColor 55%,transparent)}' +
  '.dcc-row dt{font-size:7.5px;line-height:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;opacity:.75}' +
  '.dcc-row dd{margin:0;font-size:10.5px;line-height:13px;text-align:right}' +
  '.dcc-row dd span{display:block}' +
  '.dcc-in{animation:dcc-in .8s cubic-bezier(.2,.7,.1,1) both;animation-delay:calc(var(--i,0) * 60ms)}' +
  '@keyframes dcc-in{from{opacity:0;transform:translateY(12px);filter:blur(5px)}}' +
  '.dcc-revs{position:absolute;bottom:calc(var(--dcc-pad) * 1.1);left:50%;transform:translateX(-50%);z-index:4;' +
  'display:flex;gap:clamp(24px,7cqw,96px);pointer-events:none}' +
  '.dcc-rev{width:clamp(130px,15cqw,200px);text-align:center}' +
  '.dcc-stars{font-size:8px;letter-spacing:3px;margin-bottom:6px}' +
  '.dcc-src{font-size:6.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px}' +
  '.dcc-quote{margin:0;font-size:clamp(13px,1.35cqw,17px);line-height:1.02;text-transform:uppercase;text-wrap:balance}' +
  '.dcc-ctl{position:absolute;right:var(--dcc-pad);bottom:var(--dcc-pad);z-index:5;display:flex;align-items:center;gap:10px}' +
  '.dcc-btn{display:grid;place-items:center;width:34px;height:34px;margin:0;padding:0;border-radius:999px;' +
  'border:1px solid color-mix(in oklab,currentColor 22%,transparent);background:none;color:inherit;cursor:pointer;' +
  'transition:background .2s,opacity .2s,transform .2s}' +
  '.dcc-btn:hover:not(:disabled){background:color-mix(in oklab,currentColor 8%,transparent)}' +
  '.dcc-btn:active:not(:disabled){transform:scale(.9)}' +
  '.dcc-btn:disabled{opacity:.28;cursor:default}' +
  '.dcc-btn:focus-visible,.dcc-menubtn:focus-visible,.dcc-link:focus-visible{outline:2px solid currentColor;outline-offset:3px}' +
  '.dcc-count{font-size:11px;letter-spacing:.08em;font-variant-numeric:tabular-nums;min-width:58px;text-align:center}' +
  '.dcc-count b{font-weight:600}' +
  '.dcc-hint{position:absolute;left:var(--dcc-pad);bottom:var(--dcc-pad);z-index:4;font-size:9px;letter-spacing:.18em;' +
  'text-transform:uppercase;opacity:.45;pointer-events:none;line-height:34px}' +
  '.dcc-root[data-column]{touch-action:none}' +
  '.dcc-panel{position:absolute;right:var(--dcc-pad);top:calc(var(--dcc-pad) * .9);z-index:5;' +
  'width:clamp(230px,16cqw,300px);max-height:calc(100% - var(--dcc-pad) * 3.4);overflow:auto;scrollbar-width:none;' +
  'padding:clamp(12px,1.1cqw,16px) clamp(12px,1.2cqw,18px);border-radius:12px;' +
  'background:linear-gradient(180deg,color-mix(in oklab,var(--dcc-panel-bg,#030720) 46%,transparent),' +
  'color-mix(in oklab,var(--dcc-panel-bg,#030720) 22%,transparent));' +
  'border:1px solid color-mix(in oklab,currentColor 8%,transparent);' +
  '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
  '.dcc-panel::-webkit-scrollbar{display:none}' +
  '.dcc-root[data-panel-left] .dcc-panel{right:auto;left:calc(var(--dcc-x,50%) + var(--dcc-s) * .78)}' +
  '.dcc-root[data-sleeve][data-panel-left] .dcc-panel{left:calc(var(--dcc-x,50%) + var(--dcc-s) * 1.12)}' +
  '.dcc-root[data-sleeve] .dcc-slide{border-radius:4px}' +
  '.dcc-root[data-sleeve] .dcc-sleeve{transition:filter .5s}' +
  '.dcc-root[data-sleeve] .dcc-slide:not([data-active]) .dcc-sleeve{filter:brightness(.5) saturate(.8)}' +
  '.dcc-root[data-sleeve] .dcc-slide[data-active] .dcc-tilt{transform:translateZ(var(--dcc-lift,0px)) rotateX(calc(var(--dcc-py,0) * -2.5deg)) rotateY(calc(var(--dcc-px,0) * 2.5deg))}' +
  '.dcc-root[data-sleeve] .dcc-slide[data-active]:hover{--dcc-lift:calc(var(--dcc-s) * .02)}' +
  '.dcc-sleeve{position:absolute;inset:0;overflow:hidden;border-radius:3px;background:#0a0b10;' +
  'box-shadow:0 26px 48px -16px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.08),inset -10px 0 14px -12px rgba(0,0,0,.55)}' +
  '.dcc-sleeve>img{display:block;width:100%;height:100%;object-fit:cover}' +
  '.dcc-sleeve::after{content:"";position:absolute;inset:0;pointer-events:none;' +
  'background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,0) 38%,rgba(255,255,255,0) 70%,rgba(255,255,255,.06))}' +
  '.dcc-slide:focus-visible .dcc-sleeve{outline:3px solid var(--color-primary,#fff);outline-offset:3px}' +
  '.dcc-vinyl{position:absolute;left:4%;top:4%;width:92%;height:92%;border-radius:50%;--vx:12%;' +
  'transform:translateX(var(--vx));transition:transform .85s cubic-bezier(.2,.7,.2,1);' +
  'background:#0b0b0e;box-shadow:0 14px 34px -12px rgba(0,0,0,.85),inset 0 0 0 1px rgba(255,255,255,.07)}' +
  '.dcc-slide[data-active] .dcc-vinyl{--vx:28%}' +
  '.dcc-slide .dcc-vinyl[data-playing]{--vx:62%}' +
  '.dcc-vinyl__spin{position:absolute;inset:0;border-radius:50%;' +
  'background:repeating-radial-gradient(circle closest-side at 50% 50%,#08080a 0 1.6px,#15151a 2.2px 3.2px);' +
  'animation:dcc-vspin 2.8s linear infinite;animation-play-state:paused}' +
  '.dcc-vinyl[data-playing] .dcc-vinyl__spin{animation-play-state:running}' +
  '@keyframes dcc-vspin{to{transform:rotate(1turn)}}' +
  '.dcc-vinyl::after{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;' +
  'background:conic-gradient(from 25deg,rgba(255,255,255,0),rgba(255,255,255,.2) 10%,rgba(255,255,255,0) 26%,' +
  'rgba(255,255,255,0) 50%,rgba(255,255,255,.16) 60%,rgba(255,255,255,0) 76%)}' +
  '.dcc-vinyl__label{position:absolute;inset:32%;overflow:hidden;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.55)}' +
  '.dcc-vinyl__label>img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 45%;transform:scale(1.7)}' +
  '.dcc-vinyl__label::after{content:"";position:absolute;left:50%;top:50%;width:9%;height:9%;transform:translate(-50%,-50%);' +
  'border-radius:50%;background:#05060a;box-shadow:0 0 0 1px rgba(255,255,255,.28)}' +
  '.dcc-panel .dcc-head{position:static;width:auto;pointer-events:auto}' +
  '.dcc-panel .dcc-title{margin:0 0 4px;font-size:clamp(17px,1.5cqw,22px)}' +
  '.dcc-panel .dcc-dl{display:flex;flex-wrap:wrap;gap:0 8px}' +
  '.dcc-panel .dcc-row{border-top:0;padding:0;gap:0}' +
  '.dcc-panel .dcc-row dt{display:none}' +
  '.dcc-panel .dcc-row dd{text-align:left;font-size:clamp(10.5px,.6cqw,12px);opacity:.7}' +
  '.dcc-panel .dcc-row+.dcc-row::before{content:"·";margin-right:8px;opacity:.5}' +
  '.dcc-tracks{list-style:none;margin:10px 0 0;padding:0;border-top:1px solid color-mix(in oklab,currentColor 14%,transparent)}' +
  '.dcc-track{display:flex;align-items:baseline;gap:9px;width:100%;margin:0;padding:7px 2px;border:0;' +
  'border-bottom:1px solid color-mix(in oklab,currentColor 6%,transparent);background:none;color:inherit;font:inherit;' +
  'font-size:clamp(12px,.72cqw,14px);text-align:left;cursor:pointer;opacity:.55;transition:opacity .2s,padding .25s}' +
  '.dcc-track:hover{opacity:.85}' +
  '.dcc-track[aria-current]{opacity:1;padding-left:8px;box-shadow:inset 2px 0 0 currentColor}' +
  '.dcc-track[aria-current] .dcc-optt{font-weight:600}' +
  '.dcc-track:focus-visible{outline:2px solid currentColor;outline-offset:-2px}' +
  '.dcc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
  '@container (max-width:720px){.dcc-root[data-panel-left] .dcc-panel{left:var(--dcc-pad)}.dcc-panel{top:auto;bottom:calc(var(--dcc-pad) * 3.4);width:auto;left:var(--dcc-pad);max-height:34%}.dcc-link{display:none}.dcc-rev+.dcc-rev{display:none}.dcc-hint{display:none}' +
  '.dcc-head{width:clamp(150px,44cqw,230px);top:calc(var(--dcc-pad) * 3.2)}.dcc-row:nth-child(n+3){display:none}}' +
  '@container (max-width:420px){.dcc-revs{bottom:calc(var(--dcc-pad) * 4.4)}}' +
  '@media (prefers-reduced-motion:reduce){.dcc-root .dcc-idle{animation:none}.dcc-in,.dcc-list{animation:none}' +
  '.dcc-tilt,.dcc-btn,.dcc-link,.dcc-menubtn svg{transition:none}}'

// ---- icons ---------------------------------------------------------------------------
function Arrow({ dir }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ maxWidth: 'none' }}>
      <path d={dir < 0 ? 'M19 12H5m6-6-6 6 6 6' : 'M5 12h14m-6-6 6 6-6 6'} />
    </svg>
  )
}

function Caret() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ maxWidth: 'none' }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

const pad = (n) => (n < 10 ? '0' + n : '' + n)
const lines = (v) => (Array.isArray(v) ? v : [v])

// ---- generated label art ---------------------------------------------------------------
function wedge(a0, a1, r) {
  const p = (a) => (100 + r * Math.cos(a)).toFixed(2) + ' ' + (100 + r * Math.sin(a)).toFixed(2)
  return 'M100 100L' + p(a0) + 'A' + r + ' ' + r + ' 0 0 1 ' + p(a1) + 'Z'
}

function Art({ pattern, pal, seed, uid }) {
  const [bg, fg, ac] = pal
  const r = rng(seed * 9973 + 17)
  const out = [<rect key="bg" width="200" height="200" fill={bg} />]
  if (pattern === 'sunburst') {
    const k = 28
    for (let i = 0; i < k; i += 2) out.push(<path key={'w' + i} d={wedge((i / k) * Math.PI * 2, ((i + 1) / k) * Math.PI * 2, 142)} fill={fg} />)
    out.push(<circle key="c" cx="100" cy="100" r="44" fill={ac} />)
    out.push(<circle key="c2" cx="100" cy="100" r="40.5" fill="none" stroke={bg} strokeWidth="1.6" strokeDasharray="2 3.5" />)
  } else if (pattern === 'rings') {
    for (let rr = 100, i = 0; rr > 36; rr -= 7, i++)
      out.push(<circle key={'r' + i} cx="100" cy="100" r={rr} fill={i % 3 === 2 ? ac : i % 2 ? bg : fg} />)
  } else if (pattern === 'halftone') {
    const fx = 50 + r() * 100
    const fy = 30 + r() * 60
    for (let y = 4; y < 200; y += 8)
      for (let x = 4 + ((y / 8) % 2) * 4; x < 200; x += 8) {
        const d = Math.hypot(x - fx, y - fy)
        const rad = Math.max(0, 3.9 - d / 34)
        if (rad > 0.3) out.push(<circle key={x + '-' + y} cx={x} cy={y} r={rad.toFixed(2)} fill={fg} />)
      }
    out.push(<circle key="s" cx={fx} cy={fy} r="16" fill={ac} />)
  } else if (pattern === 'horizon') {
    out.push(
      <linearGradient key="g" id={uid + 'sky'} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={bg} />
        <stop offset=".62" stopColor={ac} />
      </linearGradient>,
      <rect key="sky" width="200" height="200" fill={'url(#' + uid + 'sky)'} />,
      <circle key="sun" cx={60 + r() * 80} cy="112" r="20" fill="#f6efe0" opacity=".85" />,
    )
    // a tree line: lollipop crowns and narrow cypresses on a meadow
    let x = -4
    let i = 0
    while (x < 204) {
      const h = 18 + r() * 34
      const w = 7 + r() * 9
      if (r() > 0.45) out.push(<ellipse key={'t' + i} cx={x} cy={128 - h} rx={w} ry={w * 1.1} fill={fg} />)
      else out.push(<path key={'t' + i} d={'M' + x + ' ' + (130 - h * 1.35) + 'L' + (x + w * 0.55) + ' 130L' + (x - w * 0.55) + ' 130Z'} fill={fg} />)
      out.push(<rect key={'k' + i} x={x - 0.9} y={128 - h} width="1.8" height={h} fill={fg} />)
      x += w * (0.9 + r() * 0.8)
      i++
    }
    out.push(<rect key="m" y="128" width="200" height="72" fill={fg} />)
    for (let j = 0; j < 40; j++)
      out.push(<circle key={'f' + j} cx={(r() * 200).toFixed(1)} cy={(132 + r() * 66).toFixed(1)} r={(0.6 + r() * 1.2).toFixed(2)} fill={ac} opacity=".8" />)
  } else if (pattern === 'stripes') {
    const g = []
    for (let i = -10; i < 20; i++) g.push(<rect key={'s' + i} x={i * 14} y="-60" width="7" height="320" fill={i % 4 === 0 ? ac : fg} />)
    out.push(<g key="g" transform={'rotate(' + (20 + r() * 40).toFixed(1) + ' 100 100)'}>{g}</g>)
  } else if (pattern === 'eclipse') {
    for (let j = 0; j < 70; j++)
      out.push(<circle key={'st' + j} cx={(r() * 200).toFixed(1)} cy={(r() * 200).toFixed(1)} r={(0.3 + r() * 0.9).toFixed(2)} fill={fg} opacity={(0.3 + r() * 0.7).toFixed(2)} />)
    out.push(
      <circle key="halo" cx="100" cy="100" r="78" fill="none" stroke={ac} strokeWidth="1" opacity=".6" />,
      <circle key="moon" cx="100" cy="100" r="66" fill={fg} />,
      <circle key="bite" cx={118} cy={88} r="62" fill={bg} />,
      <circle key="ring" cx="100" cy="100" r="66" fill="none" stroke={ac} strokeWidth="1.4" strokeDasharray="1 3" />,
    )
  } else {
    // mosaic: a tile field in the palette with a few round "windows"
    const cols = [bg, fg, ac]
    for (let y = 0; y < 200; y += 20)
      for (let x = 0; x < 200; x += 20) {
        const c = cols[Math.floor(r() * 3)]
        const kind = r()
        out.push(<rect key={'q' + x + '-' + y} x={x} y={y} width="20" height="20" fill={c} />)
        if (kind > 0.7) out.push(<circle key={'o' + x + '-' + y} cx={x + 10} cy={y + 10} r="7" fill={cols[(cols.indexOf(c) + 1) % 3]} />)
        else if (kind > 0.45) out.push(<path key={'p' + x + '-' + y} d={'M' + x + ' ' + y + 'h20L' + x + ' ' + (y + 20)} fill={cols[(cols.indexOf(c) + 2) % 3]} />)
      }
  }
  return <>{out}</>
}

function Print({ item, i, uid, mark, ink, halo }) {
  const label = (item.label ?? item.title).toUpperCase()
  const fine = (
    item.fine ??
    (item.credits ?? []).map((c) => c.label + ' ' + lines(c.value).join(', ')).join('  ·  ')
  ).toUpperCase()
  // A halo in the label's own ground keeps the print legible over busy art, like a knocked-out plate.
  const ring = (w) => ({ stroke: halo, strokeWidth: item.src ? w * 0.4 : w, strokeLinejoin: 'round', paintOrder: 'stroke' })
  const stroke = ring(2.4)
  const small = ring(1.2)
  let headline = null
  if (label && (item.labelStyle ?? 'arc') === 'arc') {
    const fs = fitSize(label.length, 226 * 0.86, 21)
    // textLength pins the set width, so a wide fallback font squeezes instead of overflowing.
    headline = (
      <text
        fill={ink}
        fontSize={fs.toFixed(2)}
        fontWeight="700"
        textAnchor="middle"
        textLength={textWidth(label.length, fs).toFixed(1)}
        lengthAdjust="spacingAndGlyphs"
        {...stroke}
      >
        <textPath href={'#' + uid + 'top'} startOffset="50%">
          {label}
        </textPath>
      </text>
    )
  } else if (label) {
    // Stacked between y 26 and 58: above the hub, inside the rim.
    const ls = wrapLabel(label, 11).slice(0, 3)
    const fs = Math.min(fitSize(Math.max(...ls.map((l) => l.length)), 112, 20), 32 / (ls.length * 0.98))
    const lh = fs * 0.98
    const y0 = 58 - (ls.length - 1) * lh
    headline = (
      <g fill={ink} fontSize={fs.toFixed(2)} fontWeight="700" {...stroke}>
        {ls.map((l, k) => {
          const y = y0 + k * lh
          // the chord at this height, less a margin, bounds the line
          const room = 2 * Math.sqrt(Math.max(0, 86 * 86 - (100 - y + fs * 0.35) ** 2))
          return (
            <text
              key={k}
              x="100"
              y={y.toFixed(2)}
              textAnchor="middle"
              textLength={Math.min(textWidth(l.length, fs), room).toFixed(1)}
              lengthAdjust="spacingAndGlyphs"
            >
              {l}
            </text>
          )
        })}
      </g>
    )
  }
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" style={{ maxWidth: 'none' }}>
      <defs>
        <path id={uid + 'top'} d="M28 100a72 72 0 1 1 144 0" />
        <path id={uid + 'bot'} d="M14 100a86 86 0 0 0 172 0" />
      </defs>
      {headline}
      {fine ? (
        <text fill={ink} fontSize="5.2" letterSpacing=".7" textAnchor="middle" opacity=".86" {...small}>
          <textPath href={'#' + uid + 'bot'} startOffset="50%">
            {fine.length > 120 ? fine.slice(0, 118) + '…' : fine}
          </textPath>
        </text>
      ) : null}
      {mark ? (
        <text x="100" y="150" fill={ink} fontSize="10" fontWeight="800" letterSpacing="-.4" textAnchor="middle" {...small}>
          {mark}
        </text>
      ) : null}
      {item.src ? null : (
        <text x="100" y="64" fill={ink} fontSize="4" letterSpacing="1.2" textAnchor="middle" opacity=".6" transform="rotate(180 100 100)">
          {'DISC ' + pad(i + 1)}
        </text>
      )}
    </svg>
  )
}

// The clear clamping ring, the stacking ridge and the mirror band round the hole.
function Hub({ uid }) {
  return (
    <svg className="dcc-hub" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={uid + 'metal'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbfbfc" />
          <stop offset=".45" stopColor="#a9adb3" />
          <stop offset=".55" stopColor="#eef0f2" />
          <stop offset="1" stopColor="#8f949a" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="35.5" fill="none" stroke={'url(#' + uid + 'metal)'} strokeWidth="4" />
      <circle cx="100" cy="100" r="25.5" fill="rgba(232,235,239,.82)" stroke="rgba(232,235,239,.82)" strokeWidth="16" />
      <circle cx="100" cy="100" r="17.6" fill="none" stroke="rgba(255,255,255,.95)" strokeWidth="1.4" />
      <circle cx="100" cy="100" r="22" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth=".6" />
      <circle cx="100" cy="100" r="27" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1.6" />
      <circle cx="100" cy="100" r="28.6" fill="none" stroke="rgba(0,0,0,.1)" strokeWidth=".6" />
      <circle cx="100" cy="100" r="33.3" fill="none" stroke="rgba(0,0,0,.16)" strokeWidth=".7" />
      <circle cx="100" cy="100" r="99.3" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.2" />
    </svg>
  )
}

// ---- component ----------------------------------------------------------------------
export default function DiscCascadeCarousel({
  items,
  height = '100svh',
  discSize = 'clamp(170px, min(50vmin, 38vw), 420px)',
  stageX = '50%',
  /** How many discs ahead of the chosen one stay visible (steps along the line). */
  ahead = 2.8,
  /** 'line' climbs sideways; 'column' stacks the discs vertically (drag and wheel follow the column). */
  layout = 'line',
  /** Put the title, credits and an always-open track list in a glass side panel. */
  panel = false,
  /** Which side the panel sits on: 'right' (default) or 'left', right next to the discs. */
  panelSide = 'right',
  /** Custom panel content: (item, index) => node. Replaces the default title, credits and track list. */
  renderPanel,
  /** Draw each item as a flat cover (item.src) with a record sliding out from behind it. */
  sleeve = false,
  /** Index of the item whose record is spinning right now (or null). */
  playingIndex = null,
  spacing = 1.02,
  rise = 0.24,
  depth = 0.42,
  yaw = 22,
  fan = -10,
  tilt = -6,
  /** Backward lean of every disc, degrees (0 keeps a flat sleeve square to the viewer). */
  pitch = 8,
  roll = 110,
  spin = 24,
  sheen = 0.6,
  bounce = 0.22,
  duration = 0.9,
  loop = false,
  autoplay = 0,
  brand = '',
  nav = [],
  navActive = 0,
  indexLabel = 'Index',
  details = true,
  reviews = true,
  controls = true,
  hint = 'Drag to browse',
  frame = true,
  color,
  background = 'color-mix(in oklab, var(--color-foreground, #000) 5%, var(--color-background, #fff))',
  serif = '"Instrument Serif", "Bodoni Moda", Didot, "Times New Roman", serif',
  sans = '"Inter", ui-sans-serif, system-ui, sans-serif',
  display = '"Oswald", "Bebas Neue", Impact, "Arial Narrow", sans-serif',
  index,
  defaultIndex = 2,
  onIndexChange,
  onSelect,
  ariaLabel = 'Catalogue',
  className = '',
}) {
  const n = items.length
  const vertical = layout === 'column'
  const start = Math.min(Math.max(Math.round(index ?? defaultIndex), 0), Math.max(n - 1, 0))
  const [active, setActive] = React.useState(start)
  const [dragging, setDragging] = React.useState(false)
  const [stopped, setStopped] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [visible, setVisible] = React.useState(true)
  const [menu, setMenu] = React.useState(false)

  const uid = 'dcc' + React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const rootRef = React.useRef(null)
  const stageRef = React.useRef(null)
  const menuRef = React.useRef(null)
  const slideRefs = React.useRef([])

  // Everything the frame loop reads, kept off React state so a frame costs no render.
  const E = React.useRef({
    a: start, va: 0, b: start, vb: 0, target: start,
    raf: 0, last: 0, size: 300, reduced: false,
    drag: null,
    clickBlock: false, wheel: 0, wheelAt: 0, stepAt: 0,
  }).current
  const cfg = React.useRef({ n, loop, spacing, rise, depth, yaw, fan, tilt, pitch, roll, bounce, duration, ahead })
  cfg.current = { n, loop, spacing, rise, depth, yaw, fan, tilt, pitch, roll, bounce, duration, ahead }
  const cb = React.useRef({ onIndexChange, active })
  cb.current = { onIndexChange, active }

  const styleFor = (i, a, b) => {
    const c = cfg.current
    const p = poseOf(offsetOf(i, a, c.n, c.loop), offsetOf(i, b, c.n, c.loop), c)
    return {
      transform:
        'translate3d(calc(' + p.x.toFixed(4) + ' * var(--dcc-s)), calc(' + p.y.toFixed(4) + ' * var(--dcc-s)), calc(' +
        p.z.toFixed(4) + ' * var(--dcc-s))) rotateZ(' + c.tilt + 'deg) rotateY(' + p.yaw.toFixed(3) + 'deg) rotateX(' + c.pitch + 'deg)',
      roll: p.roll.toFixed(2) + 'deg',
      glint: (p.yaw * 3 + p.x * 40).toFixed(1) + 'deg',
      zIndex: p.zIndex,
      opacity: p.opacity,
      hidden: p.hidden || p.opacity <= 0,
    }
  }

  const paint = () => {
    for (let i = 0; i < slideRefs.current.length; i++) {
      const el = slideRefs.current[i]
      if (!el) continue
      const t = styleFor(i, E.a, E.b)
      el.style.transform = t.transform
      el.style.zIndex = '' + t.zIndex
      el.style.opacity = t.opacity < 1 ? t.opacity.toFixed(3) : ''
      el.style.visibility = t.hidden ? 'hidden' : ''
      el.style.setProperty('--dcc-roll', t.roll)
      el.style.setProperty('--dcc-glint', t.glint)
    }
  }

  const frame_ = (now) => {
    const dt = Math.min((now - (E.last || now)) / 1000, 1 / 20)
    E.last = now
    const c = cfg.current
    const s = springOf(c.bounce, c.duration)
    if (E.reduced && !E.drag) {
      E.a = E.b = E.target
      E.va = E.vb = 0
    } else {
      // While dragging the line is under the finger and only the swing chases it.
      if (!E.drag) [E.a, E.va] = springStep(E.a, E.va, E.target, s.omega, s.slide, dt)
      ;[E.b, E.vb] = springStep(E.b, E.vb, E.a, s.omega * 1.05, s.tilt, dt)
    }
    paint()
    const settled =
      !E.drag && Math.abs(E.a - E.target) < 1e-3 && Math.abs(E.va) < 1e-2 && Math.abs(E.b - E.a) < 1e-3 && Math.abs(E.vb) < 1e-2
    if (settled) {
      E.a = E.b = E.target
      E.va = E.vb = 0
      paint()
      E.raf = 0
      E.last = 0
      return
    }
    E.raf = requestAnimationFrame(frame_)
  }

  const kick = () => {
    if (!E.raf) E.raf = requestAnimationFrame(frame_)
  }

  const setTarget = (t) => {
    const c = cfg.current
    if (!c.n) return
    E.target = c.loop ? t : Math.min(Math.max(t, 0), c.n - 1)
    const i = indexAt(E.target, c.n, c.loop)
    if (i !== cb.current.active) {
      setActive(i)
      cb.current.onIndexChange?.(i)
    }
    kick()
  }

  const unit = () => (vertical ? Math.abs(cfg.current.rise) : cfg.current.spacing)
  const goTo = (i) => setTarget(targetFor(i, E.target, cfg.current.n, cfg.current.loop))
  const step = (by) => setTarget(Math.round(E.target) + by)

  // controlled index
  React.useEffect(() => {
    if (index == null || !n) return
    if (wrapIndex(Math.round(E.target), n) !== wrapIndex(index, n)) goTo(wrapIndex(index, n))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, n])

  // a shorter list mustn't leave the position past its end
  React.useEffect(() => {
    if (n && !loop && E.target > n - 1) setTarget(n - 1)
    paint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, loop, spacing, rise, depth, yaw, fan, tilt, pitch, roll, ahead])

  // reduced motion
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => {
      E.reduced = mq.matches
    }
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [E])

  // the disc size in px, for turning drag distance into slides
  React.useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      E.size = el.offsetWidth || 300
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [E])

  React.useEffect(() => () => cancelAnimationFrame(E.raf), [E])

  // The wheel steps through, one disc per notch (either axis; trackpad swipes too).
  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e) => {
      if (e.target.closest && e.target.closest('.dcc-panel')) return
      e.preventDefault()
      e.stopPropagation()
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const now = performance.now()
      if (now - E.wheelAt > 160) E.wheel = 0
      E.wheelAt = now
      E.wheel += delta
      if (Math.abs(E.wheel) > 50 && now - E.stepAt > 320) {
        setStopped(true)
        step(Math.sign(E.wheel))
        E.wheel = 0
        E.stepAt = now
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [E])

  // the Index menu closes on an outside press or Escape
  React.useEffect(() => {
    if (!menu) return
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menu])

  // autoplay pauses off-screen and in a hidden tab
  React.useEffect(() => {
    const el = rootRef.current
    if (!el || !autoplay) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && !document.hidden))
    io.observe(el)
    const onVis = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [autoplay])

  const playing = autoplay > 0 && n > 1 && !stopped && !focused && !dragging && !menu && visible
  React.useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => {
      const c = cfg.current
      if (!c.loop && Math.round(E.target) >= c.n - 1) goTo(0)
      else step(1)
    }, autoplay)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, active, autoplay])

  // ---- pointer ------------------------------------------------------------------------
  const onPointerDown = (e) => {
    if (e.button !== 0 || !n) return
    if (e.target.closest('[data-dcc-ui]')) return
    const pt = vertical ? e.clientY : e.clientX
    E.drag = { id: e.pointerId, x0: pt, pos0: E.a, moved: false, samples: [{ t: e.timeStamp, x: pt }] }
  }
  const onPointerMove = (e) => {
    // The glint and the chosen disc's lean follow a mouse, never a finger.
    if (e.pointerType === 'mouse' && !E.drag?.moved) {
      const st = stageRef.current?.getBoundingClientRect()
      const root = rootRef.current
      if (st && root) {
        const cx = Math.max(-1, Math.min(1, (e.clientX - (st.left + st.width / 2)) / st.width))
        const cy = Math.max(-1, Math.min(1, (e.clientY - (st.top + st.height / 2)) / st.height))
        root.style.setProperty('--dcc-px', cx.toFixed(3))
        root.style.setProperty('--dcc-py', cy.toFixed(3))
      }
    }
    const d = E.drag
    if (!d || d.id !== e.pointerId) return
    const pt = vertical ? e.clientY : e.clientX
    const dx = pt - d.x0
    if (!d.moved) {
      if (Math.abs(dx) < 6) return
      d.moved = true
      d.x0 = pt
      d.pos0 = E.a
      E.va = 0
      rootRef.current?.setPointerCapture(e.pointerId)
      setDragging(true)
      setStopped(true)
    }
    const c = cfg.current
    const raw = d.pos0 - (pt - d.x0) / (E.size * unit())
    E.a = c.loop ? raw : rubber(raw, c.n)
    d.samples.push({ t: e.timeStamp, x: pt })
    if (d.samples.length > 6) d.samples.shift()
    const i = indexAt(E.a, c.n, c.loop)
    if (i !== cb.current.active) {
      setActive(i)
      cb.current.onIndexChange?.(i)
    }
    kick()
  }
  const onPointerUp = (e) => {
    const d = E.drag
    if (!d || d.id !== e.pointerId) return
    E.drag = null
    if (!d.moved) return
    setDragging(false)
    E.clickBlock = true
    window.setTimeout(() => {
      E.clickBlock = false
    }, 0)
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const ms = Math.max(last.t - first.t, 1)
    // px per ms → slides per second, against the drag direction
    const v = e.type === 'pointercancel' ? 0 : (-(last.x - first.x) / ms / (E.size * unit())) * 1000
    E.va = v
    setTarget(releaseTarget(E.a, v, cfg.current.n, cfg.current.loop))
  }
  const onPointerLeave = () => {
    rootRef.current?.style.setProperty('--dcc-px', '0')
    rootRef.current?.style.setProperty('--dcc-py', '0')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && menu) {
      setMenu(false)
      return
    }
    if (e.target.closest('[data-dcc-menu], .dcc-panel')) return
    let handled = true
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1)
    else if (e.key === 'Home') goTo(0)
    else if (e.key === 'End') goTo(n - 1)
    else handled = false
    if (handled) {
      e.preventDefault()
      setStopped(true)
    }
  }

  const onSlideClick = (i) => {
    if (E.clickBlock) return
    setStopped(true)
    if (i === active) onSelect?.(items[i], i)
    else goTo(i)
  }

  const atStart = !loop && active <= 0
  const atEnd = !loop && active >= n - 1
  const current = items[active]
  const quotes = (current?.reviews ?? []).slice(0, 2)
  const year = current?.credits?.find((c) => /year|год/i.test(c.label))

  const headBlock =
    details && current ? (
      <div className="dcc-head" key={'h' + active} aria-hidden="true">
        <h2 className="dcc-title dcc-in" style={{ fontFamily: serif }}>
          {current.title}
        </h2>
        {current.credits?.length ? (
          <dl className="dcc-dl">
            {current.credits.map((c, k) => (
              <div className="dcc-row dcc-in" key={k} style={{ '--i': k + 1 }}>
                <dt>{c.label}</dt>
                <dd>
                  {lines(c.value).map((v, j) => (
                    <span key={j}>{v}</span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    ) : null

  return (
    <div
      ref={rootRef}
      className={'dcc-root ' + className}
      style={{
        height,
        background,
        color,
        fontFamily: sans,
        '--dcc-s': discSize,
        '--dcc-x': stageX,
        '--dcc-sheen': '' + sheen,
        '--dcc-spin': spin + 's',
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      data-dragging={dragging ? '' : undefined}
      data-spin={spin > 0 ? '' : undefined}
      data-column={vertical ? '' : undefined}
      data-panel-left={panel && panelSide === 'left' ? '' : undefined}
      data-sleeve={sleeve ? '' : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
      }}
    >
      <style>{CSS}</style>
      {frame ? <div className="dcc-frame" aria-hidden="true" /> : null}

      {brand || nav.length || (indexLabel && n > 1) ? (
        <nav className="dcc-nav" data-dcc-ui="" aria-label="Catalogue">
          {brand ? <span className="dcc-brand">{brand}</span> : null}
          {nav.map((l, k) =>
            l.href ? (
              <a key={k} className="dcc-link" href={l.href} aria-current={k === navActive ? 'page' : undefined}>
                {l.label}
              </a>
            ) : (
              <span key={k} className="dcc-link" aria-current={k === navActive ? 'true' : undefined}>
                {l.label}
              </span>
            ),
          )}
          {indexLabel && n > 1 ? (
            <div className="dcc-menu" ref={menuRef} data-dcc-menu="">
              <button
                type="button"
                className="dcc-menubtn"
                aria-haspopup="true"
                aria-expanded={menu}
                aria-controls={uid + 'list'}
                onClick={() => setMenu((m) => !m)}
              >
                {indexLabel} <Caret />
              </button>
              {menu ? (
                <ul className="dcc-list" id={uid + 'list'} style={{ fontFamily: sans }}>
                  {items.map((it, k) => {
                    const y = it.credits?.find((c) => /year|год/i.test(c.label))
                    return (
                      <li key={k}>
                        <button
                          type="button"
                          className="dcc-opt"
                          aria-current={k === active ? 'true' : undefined}
                          onClick={() => {
                            setStopped(true)
                            setMenu(false)
                            goTo(k)
                          }}
                        >
                          <span className="dcc-optn">{pad(k + 1)}</span>
                          <span className="dcc-optt">{it.title}</span>
                          {y ? <span className="dcc-opty">{lines(y.value)[0]}</span> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </nav>
      ) : null}

      {panel ? null : headBlock}

      <div ref={stageRef} className="dcc-stage">
        {items.map((item, i) => {
          const t = styleFor(i, E.a, E.b)
          const isActive = i === active
          const pal = item.palette ?? PALETTES[i % PALETTES.length]
          const ink = item.ink ?? (item.src ? '#ffffff' : inkFor(pal[0]))
          const id = uid + 'd' + i
          return (
            <button
              key={i}
              ref={(el) => {
                slideRefs.current[i] = el
              }}
              type="button"
              className="dcc-slide"
              data-active={isActive ? '' : undefined}
              tabIndex={isActive ? 0 : -1}
              aria-roledescription="slide"
              aria-label={i + 1 + ' / ' + n + ': ' + item.title}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSlideClick(i)}
              style={{
                transform: t.transform,
                zIndex: t.zIndex,
                opacity: t.opacity < 1 ? t.opacity : undefined,
                visibility: t.hidden ? 'hidden' : undefined,
                '--dcc-roll': t.roll,
                '--dcc-glint': t.glint,
              }}
            >
              {sleeve ? (
                <span className="dcc-tilt">
                  <span className="dcc-shade" />
                  <span className="dcc-vinyl" data-playing={playingIndex === i ? '' : undefined}>
                    <span className="dcc-vinyl__spin">
                      <span className="dcc-vinyl__label">
                        <img src={item.src} alt="" draggable={false} />
                      </span>
                    </span>
                  </span>
                  <span className="dcc-sleeve">
                    <img src={item.src} alt={item.alt ?? item.title} draggable={false} decoding="async" />
                  </span>
                </span>
              ) : (
              <span className="dcc-tilt">
                <span className="dcc-shade" />
                <span className="dcc-edge" />
                <span className="dcc-disc">
                  <span className="dcc-roll">
                    <span className="dcc-idle" style={{ fontFamily: display }}>
                      {item.src ? (
                        <img
                          src={item.src}
                          alt={item.alt ?? item.title}
                          draggable={false}
                          loading={Math.abs(i - start) > 3 ? 'lazy' : undefined}
                          decoding="async"
                          width={600}
                          height={600}
                          style={{ maxWidth: 'none' }}
                        />
                      ) : (
                        <svg viewBox="0 0 200 200" role="img" aria-label={item.alt ?? item.title} style={{ maxWidth: 'none' }}>
                          <Art pattern={item.pattern ?? PATTERNS[i % PATTERNS.length]} pal={pal} seed={i + 1} uid={id} />
                        </svg>
                      )}
                      <Print item={item} i={i} uid={id} mark={brand} ink={ink} halo={item.src ? 'rgba(0,0,0,.45)' : pal[0]} />
                    </span>
                  </span>
                  <Hub uid={id} />
                  <span className="dcc-sheen" />
                </span>
              </span>
              )}
            </button>
          )
        })}
      </div>

      {panel ? (
        <aside className="dcc-panel" data-dcc-ui="" aria-label="Композиции">
          {renderPanel ? (
            renderPanel(current, active)
          ) : (
            <>
          {headBlock}
          <ol className="dcc-tracks">
            {items.map((it, k) => {
              const y = it.credits?.find((c) => /year|год/i.test(c.label))
              const len = it.credits?.find((c) => /length|длит/i.test(c.label))
              return (
                <li key={k}>
                  <button
                    type="button"
                    className="dcc-track"
                    aria-current={k === active ? 'true' : undefined}
                    onClick={() => {
                      setStopped(true)
                      goTo(k)
                    }}
                  >
                    <span className="dcc-optn">{pad(k + 1)}</span>
                    <span className="dcc-optt">{it.title}</span>
                    <span className="dcc-opty">{len ? lines(len.value)[0] : y ? lines(y.value)[0] : ''}</span>
                  </button>
                </li>
              )
            })}
          </ol>
            </>
          )}
        </aside>
      ) : null}

      {reviews && quotes.length ? (
        <div className="dcc-revs" key={'r' + active} aria-hidden="true">
          {quotes.map((q, k) => {
            const stars = Math.max(0, Math.min(5, Math.round(q.stars ?? 5)))
            return (
              <figure className="dcc-rev dcc-in" key={k} style={{ margin: 0, '--i': k + 3 }}>
                <div className="dcc-stars">{'★'.repeat(stars) + '☆'.repeat(5 - stars)}</div>
                <figcaption className="dcc-src">{q.source}</figcaption>
                <blockquote className="dcc-quote" style={{ fontFamily: serif }}>
                  {'“' + q.quote + '”'}
                </blockquote>
              </figure>
            )
          })}
        </div>
      ) : null}

      {hint ? <div className="dcc-hint" aria-hidden="true">{hint}</div> : null}

      {controls && n > 1 ? (
        <div className="dcc-ctl" data-dcc-ui="">
          <button type="button" className="dcc-btn" aria-label="Назад" disabled={atStart} onClick={() => { setStopped(true); step(-1) }}>
            <Arrow dir={-1} />
          </button>
          <span className="dcc-count" aria-hidden="true">
            <b>{pad(active + 1)}</b> / {pad(n)}
          </span>
          <button type="button" className="dcc-btn" aria-label="Вперёд" disabled={atEnd} onClick={() => { setStopped(true); step(1) }}>
            <Arrow dir={1} />
          </button>
        </div>
      ) : null}

      <div className="dcc-sr" aria-live="polite" aria-atomic="true">
        {current ? (active + 1) + ' / ' + n + ': ' + current.title + (year ? ', ' + lines(year.value)[0] : '') : ''}
      </div>
    </div>
  )
}
