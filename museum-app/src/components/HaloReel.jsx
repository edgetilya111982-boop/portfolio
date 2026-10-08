import React, { useState, useEffect, useRef } from 'react'
import {
  animate,
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

// overdamped springs: no wobble, just a long soft landing
const SPRING = { type: 'spring', stiffness: 85, damping: 22, mass: 0.9 }
const SPRING_SNAP = { type: 'spring', stiffness: 110, damping: 24, mass: 0.9 }

/*
 * Cards ride a circle whose centre sits near the left edge; only the right half
 * (cos θ > 0) is shown, which gives a clean semicircle with the front card at its apex.
 *   x = R·cos θ   y = R·sin θ   θ = i·step + rotation
 * One `rotation` motion value drives every card, so spinning never re-renders React.
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
  stepDuration = 1000,
  pauseOnHover = true,
  spread = 1.1,
  maxCards = 64,
  wheelSensitivity = 0.0035,
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
  const wheelRef = useRef({ start: 0, target: 0, last: -1e9, timer: 0, controls: null })

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [front, setFront] = useState(0)

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

  const quiet = () =>
    !draggingRef.current &&
    performance.now() - wheelRef.current.last > 2500 &&
    !(pauseOnHover && hoverRef.current)

  /* ── autoplay ── */
  useEffect(() => {
    if (!autoPlay || reduceMotion || !count || !step) return
    let timer = 0
    let controls
    const tick = () => {
      timer = window.setTimeout(() => {
        if (!quiet()) {
          tick()
          return
        }
        controls = animate(rotation, rotation.get() - step, {
          duration: stepDuration / 1000,
          ease: [0.45, 0, 0.2, 1],
          onComplete: tick,
        })
      }, holdDuration)
    }
    tick()
    return () => {
      window.clearTimeout(timer)
      controls?.stop()
    }
  }, [autoPlay, count, holdDuration, pauseOnHover, reduceMotion, rotation, step, stepDuration])

  /* ── mouse wheel: soft spring toward a moving target, then settle on a card ── */
  useEffect(() => {
    const node = stageRef.current
    if (!node || !step) return
    const w = wheelRef.current

    const onWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const now = performance.now()
      if (now - w.last > 350) {
        w.start = rotation.get()
        w.target = w.start
      }
      w.last = now

      const delta = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY
      w.target -= clamp(delta, -240, 240) * step * wheelSensitivity

      w.controls?.stop()
      if (reduceMotion) rotation.set(w.target)
      else w.controls = animate(rotation, w.target, SPRING)

      window.clearTimeout(w.timer)
      w.timer = window.setTimeout(() => {
        // a nudge always moves at least to the neighbouring card
        const n = w.target / step
        const dir = Math.sign(w.target - w.start)
        const snapped = (dir < 0 ? Math.floor(n + 0.1) : dir > 0 ? Math.ceil(n - 0.1) : Math.round(n)) * step
        w.target = snapped
        w.controls?.stop()
        if (reduceMotion) rotation.set(snapped)
        else w.controls = animate(rotation, snapped, SPRING_SNAP)
      }, 150)
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      node.removeEventListener('wheel', onWheel)
      window.clearTimeout(w.timer)
      w.controls?.stop()
    }
  }, [rotation, step, reduceMotion, wheelSensitivity])

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
    wheelRef.current.controls?.stop()
    rotation.stop()
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    const angle = pointerAngle(e)
    const delta = ((angle - dragRef.current.angle + Math.PI * 3) % TAU) - Math.PI
    dragRef.current.angle = angle

    const wasClick = movedRef.current < 6
    movedRef.current += Math.abs(delta) * 200
    // capture only once it is a real drag, otherwise clicks never reach the cards
    if (wasClick && movedRef.current >= 6) e.currentTarget.setPointerCapture?.(e.pointerId)

    rotation.set(rotation.get() + delta)
  }

  const endDrag = (e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (movedRef.current < 6) return
    const snapped = Math.round(rotation.get() / step) * step
    if (reduceMotion) rotation.set(snapped)
    else animate(rotation, snapped, SPRING_SNAP)
  }

  const spinTo = (target) => {
    wheelRef.current.controls?.stop()
    if (reduceMotion) rotation.set(target)
    else animate(rotation, target, SPRING_SNAP)
  }

  const onKeyDown = (e) => {
    const direction = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    if (!direction) return
    e.preventDefault()
    spinTo(Math.round(rotation.get() / step) * step - direction * step)
  }

  const onCardClick = (slot) => {
    if (movedRef.current >= 6) return
    if (slot === front) {
      onOpen?.(items[slot % count])
      return
    }
    // bring the clicked card to the front along the shortest way round
    const base = -slot * step
    const turns = Math.round((rotation.get() - base) / TAU)
    spinTo(base + turns * TAU)
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
  item, index, isFront, decorative, step, rotation, radius,
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
      {isFront && item.video && (
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
