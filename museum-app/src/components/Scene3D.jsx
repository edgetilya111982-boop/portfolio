import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from '@react-three/postprocessing'
import * as THREE from 'three'
import './Scene3D.css'

const PHOTO_URL = `${import.meta.env.BASE_URL}photo_nobg.png`

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
    ringPos: [0.38, 0.10, -0.02],
    ringScale: 0.72,
    ringOpacity: 0.82,
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
    ringPos: [0.42, 0.10, -0.02],
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
    ringPos: [0.52, 0.10, -0.02],
    ringScale: 0.72,
    ringOpacity: 0.80,
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
    ringPos: [0, 0.08, -0.02],
    ringScale: 0.65,
    ringOpacity: 0.82,
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
    ringPos: [0.05, 0.08, -0.02],
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
    ringPos: [0.08, 0.08, -0.02],
    ringScale: 0.65,
    ringOpacity: 0.80,
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

// ── Atmospheric aura — shader-based soft glow disc ────────────────────────────
const AURA_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const AURA_FRAG = `
uniform float opacity;
uniform float time;
varying vec2 vUv;

void main() {
  vec2 uv = vUv - 0.5;
  float r = length(uv) * 2.0;

  // Subtle drift on the ring radius
  float drift = sin(time * 0.4) * 0.02;

  // Soft atmospheric ring — gaussian bell centered at ~0.72
  float ring = exp(-pow((r - 0.72 + drift) * 5.5, 2.0));

  // Very faint inner sphere glow
  float sphere = max(0.0, 1.0 - r * 1.5);
  sphere = sphere * sphere * 0.18;

  // Faint outer nebula haze
  float outer = max(0.0, 1.0 - r * 0.9);
  outer = outer * outer * 0.08;

  float total = ring * 0.9 + sphere + outer;

  // Deep indigo → cool blue — NOT neon
  vec3 ringColor  = vec3(0.03, 0.14, 0.42);
  vec3 innerColor = vec3(0.01, 0.05, 0.18);
  vec3 col = mix(innerColor, ringColor, smoothstep(0.0, 1.0, ring));

  gl_FragColor = vec4(col * total, total * opacity);
}
`

function AtmosphericAura({ position, scale, opacity }) {
  const matRef = useRef()
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { opacity: { value: opacity }, time: { value: 0 } },
    vertexShader:   AURA_VERT,
    fragmentShader: AURA_FRAG,
    transparent: true,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    depthTest:   false,
    side:        THREE.DoubleSide,
  }), [])

  useFrame(({ clock }) => {
    mat.uniforms.opacity.value = opacity
    mat.uniforms.time.value    = clock.getElapsedTime()
  })

  const s = scale * 2.4
  return (
    <group position={position} renderOrder={1}>
      <mesh scale={s} renderOrder={1} material={mat}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </group>
  )
}

function GlowRing({ position, scale, opacity }) {
  return <AtmosphericAura position={position} scale={scale} opacity={opacity} />
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
const PHOTO_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const PHOTO_FRAG = `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 tex = texture2D(map, vUv);
  // thin circular fade — only the outermost 8% of radius dissolves
  float r = length(vUv - 0.5);
  float fade = smoothstep(0.50, 0.42, r);
  gl_FragColor = vec4(tex.rgb, tex.a * fade);
}
`

function PhotoCard({ kf, tilt }) {
  const groupRef = useRef()
  const texture  = useTexture(PHOTO_URL)

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms:    { map: { value: texture } },
    vertexShader:   PHOTO_VERT,
    fragmentShader: PHOTO_FRAG,
    transparent: true,
    depthWrite:  false,
    side:        THREE.DoubleSide,
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

      <GlowRing position={kf.ringPos} scale={kf.ringScale} opacity={kf.ringOpacity} />

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
