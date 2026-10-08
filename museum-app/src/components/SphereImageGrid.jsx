import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import './SphereImageGrid.css'

const DEG = Math.PI / 180

const normalizeAngle = (a) => {
  while (a > 180) a -= 360
  while (a < -180) a += 360
  return a
}

// Fibonacci sphere distribution with a small deterministic jitter
function generatePositions(count, radius) {
  const golden = (1 + Math.sqrt(5)) / 2
  const step = (2 * Math.PI) / golden
  const jitter = (i, k) => {
    const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
    return s - Math.floor(s) - 0.5
  }

  return Array.from({ length: count }, (_, i) => {
    let phi = Math.acos(1 - (2 * i) / count) / DEG
    let theta = ((step * i) / DEG) % 360

    const poleBonus = Math.pow(Math.abs(phi - 90) / 90, 0.6) * 35
    phi = phi < 90 ? Math.max(5, phi - poleBonus) : Math.min(175, phi + poleBonus)
    phi = 15 + (phi / 180) * 150

    theta = (theta + jitter(i, 1) * 20) % 360
    phi = Math.max(0, Math.min(180, phi + jitter(i, 2) * 10))

    return { theta, phi, radius }
  })
}

export default function SphereImageGrid({
  images = [],
  containerSize = 600,
  sphereRadius = 200,
  dragSensitivity = 0.6,
  momentumDecay = 0.96,
  maxRotationSpeed = 6,
  baseImageScale = 0.2,
  perspective = 1000,
  autoRotate = true,
  autoRotateSpeed = 0.2,
  accent = '#c084fc',
}) {
  const [rotation, setRotation] = useState({ x: 15, y: 15 })
  const [selected, setSelected] = useState(null)

  const velocity = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragMoved = useRef(0)
  const lastPos = useRef({ x: 0, y: 0 })

  const baseSize = containerSize * baseImageScale
  const clampSpeed = useCallback(
    (v) => Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, v)),
    [maxRotationSpeed]
  )

  const positions = useMemo(
    () => generatePositions(images.length, sphereRadius),
    [images.length, sphereRadius]
  )

  // momentum + auto-rotation loop
  useEffect(() => {
    let raf
    const tick = () => {
      if (!dragging.current) {
        const v = velocity.current
        v.x *= momentumDecay
        v.y *= momentumDecay
        if (Math.abs(v.x) < 0.01) v.x = 0
        if (Math.abs(v.y) < 0.01) v.y = 0

        if (autoRotate || v.x !== 0 || v.y !== 0) {
          setRotation((prev) => ({
            x: normalizeAngle(prev.x + clampSpeed(v.x)),
            y: normalizeAngle(prev.y + clampSpeed(v.y) + (autoRotate ? autoRotateSpeed : 0)),
          }))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [momentumDecay, autoRotate, autoRotateSpeed, clampSpeed])

  // close modal on Escape
  useEffect(() => {
    if (!selected) return
    const onKey = (e) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const onPointerDown = (e) => {
    dragging.current = true
    dragMoved.current = 0
    velocity.current = { x: 0, y: 0 }
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    const wasClick = dragMoved.current < 6
    dragMoved.current += Math.abs(dx) + Math.abs(dy)
    // capture only once it is a real drag, otherwise the click never reaches the image
    if (wasClick && dragMoved.current >= 6) e.currentTarget.setPointerCapture?.(e.pointerId)

    const dRotX = clampSpeed(-dy * dragSensitivity)
    const dRotY = clampSpeed(dx * dragSensitivity)

    setRotation((prev) => ({
      x: normalizeAngle(prev.x + dRotX),
      y: normalizeAngle(prev.y + dRotY),
    }))
    velocity.current = { x: dRotX, y: dRotY }
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = () => {
    dragging.current = false
  }

  const world = useMemo(() => {
    const rotX = rotation.x * DEG
    const rotY = rotation.y * DEG

    const items = positions.map((pos, index) => {
      const t = pos.theta * DEG
      const p = pos.phi * DEG

      let x = pos.radius * Math.sin(p) * Math.cos(t)
      let y = pos.radius * Math.cos(p)
      let z = pos.radius * Math.sin(p) * Math.sin(t)

      const x1 = x * Math.cos(rotY) + z * Math.sin(rotY)
      const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY)
      x = x1
      z = z1

      const y2 = y * Math.cos(rotX) - z * Math.sin(rotX)
      const z2 = y * Math.sin(rotX) + z * Math.cos(rotX)
      y = y2
      z = z2

      const fadeStart = -10
      const fadeEnd = -30
      const isVisible = z > fadeEnd
      const fadeOpacity = z <= fadeStart ? Math.max(0, (z - fadeEnd) / (fadeStart - fadeEnd)) : 1

      const isPole = pos.phi < 30 || pos.phi > 150
      const distRatio = Math.min(Math.hypot(x, y) / pos.radius, 1)
      const centerScale = Math.max(0.3, 1 - distRatio * (isPole ? 0.4 : 0.7))
      const depthScale = (z + pos.radius) / (2 * pos.radius)
      const scale = centerScale * Math.max(0.5, 0.8 + depthScale * 0.3)

      return { x, y, z, scale, isVisible, fadeOpacity, zIndex: Math.round(1000 + z), index }
    })

    // shrink overlapping neighbours
    for (let i = 0; i < items.length; i++) {
      const a = items[i]
      if (!a.isVisible) continue
      let s = a.scale
      const sizeA = baseSize * s
      for (let j = 0; j < items.length; j++) {
        if (i === j || !items[j].isVisible) continue
        const b = items[j]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const minDist = (sizeA + baseSize * b.scale) / 2 + 25
        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist
          s = Math.min(s, s * Math.max(0.4, 1 - (overlap / minDist) * 0.6))
        }
      }
      a.scale = Math.max(0.25, s)
    }
    return items
  }, [positions, rotation, baseSize])

  if (!images.length) return null

  return (
    <>
      <div
        className="sphere-grid"
        style={{ width: containerSize, height: containerSize, perspective: `${perspective}px`, '--accent': accent }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {world.map((w) => {
          if (!w.isVisible) return null
          const image = images[w.index]
          const size = baseSize * w.scale
          return (
            <div
              key={image.id}
              className="sphere-item"
              style={{
                width: size,
                height: size,
                left: containerSize / 2 + w.x,
                top: containerSize / 2 + w.y,
                opacity: w.fadeOpacity,
                zIndex: w.zIndex,
              }}
              onClick={() => dragMoved.current < 6 && setSelected(image)}
            >
              <img
                className="sphere-item__img"
                src={image.src}
                alt={image.alt}
                draggable={false}
                loading={w.index < 4 ? 'eager' : 'lazy'}
              />
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="sphere-modal" onClick={() => setSelected(null)}>
          <div className="sphere-modal__card" onClick={(e) => e.stopPropagation()}>
            <img className="sphere-modal__img" src={selected.src} alt={selected.alt} />
            <button className="sphere-modal__close" onClick={() => setSelected(null)} aria-label="Закрыть">
              ✕
            </button>
            {(selected.title || selected.description) && (
              <div className="sphere-modal__info">
                {selected.title && <h3>{selected.title}</h3>}
                {selected.description && <p>{selected.description}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
