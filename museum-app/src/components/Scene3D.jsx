import React, { useRef, useMemo, Suspense, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from '@react-three/postprocessing'
import * as THREE from 'three'
import './Scene3D.css'

function lerp(a, b, t) { return a + (b - a) * t }

// Scene keyframes
const KEYFRAMES = [
  // Section 0 – Hero: large centered head, ring behind
  {
    cam: [0, 0.15, 2.2],
    camTarget: [0, 0.1, 0],
    modelPos: [0, -0.1, 0],
    modelRot: [0, 0, 0],
    ringPos: [0, 0.18, -0.4],
    ringScale: 0.72,
    ringOpacity: 0.9,
    dofFocus: 0.12,
  },
  // Section 1 – Craft: head moves right, quarter-view
  {
    cam: [0.2, 0.1, 2.6],
    camTarget: [0.35, 0.05, 0],
    modelPos: [0.4, -0.1, 0],
    modelRot: [0, -0.4, 0],
    ringPos: [0.4, 0.18, -0.35],
    ringScale: 0.55,
    ringOpacity: 0.7,
    dofFocus: 0.10,
  },
  // Section 2 – Work: close-up, ring partly cropped
  {
    cam: [0.1, 0.2, 1.6],
    camTarget: [0.06, 0.15, 0],
    modelPos: [0.1, -0.05, 0],
    modelRot: [0, 0.12, 0],
    ringPos: [0.08, 0.42, -0.3],
    ringScale: 0.85,
    ringOpacity: 0.6,
    dofFocus: 0.14,
  },
]

function interpolateKF(kf0, kf1, t) {
  const l3 = (a, b, t) => [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]
  const s = t * t * (3 - 2 * t) // smoothstep
  return {
    cam:         l3(kf0.cam, kf1.cam, s),
    camTarget:   l3(kf0.camTarget, kf1.camTarget, s),
    modelPos:    l3(kf0.modelPos, kf1.modelPos, s),
    modelRot:    l3(kf0.modelRot, kf1.modelRot, s),
    ringPos:     l3(kf0.ringPos, kf1.ringPos, s),
    ringScale:   lerp(kf0.ringScale,   kf1.ringScale,   s),
    ringOpacity: lerp(kf0.ringOpacity, kf1.ringOpacity, s),
    dofFocus:    lerp(kf0.dofFocus,    kf1.dofFocus,    s),
  }
}

function getCurrentKF(section, progress) {
  const kf0 = KEYFRAMES[section]
  const kf1 = KEYFRAMES[Math.min(section + 1, KEYFRAMES.length - 1)]
  return interpolateKF(kf0, kf1, progress)
}

// ── Glowing ring ──────────────────────────────────────────────────────────────
function GlowRing({ position, scale, opacity }) {
  const ringRef = useRef()
  const glowRef = useRef()

  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.rotation.z = clock.getElapsedTime() * 0.08
    if (glowRef.current)
      glowRef.current.material.opacity = opacity * (0.85 + Math.sin(clock.getElapsedTime() * 1.2) * 0.15)
  })

  return (
    <group position={position}>
      <mesh ref={ringRef} scale={scale}>
        <torusGeometry args={[1, 0.006, 16, 120]} />
        <meshBasicMaterial color="#4a7fa5" transparent opacity={opacity} />
      </mesh>
      <mesh ref={glowRef} scale={scale * 1.04}>
        <torusGeometry args={[1, 0.028, 8, 100]} />
        <meshBasicMaterial color="#2a5f85" transparent opacity={opacity * 0.28} />
      </mesh>
      <pointLight color="#4a7fa5" intensity={opacity * 2.5} distance={2} decay={2} />
    </group>
  )
}

// ── Fallback box-head (shows when GLB is missing/loading) ────────────────────
function FallbackHead({ kf, tilt }) {
  const groupRef = useRef()
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a1512'), metalness: 0.65, roughness: 0.3,
  }), [])

  useFrame(() => {
    if (!groupRef.current) return
    const g = groupRef.current
    g.position.lerp(new THREE.Vector3(...kf.modelPos), 0.07)
    g.rotation.x = lerp(g.rotation.x, kf.modelRot[0] + tilt.y, 0.07)
    g.rotation.y = lerp(g.rotation.y, kf.modelRot[1] + tilt.x, 0.07)
  })

  return (
    <group ref={groupRef}>
      <mesh material={mat} position={[0, 0.04, 0]}><boxGeometry args={[0.2, 0.22, 0.18]} /></mesh>
      <mesh material={mat} position={[0, 0.17, 0]}><boxGeometry args={[0.18, 0.06, 0.16]} /></mesh>
      <mesh material={mat} position={[0, -0.1, 0]}><boxGeometry args={[0.15, 0.04, 0.14]} /></mesh>
      {/* eye rings */}
      {[-0.052, 0.052].map((x, i) => (
        <mesh key={i} position={[x, 0.03, 0.093]}>
          <torusGeometry args={[0.026, 0.004, 8, 32]} />
          <meshStandardMaterial color="#c9a000" metalness={1} roughness={0.1} />
        </mesh>
      ))}
      {/* khaki panels */}
      {[-0.092, 0.092].map((x, i) => (
        <mesh key={i} position={[x, 0.05, 0]}>
          <boxGeometry args={[0.018, 0.06, 0.16]} />
          <meshStandardMaterial color="#4a4a2a" metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
      <mesh material={mat} position={[0, -0.165, 0]}>
        <cylinderGeometry args={[0.055, 0.065, 0.08, 8]} />
      </mesh>
    </group>
  )
}

// ── Real GLB model ────────────────────────────────────────────────────────────
function RobotModel({ url, kf, tilt }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()

  useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1512'),
      metalness: 0.65,
      roughness: 0.3,
      envMapIntensity: 1.2,
    })
    scene.traverse(child => {
      if (child.isMesh) { child.material = mat; child.castShadow = true }
    })
  }, [scene])

  useFrame(() => {
    if (!groupRef.current) return
    const g = groupRef.current
    g.position.lerp(new THREE.Vector3(...kf.modelPos), 0.07)
    g.rotation.x = lerp(g.rotation.x, kf.modelRot[0] + tilt.y, 0.07)
    g.rotation.y = lerp(g.rotation.y, kf.modelRot[1] + tilt.x, 0.07)
  })

  return <primitive ref={groupRef} object={scene} scale={3.2} />
}

// ErrorBoundary for catching GLB load failures
class GLBErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
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
function SceneContent({ scrollData, tilt, modelUrl }) {
  const { section, progress } = scrollData
  const kf = getCurrentKF(section, progress)

  const fallback = <FallbackHead kf={kf} tilt={tilt} />

  return (
    <>
      <CameraController kf={kf} />

      {/* Lighting */}
      <ambientLight intensity={0.12} />
      <directionalLight position={[-1.5, 1.5, 1.5]} intensity={2.2} color="#f5e8d0" />
      <directionalLight position={[1.5, 0.5, -1.5]} intensity={0.9} color="#a0c8ff" />
      <directionalLight position={[0, -0.8, 1]} intensity={0.3} color="#ffffff" />

      {/* Ring */}
      <GlowRing position={kf.ringPos} scale={kf.ringScale} opacity={kf.ringOpacity} />

      {/* Model — tries GLB, falls back to geometry on any error or absence */}
      {modelUrl ? (
        <GLBErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <RobotModel url={modelUrl} kf={kf} tilt={tilt} />
          </Suspense>
        </GLBErrorBoundary>
      ) : fallback}

      {/* Post-processing */}
      <EffectComposer>
        <DepthOfField focusDistance={kf.dofFocus} focalLength={0.008} bokehScale={0.6} />
        <Bloom intensity={1.4} luminanceThreshold={0.35} luminanceSmoothing={0.9} radius={0.85} />
        <Noise opacity={0.028} />
        <Vignette eskil={false} offset={0.18} darkness={0.75} />
      </EffectComposer>
    </>
  )
}

export default function Scene3D({ scrollData, tilt, modelUrl }) {
  return (
    <div className="scene-canvas">
      <Canvas
        camera={{ position: [0, 0.08, 2.4], fov: 36, near: 0.05, far: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        <SceneContent scrollData={scrollData} tilt={tilt} modelUrl={modelUrl} />
      </Canvas>
    </div>
  )
}
