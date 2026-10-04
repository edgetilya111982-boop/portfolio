import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from '@react-three/postprocessing'
import * as THREE from 'three'
import './Scene3D.css'

const HEAD_URL = `${import.meta.env.BASE_URL}head.glb`
const RING_URL = `${import.meta.env.BASE_URL}ring.webp`
useGLTF.preload(HEAD_URL)

const isMobile = () => window.innerWidth < 768 || /android|iphone|ipad|ipod/i.test(navigator.userAgent)

function lerp(a, b, t) { return a + (b - a) * t }

// Scene keyframes
const KEYFRAMES = [
  // Section 0 – Hero: head in shadow, mysterious
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
  // Section 1 – Works: camera looks left so head at 0.42 appears on right
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
  // Section 2 – Contact: head further right
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

function getCurrentKF(section, progress) {
  const kf0 = KEYFRAMES[section]
  const kf1 = KEYFRAMES[Math.min(section + 1, KEYFRAMES.length - 1)]
  return interpolateKF(kf0, kf1, progress)
}

// ── Glowing ring (image-based, AdditiveBlending so black = transparent) ───────
function GlowRing({ position, scale, opacity }) {
  const texture = useTexture(RING_URL)
  const meshRef = useRef()

  useFrame(({ clock }) => {
    if (meshRef.current)
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.04
  })

  return (
    <group position={position}>
      <mesh ref={meshRef} scale={scale * 1.55}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          map={texture}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={opacity}
        />
      </mesh>
    </group>
  )
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

// ── Fallback box-head (shows when GLB fails to load) ─────────────────────────
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
      {[-0.052, 0.052].map((x, i) => (
        <mesh key={i} position={[x, 0.03, 0.093]}>
          <torusGeometry args={[0.026, 0.004, 8, 32]} />
          <meshStandardMaterial color="#c9a000" metalness={1} roughness={0.1} />
        </mesh>
      ))}
      <mesh material={mat} position={[0, -0.165, 0]}>
        <cylinderGeometry args={[0.055, 0.065, 0.08, 8]} />
      </mesh>
    </group>
  )
}

// ── Real GLB head model ───────────────────────────────────────────────────────
function HeadModel({ url, kf, tilt }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()

  useMemo(() => {
    scene.traverse(child => {
      if (!child.isMesh) return
      child.castShadow = true
      const m = child.material
      if (!m) return
      // GLB bakes roughnessMap/metalnessMap from Tripo → must null them out
      // otherwise scalar roughness is multiplied by the (low) texture value
      m.roughnessMap = null
      m.metalnessMap = null
      m.roughness = 0.85
      m.metalness = 0.04
      m.envMapIntensity = 0.1
      m.needsUpdate = true
    })
  }, [scene])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const g = groupRef.current
    g.position.lerp(
      new THREE.Vector3(kf.modelPos[0], kf.modelPos[1] + Math.sin(clock.getElapsedTime() * 0.85) * 0.012, kf.modelPos[2]),
      0.07
    )
    // -PI/2 rotates Tripo model to face camera (фас); tilt gives mouse tracking
    g.rotation.x = lerp(g.rotation.x, kf.modelRot[0] + tilt.y * 0.45, 0.07)
    g.rotation.y = lerp(g.rotation.y, kf.modelRot[1] - Math.PI / 2 - 0.25 + tilt.x * 0.45, 0.07)
  })

  return <primitive ref={groupRef} object={scene} scale={0.88} />
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
function SceneContent({ scrollData, tilt, mobile }) {
  const { section, progress } = scrollData
  const kf = getCurrentKF(section, progress)

  const fallback = <FallbackHead kf={kf} tilt={tilt} />

  return (
    <>
      <CameraController kf={kf} />

      <ambientLight intensity={kf.ambientIntensity} />
      <directionalLight position={[-1.5, 1.5, 1.5]} intensity={kf.lightIntensity} color="#f5e8d0" />
      <directionalLight position={[1.5, 0.5, -1.5]} intensity={kf.lightIntensity * 0.45} color="#a0c8ff" />
      {!mobile && <directionalLight position={[0, -0.8, 1]} intensity={kf.lightIntensity * 0.2} color="#ffffff" />}

      <GlowRing position={kf.ringPos} scale={kf.ringScale} opacity={kf.ringOpacity} />

      <GLBErrorBoundary fallback={fallback}>
        <Suspense fallback={<LoadingSpinner />}>
          <HeadModel url={HEAD_URL} kf={kf} tilt={tilt} />
        </Suspense>
      </GLBErrorBoundary>

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
