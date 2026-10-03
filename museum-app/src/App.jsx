import React, { useState } from 'react'
import Navigation from './components/Navigation'
import GridLines from './components/GridLines'
import SectionIndicator from './components/SectionIndicator'
import Scene3D from './components/Scene3D'
import TextOverlay from './components/TextOverlay'
import { useScrollProgress } from './hooks/useScrollProgress'
import { useCursorTilt } from './hooks/useCursorTilt'
import './App.css'

// Set to '/statue.glb' after placing museum-app/public/statue.glb
// (copy from C:\Users\zakir\Downloads\robot_head.glb)
const MODEL_URL = null

export default function App() {
  const scrollData = useScrollProgress(3)
  const tilt = useCursorTilt(0.08)

  return (
    <div className="app">
      {/* Background layers */}
      <div className="app__bg" />
      <GridLines count={9} />

      {/* Fixed 3D canvas */}
      <Scene3D scrollData={scrollData} tilt={tilt} modelUrl={MODEL_URL} />

      {/* Fixed UI */}
      <Navigation />
      <SectionIndicator section={scrollData.section} />
      <TextOverlay scrollData={scrollData} />

      {/* Scroll spacer — 3 viewport heights */}
      <div className="scroll-spacer" />
    </div>
  )
}
