import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from '@react-three/postprocessing'
import * as THREE from 'three'
import './Scene3D.css'

// Lerp helper
function lerp(a, b, t) { return a + (b - a) * t }
function lerpV3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] }

// Scene keyframes: [camera position, model position, model rotation Y, ring scale, ring position]
const KEYFRAMES = [
  // Section 0 – Hero: large centered bust, ring behind head
  {
    cam: [0, 0.2, 3.8],
    camTarget: [0, 0.1, 0],
    modelPos: [0, -0.4, 0],
    modelRot: [0, 0, 0],
    ringPos: [0, 0.5, -0.6],
    ringScale: 1.4,
    ringOpacity: 0.9,
    dofFocus: 3.5,
  },
  // Section 1 – Details: bust moves right, side/quarter view
  {
    cam: [0.3, 0.1, 4.2],
    camTarget: [0.6, 0, 0],
    modelPos: [1.2, -0.5, 0],
    modelRot: [0, -0.45, 0],
    ringPos: [1.2, 0.5, -0.5],
    ringScale: 1.1,
    ringOpacity: 0.7,
    dofFocus: 4.0,
  },
  // Section 2 – Discovery: close up, head+torso dominate, ring partly cropped
  {
    cam: [0.2, 0.4, 2.6],
    camTarget: [0.1, 0.3, 0],
    modelPos: [0.3, -0.2, 0],
    modelRot: [0, 0.15, 0],
    ringPos: [0.2, 1.0, -0.4],
    ringScale: 1.8,
    ringOpacity: 0.6,
    dofFocus: 2.4,
  },
]

function interpolateKF(kf0, kf1, t) {
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
  return {
    cam: lerp3(kf0.cam, kf1.cam, t),
    camTarget: lerp3(kf0.camTarget, kf1.camTarget, t),
    modelPos: lerp3(kf0.modelPos, kf1.modelPos, t),
    modelRot: [lerp(kf0.modelRot[0], kf1.modelRot[0], t), lerp(kf0.modelRot[1], kf1.modelRot[1], t), lerp(kf0.modelRot[2], kf1.modelRot[2], t)],
    ringPos: lerp3(kf0.ringPos, kf1.ringPos, t),
    ringScale: lerp(kf0.ringScale, kf1.ringScale, t),
    ringOpacity: lerp(kf0.ringOpacity, kf1.ringOpacity, t),
    dofFocus: lerp(kf0.dofFocus, kf1.dofFocus, t),
  }
}

function getCurrentKF(section, progress) {
  const kf0 = KEYFRAMES[section]
  const kf1 = KEYFRAMES[Math.min(section + 1, KEYFRAMES.length - 1)]
  // Smooth step
  const t = progress * progress * (3 - 2 * progress)
  return interpolateKF(kf0, kf1, t)
}

// Glowing ring
function GlowRing({ position, scale, opacity }) {
  const ringRef = useRef()
  const glowRef = useRef()

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.08
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = opacity * (0.85 + Math.sin(clock.getElapsedTime() * 1.2) * 0.15)
    }
  })

  return (
    <group position={position}>
      {/* Main ring */}
      <mesh ref={ringRef} scale={scale}>
        <torusGeometry args={[1, 0.006, 16, 120]} />
        <meshBasicMaterial color="#4a7fa5" transparent opacity={opacity} />
      </mesh>
      {/* Glow ring (slightly larger) */}
      <mesh ref={glowRef} scale={scale * 1.03}>
        <torusGeometry args={[1, 0.025, 8, 100]} />
        <meshBasicMaterial color="#2a5f85" transparent opacity={opacity * 0.3} />
      </mesh>
      {/* Point light for ring glow */}
      <pointLight
        color="#4a7fa5"
        intensity={opacity * 3}
        distance={3}
        decay={2}
      />
    </group>
  )
}

// Fallback geometry when GLB not available
function FallbackHead({ modelPos, modelRot, tilt }) {
  const groupRef = useRef()
  const headRef = useRef()

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.set(...modelPos)
      groupRef.current.rotation.x = modelRot[0] + tilt.y
      groupRef.current.rotation.y = modelRot[1] + tilt.x
      groupRef.current.rotation.z = modelRot[2]
    }
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.02
    }
  })

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a1512'),
    metalness: 0.65,
    roughness: 0.3,
  }), [])

  return (
    <group ref={groupRef}>
      <group ref={headRef}>
        {/* Main head */}
        <mesh material={material} position={[0, 0.1, 0]}>
          <boxGeometry args={[0.55, 0.65, 0.5]} />
        </mesh>
        {/* Forehead */}
        <mesh material={material} position={[0, 0.42, 0]}>
          <boxGeometry args={[0.5, 0.15, 0.45]} />
        </mesh>
        {/* Chin */}
        <mesh material={material} position={[0, -0.28, 0]}>
          <boxGeometry args={[0.42, 0.1, 0.4]} />
        </mesh>
        {/* Eyes - left */}
        <mesh position={[-0.14, 0.08, 0.26]}>
          <cylinderGeometry args={[0.065, 0.065, 0.02, 32]} />
          <meshStandardMaterial color="#8b6914" metalness={0.9} roughness={0.1} emissive="#c9a000" emissiveIntensity={0.3} />
        </mesh>
        {/* Eyes - right */}
        <mesh position={[0.14, 0.08, 0.26]}>
          <cylinderGeometry args={[0.065, 0.065, 0.02, 32]} />
          <meshStandardMaterial color="#8b6914" metalness={0.9} roughness={0.1} emissive="#c9a000" emissiveIntensity={0.3} />
        </mesh>
        {/* Eye rings */}
        <mesh position={[-0.14, 0.08, 0.25]}>
          <torusGeometry args={[0.07, 0.008, 8, 32]} />
          <meshStandardMaterial color="#c9a000" metalness={1} roughness={0.1} />
        </mesh>
        <mesh position={[0.14, 0.08, 0.25]}>
          <torusGeometry args={[0.07, 0.008, 8, 32]} />
          <meshStandardMaterial color="#c9a000" metalness={1} roughness={0.1} />
        </mesh>
        {/* Nose area */}
        <mesh material={material} position={[0, -0.05, 0.27]}>
          <boxGeometry args={[0.1, 0.12, 0.04]} />
        </mesh>
        {/* Wires on top */}
        {[-0.1, 0, 0.1].map((x, i) => (
          <mesh key={i} position={[x, 0.5, 0.1]} material={new THREE.MeshStandardMaterial({ color: '#3a2010', roughness: 0.8 })}>
            <cylinderGeometry args={[0.005, 0.005, 0.2, 4]} />
          </mesh>
        ))}
        {/* Khaki panels */}
        <mesh position={[-0.25, 0.2, 0.05]}>
          <boxGeometry args={[0.05, 0.15, 0.44]} />
          <meshStandardMaterial color="#4a4a2a" metalness={0.3} roughness={0.6} />
        </mesh>
        <mesh position={[0.25, 0.2, 0.05]}>
          <boxGeometry args={[0.05, 0.15, 0.44]} />
          <meshStandardMaterial color="#4a4a2a" metalness={0.3} roughness={0.6} />
        </mesh>
        {/* Neck */}
        <mesh material={material} position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.15, 0.18, 0.22, 8]} />
        </mesh>
      </group>
    </group>
  )
}

// Real GLB model
function RobotModel({ url, modelPos, modelRot, tilt }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()

  // Apply dark bronze material
  useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#1a1512'),
          metalness: 0.65,
          roughness: 0.3,
          envMapIntensity: 1.2,
        })
        child.castShadow = true
        child.receiveShadow = false
      }
    })
  }, [scene])

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.lerp(
        new THREE.Vector3(...modelPos),
        0.06
      )
      groupRef.current.rotation.x = lerp(groupRef.current.rotation.x, modelRot[0] + tilt.y, 0.06)
      groupRef.current.rotation.y = lerp(groupRef.current.rotation.y, modelRot[1] + tilt.x, 0.06)
      groupRef.current.rotation.z = lerp(groupRef.current.rotation.z, modelRot[2], 0.06)
    }
  })

  return <primitive ref={groupRef} object={scene} />
}

// Camera controller
function CameraController({ kf, tilt }) {
  const { camera } = useThree()
  const targetRef = useRef(new THREE.Vector3())

  useFrame(() => {
    camera.position.lerp(new THREE.Vector3(...kf.cam), 0.04)
    targetRef.current.lerp(new THREE.Vector3(...kf.camTarget), 0.04)
    camera.lookAt(targetRef.current)
  })

  return null
}

// Main scene
function SceneContent({ scrollData, tilt, modelUrl }) {
  const { section, progress } = scrollData
  const kf = getCurrentKF(section, progress)

  return (
    <>
      <CameraController kf={kf} tilt={tilt} />

      {/* Lighting */}
      <ambientLight intensity={0.15} />
      {/* Warm front-left key */}
      <directionalLight
        position={[-2, 2, 2]}
        intensity={1.8}
        color="#f5e8d0"
      />
      {/* Cool back-right rim */}
      <directionalLight
        position={[2, 0.5, -2]}
        intensity={0.8}
        color="#a0c8ff"
      />
      {/* Fill */}
      <directionalLight
        position={[0, -1, 2]}
        intensity={0.3}
        color="#ffffff"
      />

      {/* Glowing ring */}
      <GlowRing
        position={kf.ringPos}
        scale={kf.ringScale}
        opacity={kf.ringOpacity}
      />

      {/* Model */}
      <Suspense fallback={
        <FallbackHead modelPos={kf.modelPos} modelRot={kf.modelRot} tilt={tilt} />
      }>
        {modelUrl ? (
          <RobotModel
            url={modelUrl}
            modelPos={kf.modelPos}
            modelRot={kf.modelRot}
            tilt={tilt}
          />
        ) : (
          <FallbackHead modelPos={kf.modelPos} modelRot={kf.modelRot} tilt={tilt} />
        )}
      </Suspense>

      {/* Post-processing */}
      <EffectComposer>
        <DepthOfField
          focusDistance={kf.dofFocus * 0.01}
          focalLength={0.025}
          bokehScale={2}
        />
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
          radius={0.8}
        />
        <Noise opacity={0.03} />
        <Vignette eskil={false} offset={0.15} darkness={0.7} />
      </EffectComposer>
    </>
  )
}

export default function Scene3D({ scrollData, tilt, modelUrl }) {
  return (
    <div className="scene-canvas">
      <Canvas
        camera={{ position: [0, 0.2, 4], fov: 38, near: 0.1, far: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <SceneContent scrollData={scrollData} tilt={tilt} modelUrl={modelUrl} />
      </Canvas>
    </div>
  )
}
