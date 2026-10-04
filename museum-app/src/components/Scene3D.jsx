import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture, useVideoTexture } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from '@react-three/postprocessing'
import * as THREE from 'three'
import './Scene3D.css'

const PHOTO_URL    = `${import.meta.env.BASE_URL}photo_nobg.png`
const RING_URL_WEBM = `${import.meta.env.BASE_URL}ring.webm`

const isMobile = () => window.innerWidth < 768 || /android|iphone|ipad|ipod/i.test(navigator.userAgent)

function lerp(a, b, t) { return a + (b - a) * t }

// Desktop keyframes (head on right side)
const KEYFRAMES = [
  // Section 0 – Hero
  {
    cam: [-0.15, 0.15, 2.3],
    camTarget: [-0.1, 0.1, 0],
    modelPos: [0.38, 0.10, 0],
    modelRot: [0, -0.15, 0],
    ringPos: [0.38, 0.10, -0.4],
    ringScale: 0.72,
    ringOpacity: 0.9,
    dofFocus: 0.12,
    ambientIntensity: 0.18,
    lightIntensity: 1.2,
  },
  // Section 1 – Works
  {
    cam: [-0.15, 0.1, 2.5],
    camTarget: [-0.08, 0.08, 0],
    modelPos: [0.42, 0.10, 0],
    modelRot: [0, 0.08, 0],
    ringPos: [0.42, 0.10, -0.38],
    ringScale: 0.68,
    ringOpacity: 0.75,
    dofFocus: 0.10,
    ambientIntensity: 0.25,
    lightIntensity: 2.2,
  },
  // Section 2 – Contact
  {
    cam: [-0.15, 0.1, 2.4],
    camTarget: [-0.05, 0.08, 0],
    modelPos: [0.52, 0.10, 0],
    modelRot: [0, -0.05, 0],
    ringPos: [0.52, 0.10, -0.38],
    ringScale: 0.72,
    ringOpacity: 0.85,
    dofFocus: 0.12,
    ambientIntensity: 0.35,
    lightIntensity: 2.8,
  },
]

// Mobile keyframes (head centered, fits portrait viewport)
const MOBILE_KEYFRAMES = [
  // Section 0 – Hero
  {
    cam: [0, 0.12, 2.7],
    camTarget: [0, 0.08, 0],
    modelPos: [0, 0.08, 0],
    modelRot: [0, -0.15, 0],
    ringPos: [0, 0.08, -0.4],
    ringScale: 0.65,
    ringOpacity: 0.9,
    dofFocus: 0.12,
    ambientIntensity: 0.18,
    lightIntensity: 1.2,
  },
  // Section 1 – Works
  {
    cam: [0, 0.08, 2.8],
    camTarget: [0, 0.06, 0],
    modelPos: [0.05, 0.08, 0],
    modelRot: [0, 0.08, 0],
    ringPos: [0.05, 0.08, -0.38],
    ringScale: 0.62,
    ringOpacity: 0.75,
    dofFocus: 0.10,
    ambientIntensity: 0.25,
    lightIntensity: 2.2,
  },
  // Section 2 – Contact
  {
    cam: [0, 0.08, 2.7],
    camTarget: [0, 0.06, 0],
    modelPos: [0.08, 0.08, 0],
    modelRot: [0, -0.05, 0],
    ringPos: [0.08, 0.08, -0.38],
    ringScale: 0.65,
    ringOpacity: 0.85,
    dofFocus: 0.12,
    ambientIntensity: 0.35,
    lightIntensity: 2.8,
  },
]

function interpolateKF(kf0, kf1, t) {
  const l3 = (a, b, t) => [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]
  const s = t * t * (3 - 2 * t) // smoothstep
  return {
    cam:              l3(kf0.cam, kf1.cam, s),
    camTarget:        l3(kf0.camTarget, kf1.camTarget, s),
    modelPos:         l3(kf0.modelPos, kf1.modelPos, s),
    modelRot:         l3(kf0.modelRot, kf1.modelRot, s),
    ringPos:          l3(kf0.ringPos, kf1.ringPos, s),
    ringScale:        lerp(kf0.ringScale,        kf1.ringScale,        s),
    ringOpacity:      lerp(kf0.ringOpacity,      kf1.ringOpacity,      s),
    dofFocus:         lerp(kf0.dofFocus,         kf1.dofFocus,         s),
    ambientIntensity: lerp(kf0.ambientIntensity, kf1.ambientIntensity, s),
    lightIntensity:   lerp(kf0.lightIntensity,   kf1.lightIntensity,   s),
  }
}

function getCurrentKF(section, progress, mobile = false) {
  const frames = mobile ? MOBILE_KEYFRAMES : KEYFRAMES
  const kf0 = frames[section]
  const kf1 = frames[Math.min(section + 1, frames.length - 1)]
  return interpolateKF(kf0, kf1, progress)
}

// ── Glowing ring — video texture (desktop) ───────────────────────────────────
function VideoGlowRing({ position, scale, opacity }) {
  const texture = useVideoTexture(RING_URL_WEBM, { loop: true, muted: true, start: true, playsInline: true })
  return (
    <group position={position}>
      <mesh scale={scale * 1.9} renderOrder={-1}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          map={texture}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          opacity={opacity}
        />
      </mesh>
    </group>
  )
}

// ── Glowing ring — programmatic (mobile, always works) ───────────────────────
function ProceduralGlowRing({ position, scale, opacity }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * 0.14
  })
  const s = scale * 1.9
  const add = THREE.AdditiveBlending
  return (
    <group ref={ref} position={position} renderOrder={-1}>
      {/* outer soft halo */}
      <mesh scale={s} renderOrder={-1}>
        <torusGeometry args={[0.68, 0.08, 8, 120]} />
        <meshBasicMaterial color="#0d2a55" transparent opacity={opacity * 0.35} blending={add} depthWrite={false} depthTest={false} />
      </mesh>
      {/* mid glow */}
      <mesh scale={s} renderOrder={-1}>
        <torusGeometry args={[0.68, 0.032, 8, 120]} />
        <meshBasicMaterial color="#2255aa" transparent opacity={opacity * 0.6} blending={add} depthWrite={false} depthTest={false} />
      </mesh>
      {/* core ring */}
      <mesh scale={s} renderOrder={-1}>
        <torusGeometry args={[0.68, 0.013, 8, 120]} />
        <meshBasicMaterial color="#4488dd" transparent opacity={opacity * 0.95} blending={add} depthWrite={false} depthTest={false} />
      </mesh>
      {/* bright highlight */}
      <mesh scale={s} renderOrder={-1}>
        <torusGeometry args={[0.68, 0.005, 8, 120]} />
        <meshBasicMaterial color="#99ccff" transparent opacity={opacity * 0.75} blending={add} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  )
}

function GlowRing({ position, scale, opacity, mobile }) {
  return mobile
    ? <ProceduralGlowRing position={position} scale={scale} opacity={opacity} />
    : <VideoGlowRing position={position} scale={scale} opacity={opacity} />
}

// ── Loading spinner ───────────────────────────────────────────────────────────
function LoadingSpinner() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * 1.5
  })
  return (
    <group>
      <mesh ref={ref}>
        <torusGeometry args={[0.18, 0.008, 8, 60]} />
        <meshBasicMaterial color="#c9a96e" transparent opacity={0.7} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.18, 0.002, 8, 60]} />
        <meshBasicMaterial color="#4a7fa5" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

// ── Cutout photo — transparent PNG floating in scene, tracks mouse ────────────
function PhotoCard({ kf, tilt }) {
  const groupRef = useRef()
  const texture  = useTexture(PHOTO_URL)

  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    map:        texture,
    transparent: true,
    alphaTest:  0.05,
    depthWrite: false,
    side:       THREE.DoubleSide,
  }), [texture])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const g = groupRef.current
    g.position.lerp(
      new THREE.Vector3(
        kf.modelPos[0],
        kf.modelPos[1] + Math.sin(clock.getElapsedTime() * 0.85) * 0.01,
        kf.modelPos[2]
      ),
      0.07
    )
    g.rotation.x = lerp(g.rotation.x, kf.modelRot[0] + tilt.y * 2.5, 0.07)
    g.rotation.y = lerp(g.rotation.y, kf.modelRot[1] + tilt.x * 2.5, 0.07)
  })

  return (
    <group ref={groupRef}>
      <mesh material={mat}>
        <planeGeometry args={[0.78, 0.78]} />
      </mesh>
    </group>
  )
}

// ── Camera controller ─────────────────────────────────────────────────────────
function CameraController({ kf }) {
  const { camera } = useThree()
  const targetRef = useRef(new THREE.Vector3())
  useFrame(() => {
    camera.position.lerp(new THREE.Vector3(...kf.cam), 0.05)
    targetRef.current.lerp(new THREE.Vector3(...kf.camTarget), 0.05)
    camera.lookAt(targetRef.current)
  })
  return null
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function SceneContent({ scrollData, tilt, mobile }) {
  const { section, progress } = scrollData
  const kf = getCurrentKF(section, progress, mobile)

  return (
    <>
      <CameraController kf={kf} />

      <ambientLight intensity={kf.ambientIntensity} />
      <directionalLight position={[-1.5, 1.5, 1.5]} intensity={kf.lightIntensity} color="#f5e8d0" />
      <directionalLight position={[1.5, 0.5, -1.5]} intensity={kf.lightIntensity * 0.45} color="#a0c8ff" />
      {!mobile && <directionalLight position={[0, -0.8, 1]} intensity={kf.lightIntensity * 0.2} color="#ffffff" />}

      <GlowRing position={kf.ringPos} scale={kf.ringScale} opacity={kf.ringOpacity} mobile={mobile} />

      <Suspense fallback={<LoadingSpinner />}>
        <PhotoCard kf={kf} tilt={tilt} />
      </Suspense>

      {mobile ? (
        <EffectComposer>
          <Bloom intensity={0.8} luminanceThreshold={0.5} radius={0.5} />
          <Vignette eskil={false} offset={0.2} darkness={0.65} />
        </EffectComposer>
      ) : (
        <EffectComposer>
          <DepthOfField focusDistance={kf.dofFocus} focalLength={0.008} bokehScale={0.6} />
          <Bloom intensity={0.5} luminanceThreshold={0.6} luminanceSmoothing={0.9} radius={0.5} />
          <Noise opacity={0.028} />
          <Vignette eskil={false} offset={0.18} darkness={0.75} />
        </EffectComposer>
      )}
    </>
  )
}

export default function Scene3D({ scrollData, tilt }) {
  const mobile = isMobile()

  return (
    <div className="scene-canvas">
      <Canvas
        camera={{ position: [0, 0.08, 2.4], fov: 36, near: 0.05, far: 30 }}
        dpr={mobile ? 1 : [1, 2]}
        gl={{
          antialias: !mobile,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
          powerPreference: mobile ? 'low-power' : 'high-performance',
        }}
      >
        <SceneContent scrollData={scrollData} tilt={tilt} mobile={mobile} />
      </Canvas>
    </div>
  )
}
