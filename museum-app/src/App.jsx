import React, { useState, useEffect } from 'react'
import Navigation from './components/Navigation'
import GridLines from './components/GridLines'
import SectionIndicator from './components/SectionIndicator'
import Scene3D from './components/Scene3D'
import TextOverlay from './components/TextOverlay'
import WorksPage from './components/WorksPage'
import { useScrollProgress } from './hooks/useScrollProgress'
import { useCursorTilt } from './hooks/useCursorTilt'
import './App.css'

export default function App() {
  const scrollData = useScrollProgress(3)
  const tilt = useCursorTilt(0.08)
  const [worksCategory, setWorksCategory] = useState(null)

  // The works page lives in the browser history, so "Back" closes it instead of leaving the site.
  useEffect(() => {
    const onPop = (e) => {
      setWorksCategory(e.state?.works ?? null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openWorks = (cat) => {
    window.history.pushState({ works: cat }, '')
    setWorksCategory(cat)
  }
  const closeWorks = () => {
    if (window.history.state?.works) window.history.back()
    else setWorksCategory(null)
  }
  return (
    <div className="app">
      <div className="app__bg" />
      <GridLines count={9} />

      <Scene3D scrollData={scrollData} tilt={tilt} />

      <Navigation />
      <SectionIndicator section={scrollData.section} />
      <TextOverlay
        scrollData={scrollData}
        onOpenCategory={openWorks}
      />

      {worksCategory && <WorksPage category={worksCategory} onClose={closeWorks} />}
    </div>
  )
}
