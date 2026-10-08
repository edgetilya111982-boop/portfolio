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

/*
 * Cards ride an ellipse. Card i sits at θ = i·step + rotation:
 *   x = rx·cos θ   y = ry·sin θ   scale = min + (1−min)·(cos θ + 1)/2
 * One `rotation` motion value drives every card, so spinning never re-renders React.
 */
export default function HaloReel({
  items,
  cardWidth = 300,
  cardHeight = 169,
  minScale = 0.45,
  radiusXRatio = 0.4,
  centerXRatio = 0,
  radiusYRatio = 0.34,
  autoPlay = true,
  holdDuration = 3000,
  stepDuration = 800,
  pauseOnHover = true,
  spread = 1.7,
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

  const radiusX = size.w * radiusXRatio
  const radiusY = size.h * radiusYRatio

  const slots = clamp(
    Math.ceil(
      TAU * Math.max(radiusX / (cardWidth * spread), radiusY / (cardHeight * spread))
    ),
    count,
    Math.max(count, maxCards)
  )
  const step = slots ? TAU / slots : 0

  const fit = size.w
    ? clamp(
        Math.min(size.w / (radiusX + cardWidth), size.h / (2 * radiusY + cardHeight)),
        0.45,
        1
      )
    : 1
  const cardW = cardWidth * fit
  const cardH = cardHeight * fit

  // which slot currently faces the viewer
  useMotionValueEvent(rotation, 'change', (r) => {
    if (!step) return
    const next = mod(Math.round(-r / step), slots)
    setFront((prev) => (prev === next ? prev : next))
  })

  useEffect(() => {
    if (!autoPlay || reduceMotion || !count || !step) return
    let timer = 0
    let controls
    const tick = () => {
      timer = window.setTimeout(() => {
        if (draggingRef.current || (pauseOnHover && hoverRef.current)) {
          tick()
          return
        }
        controls = animate(rotation, rotation.get() - step, {
          duration: stepDuration / 1000,
          ease: [0.4, 0, 0.2, 1],
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

  /* ── drag ── */
  const pointerAngle = (e) => {
    const { left, top } = dragRef.current
    return Math.atan2(
      (e.clientY - top - size.h / 2) / (radiusY || 1),
      (e.clientX - left - size.w * centerXRatio) / (radiusX || 1)
    )
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = { left: rect.left, top: rect.top, angle: 0 }
    dragRef.current.angle = pointerAngle(e)
    draggingRef.current = true
    movedRef.current = 0
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
    if (reduceMotion) {
      rotation.set(snapped)
      return
    }
    animate(rotation, snapped, { duration: 0.5, ease: [0.16, 1, 0.3, 1] })
  }

  const spinBy = (direction) => {
    const target = Math.round(rotation.get() / step) * step - direction * step
    if (reduceMotion) rotation.set(target)
    else animate(rotation, target, { duration: stepDuration / 1000, ease: [0.4, 0, 0.2, 1] })
  }

  // bring a given slot to the front along the shortest way round
  const spinTo = (slot) => {
    const current = rotation.get()
    const base = -slot * step
    const turns = Math.round((current - base) / TAU)
    const target = base + turns * TAU
    if (reduceMotion) rotation.set(target)
    else animate(rotation, target, { duration: stepDuration / 1000, ease: [0.4, 0, 0.2, 1] })
  }

  const onKeyDown = (e) => {
    const direction = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!direction) return
    e.preventDefault()
    spinBy(direction)
  }

  const onCardClick = (slot) => {
    if (movedRef.current >= 6) return
    if (slot === front) onOpen?.(items[slot % count])
    else spinTo(slot)
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
          radiusX={radiusX}
          radiusY={radiusY}
          centerXRatio={centerXRatio}
          minScale={minScale}
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
  item, index, isFront, decorative, step, rotation, radiusX, radiusY,
  centerXRatio, minScale, width, height, onHoverChange, onClick,
}) {
  const cos = useTransform(rotation, (r) => Math.cos(index * step + r))
  const sin = useTransform(rotation, (r) => Math.sin(index * step + r))

  const x = useTransform(cos, (c) => c * radiusX)
  const y = useTransform(sin, (s) => s * radiusY)
  const scale = useTransform(cos, (c) => minScale + (1 - minScale) * ((c + 1) / 2))
  const zIndex = useTransform(scale, (s) => Math.round(s * 1000))
  const opacity = useTransform(cos, (c) => 0.35 + 0.65 * ((c + 1) / 2))

  return (
    <motion.div
      className={`halo-card${isFront ? ' halo-card--front' : ''}`}
      aria-hidden={decorative || undefined}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      onClick={onClick}
      style={{
        x, y, scale, zIndex, opacity, width, height,
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
