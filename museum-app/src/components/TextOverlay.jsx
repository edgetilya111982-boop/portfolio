import React from 'react'
import './TextOverlay.css'

// Section 0 — Hero
function HeroText({ progress }) {
  const opacity = Math.max(0, 1 - progress * 3)
  return (
    <div className="overlay-section overlay-hero" style={{ opacity }}>
      <div className="overlay-hero__headline">
        <h1 className="headline-large">
          Museum of<br />
          <em>Future Art</em>
        </h1>
      </div>
      <div className="overlay-hero__body">
        <p className="body-small">
          A space where technology becomes<br />
          the medium and the message.
        </p>
        <div className="overlay-hero__meta">
          <span className="label-tiny">Permanent Collection</span>
          <span className="label-tiny">·</span>
          <span className="label-tiny">Est. 2024</span>
        </div>
      </div>
    </div>
  )
}

// Section 1 — Details
function DetailsText({ progress, visible }) {
  const opacity = visible ? Math.min(1, progress * 4) * Math.max(0, 1 - (progress - 0.8) * 10) : 0
  const offsetX = visible ? (1 - Math.min(1, progress * 4)) * -30 : -30
  return (
    <div className="overlay-section overlay-details" style={{ opacity, transform: `translateX(${offsetX}px)` }}>
      <div className="overlay-details__left">
        <span className="label-tiny overlay-details__number">Unit 047</span>
        <h2 className="headline-medium">
          Sentinel<br />
          <em>Prototype IX</em>
        </h2>
        <div className="overlay-details__specs">
          <div className="spec-row">
            <span className="spec-label">Height</span>
            <span className="spec-value">74 cm (29 in)</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">Origin</span>
            <span className="spec-value">Lab Sigma, 2041</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">Medium</span>
            <span className="spec-value">Steel, copper, circuit board</span>
          </div>
        </div>
        <div className="overlay-details__desc">
          <p className="body-small">
            Originally designed for autonomous reconnaissance,
            decommissioned and repurposed as a study in
            machine cognition and materiality.
          </p>
          <p className="body-small" style={{ marginTop: '0.75rem' }}>
            The ocular lenses — brass-tinted optical arrays —
            remain functional, their gaze preserved in
            perpetuity by the conservation department.
          </p>
        </div>
      </div>
    </div>
  )
}

// Section 2 — Discovery
function DiscoveryText({ progress, visible }) {
  const opacity = visible ? Math.min(1, progress * 4) : 0
  const offsetY = visible ? (1 - Math.min(1, progress * 4)) * 20 : 20
  return (
    <div className="overlay-section overlay-discovery" style={{ opacity, transform: `translateY(${offsetY}px)` }}>
      <div className="overlay-discovery__left">
        <span className="label-tiny">Discovery</span>
        <h2 className="headline-medium">
          Found in the<br />
          <em>server graveyard</em><br />
          of the Eastern Grid
        </h2>
      </div>
      <div className="overlay-discovery__columns">
        <div className="discovery-col">
          <p className="body-small">
            Recovered in 2089 from a decommissioned
            data center beneath the Eastern Seaboard.
            The unit's memory cores were found intact,
            containing 14 years of unlogged experience.
          </p>
        </div>
        <div className="discovery-col">
          <p className="body-small">
            Conservators spent three years extracting
            the unit's sensory logs before presenting
            this reconstruction — part artifact,
            part living archive.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function TextOverlay({ scrollData }) {
  const { section, progress } = scrollData

  return (
    <div className="text-overlay">
      <HeroText progress={section === 0 ? progress : section > 0 ? 1 : 0} />
      <DetailsText
        progress={section === 1 ? progress : section > 1 ? 1 : 0}
        visible={section === 1 || (section === 0 && progress > 0.6)}
      />
      <DiscoveryText
        progress={section === 2 ? progress : 0}
        visible={section === 2 || (section === 1 && progress > 0.7)}
      />
    </div>
  )
}
