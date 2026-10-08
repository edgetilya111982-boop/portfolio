import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import './HaloReel.css'

const TAU = Math.PI * 2
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const mod = (n, m) => ((n % m) + m) % m

// wheel pixels that advance the reel by one card (one mouse notch is ~100px)
const WHEEL_PX = 80

/*
 * Cards ride a circle whose centre sits near the left edge; only the right half
 * (cos θ > 0) is shown, which gives a clean semicircle with the front card at its apex.
 *   x = R·cos θ   y = R·sin θ   θ = i·step + rotation
 *
 * All motion goes through one critically damped follower: callers only move `target`,
 * and `rotation` glides after it with smooth acceleration and no overshoot. Because the
 * velocity is carried across target changes, rapid wheel notches blend into one motion.
 */
export default function HaloReel({
  items,
  cardWidth = 300,
  cardHeight = 169,
  minScale = 0.4,
  radiusRatio = 0.4,
  centerXRatio = 0.16,
  fan = 0.22,
  autoPlay = true,
  holdDuration = 3200,
  smoothTime = 0.34,
  pauseOnHover = true,
  spread = 1.1,
  maxCards = 64,
  accent = '#38d9ff',
  onOpen,
}) {
  const stageRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const count = items.length

  const rotation = useMotionValue(0)
  const draggingRef = useRef(false)
  const hoverRef = useRef(false)
  const movedRef = useRef(0)
  const dragRef = useRef({ left: 0, top: 0, angle: 0 })
  const lastInputRef = useRef(-1e9)
  const motionRef = useRef({ target: 0, vel: 0, raf: 0, last: 0 })

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [front, setFront] = useState(0)
  const [settled, setSettled] = useState(true)

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const measure = () => setSize({ w: node.offsetWidth, h: node.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const radius = size.h * radiusRatio

  // even number of slots keeps the repeated items alternating cleanly all the way round
  let slots = clamp(
    Math.ceil((TAU * radius) / (cardHeight * spread)),
    count,
    Math.max(count, maxCards)
  )
  if (slots % 2 && slots < maxCards) slots += 1
  const step = slots ? TAU / slots : 0

  const fit = size.w
    ? clamp(
        Math.min(
          size.h / (2 * radius + cardHeight),
          size.w / (size.w * centerXRatio + radius + cardWidth)
        ),
        0.45,
        1
      )
    : 1
  const cardW = cardWidth * fit
  const cardH = cardHeight * fit

  useMotionValueEvent(rotation, 'change', (r) => {
    if (!step) return
    const next = mod(Math.round(-r / step), slots)
    setFront((prev) => (prev === next ? prev : next))
  })

  /* ── the follower: critically damped smoothing toward `target` ── */
  const tick = useCallback(
    (now) => {
      const m = motionRef.current
      const dt = Math.min((now - m.last) / 1000, 0.05)
      m.last = now

      const omega = 2 / smoothTime
      const x = omega * dt
      const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
      const change = rotation.get() - m.target
      const temp = (m.vel + omega * change) * dt
      m.vel = (m.vel - omega * temp) * decay
      const next = m.target + (change + temp) * decay

      if (Math.abs(m.target - next) < 1e-4 && Math.abs(m.vel) < 1e-3) {
        rotation.set(m.target)
        m.vel = 0
        m.raf = 0
        setSettled(true)
        return
      }
      rotation.set(next)
      m.raf = requestAnimationFrame(tick)
    },
    [rotation, smoothTime]
  )

  const setTarget = useCallback(
    (target) => {
      const m = motionRef.current
      m.target = target
      setSettled(false)
      if (!m.raf) {
        m.last = performance.now()
        m.raf = requestAnimationFrame(tick)
      }
    },
    [rotation, tick]
  )

  const halt = () => {
    const m = motionRef.current
    cancelAnimationFrame(m.raf)
    m.raf = 0
    m.vel = 0
  }

  useEffect(() => () => cancelAnimationFrame(motionRef.current.raf), [])

  const quiet = () =>
    !draggingRef.current &&
    performance.now() - lastInputRef.current > 2500 &&
    !(pauseOnHover && hoverRef.current)

  /* ── autoplay ── */
  useEffect(() => {
    if (!autoPlay || reduceMotion || !count || !step) return
    const id = window.setInterval(() => {
      if (!quiet()) return
      const m = motionRef.current
      setTarget(Math.round(m.target / step) * step - step)
    }, holdDuration)
    return () => window.clearInterval(id)
  }, [autoPlay, count, holdDuration, pauseOnHover, reduceMotion, step, setTarget])

  /* ── mouse wheel: each ~80px moves one card; the follower blends rapid notches ── */
  useEffect(() => {
    const node = stageRef.current
    if (!node || !step) return
    const w = { acc: 0, last: 0 }

    const onWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const now = performance.now()
      lastInputRef.current = now
      if (now - w.last > 250) w.acc = 0
      w.last = now

      const delta = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY
      w.acc += clamp(delta, -300, 300)
      const cards = Math.trunc(w.acc / WHEEL_PX)
      if (!cards) return
      w.acc -= cards * WHEEL_PX

      const m = motionRef.current
      const base = Math.round(m.target / step) * step
      // never run more than a few cards ahead of what is on screen
      const next = clamp(base - cards * step, rotation.get() - 4 * step, rotation.get() + 4 * step)
      setTarget(Math.round(next / step) * step)
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [rotation, step, setTarget])

  /* ── drag ── */
  const pointerAngle = (e) => {
    const { left, top } = dragRef.current
    return Math.atan2(
      e.clientY - top - size.h / 2,
      e.clientX - left - size.w * centerXRatio
    )
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = { left: rect.left, top: rect.top, angle: 0 }
    dragRef.current.angle = pointerAngle(e)
    draggingRef.current = true
    movedRef.current = 0
    lastInputRef.current = performance.now()
    halt()
    motionRef.current.target = rotation.get()
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    const angle = pointerAngle(e)
    const delta = ((angle - dragRef.current.angle + Math.PI * 3) % TAU) - Math.PI
    dragRef.current.angle = angle

    const wasClick = movedRef.current < 6
    movedRef.current += Math.abs(delta) * 200
    // capture only once it is a real drag, otherwise clicks never reach the cards
    if (wasClick && movedRef.current >= 6) {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setSettled(false)
    }

    const next = rotation.get() + delta
    rotation.set(next)
    motionRef.current.target = next
  }

  const endDrag = (e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    lastInputRef.current = performance.now()
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (movedRef.current < 6) return
    setTarget(Math.round(rotation.get() / step) * step)
  }

  const onKeyDown = (e) => {
    const direction = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    if (!direction) return
    e.preventDefault()
    lastInputRef.current = performance.now()
    setTarget(Math.round(motionRef.current.target / step) * step - direction * step)
  }

  const onCardClick = (slot) => {
    if (movedRef.current >= 6) return
    if (slot === front) {
      onOpen?.(items[slot % count])
      return
    }
    // bring the clicked card to the front along the shortest way round
    lastInputRef.current = performance.now()
    const base = -slot * step
    const turns = Math.round((rotation.get() - base) / TAU)
    setTarget(base + turns * TAU)
  }

  if (!count) return null

  return (
    <div
      ref={stageRef}
      className="halo-reel"
      style={{ '--accent': accent }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Работы"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {Array.from({ length: slots }, (_, i) => (
        <ReelCard
          key={i}
          item={items[i % count]}
          index={i}
          isFront={i === front}
          playVideo={i === front && settled}
          decorative={i >= count}
          step={step}
          rotation={rotation}
          radius={radius}
          centerXRatio={centerXRatio}
          minScale={minScale}
          fan={fan}
          width={cardW}
          height={cardH}
          onHoverChange={(h) => { hoverRef.current = h }}
          onClick={() => onCardClick(i)}
        />
      ))}
    </div>
  )
}

function ReelCard({
  item, index, isFront, playVideo, decorative, step, rotation, radius,
  centerXRatio, minScale, fan, width, height, onHoverChange, onClick,
}) {
  const angle = useTransform(rotation, (r) => index * step + r)
  const cos = useTransform(angle, Math.cos)
  const sin = useTransform(angle, Math.sin)

  const x = useTransform(cos, (c) => c * radius)
  const y = useTransform(sin, (s) => s * radius)
  const scale = useTransform(cos, (c) => minScale + (1 - minScale) * Math.pow(Math.max(c, 0), 1.3))
  const zIndex = useTransform(cos, (c) => Math.round((c + 1) * 500))
  // the back half of the circle fades out, leaving a clean semicircle
  const opacity = useTransform(cos, (c) => clamp((c + 0.05) * 2.6, 0, 1))
  const pointerEvents = useTransform(cos, (c) => (c < 0.12 ? 'none' : 'auto'))
  // cards fan out slightly along the arc
  const rotate = useTransform(angle, (a) => Math.atan2(Math.sin(a), Math.cos(a)) * (180 / Math.PI) * fan)

  return (
    <motion.div
      className={`halo-card${isFront ? ' halo-card--front' : ''}`}
      aria-hidden={decorative || undefined}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      onClick={onClick}
      style={{
        x, y, scale, rotate, zIndex, opacity, pointerEvents, width, height,
        left: `${centerXRatio * 100}%`,
        top: '50%',
        marginLeft: -width / 2,
        marginTop: -height / 2,
      }}
    >
      <img className="halo-card__img" src={item.poster} alt={decorative ? '' : item.title} draggable={false} />
      {playVideo && item.video && (
        <video className="halo-card__video" src={item.video} autoPlay muted loop playsInline />
      )}
      <div className="halo-card__info">
        <div>
          <h3 className="halo-card__title">{item.title}</h3>
          <span className="halo-card__tools">{item.tools}</span>
        </div>
        <span className="halo-card__play">▷</span>
      </div>
    </motion.div>
  )
}
