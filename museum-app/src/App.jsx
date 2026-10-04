import React, { useState } from 'react'
import Navigation from './components/Navigation'
import GridLines from './components/GridLines'
import SectionIndicator from './components/SectionIndicator'
import Scene3D from './components/Scene3D'
import TextOverlay from './components/TextOverlay'
import { useScrollProgress } from './hooks/useScrollProgress'
import { useCursorTilt } from './hooks/useCursorTilt'
import './App.css'

export default function App() {
  const scrollData = useScrollProgress(3)
  const tilt = useCursorTilt(0.08)

  return (
    <div className="app">
      <div className="app__bg" />
      <GridLines count={9} />

      <Scene3D scrollData={scrollData} tilt={tilt} />

      {/* Fixed UI */}
      <Navigation />
      <SectionIndicator section={scrollData.section} />
      <TextOverlay scrollData={scrollData} />

    </div>
  )
}
