import React from 'react'
import './TextOverlay.css'

// Section 0 — Hero / Intro
function HeroText({ progress }) {
  const opacity = Math.max(0, 1 - progress * 3)
  return (
    <div className="overlay-section overlay-hero" style={{ opacity }}>
      <div className="overlay-hero__headline">
        <h1 className="headline-large">
          I build things<br />
          <em>AI has never<br />built before.</em>
        </h1>
      </div>
      <div className="overlay-hero__body">
        <p className="body-small">
          Zak — AI creator pushing the edge<br />
          of generative media, 3D and<br />
          interactive experience.
        </p>
        <div className="overlay-hero__meta">
          <span className="label-tiny">Available for projects</span>
          <span className="label-tiny">·</span>
          <span className="label-tiny">2024</span>
        </div>
      </div>
    </div>
  )
}

// Section 1 — Craft / About
function CraftText({ progress, visible }) {
  const opacity = visible ? Math.min(1, progress * 4) * Math.max(0, 1 - (progress - 0.8) * 10) : 0
  const offsetX = visible ? (1 - Math.min(1, progress * 4)) * -30 : -30
  return (
    <div className="overlay-section overlay-details" style={{ opacity, transform: `translateX(${offsetX}px)` }}>
      <div className="overlay-details__left">
        <span className="label-tiny overlay-details__number">ZAK</span>
        <h2 className="headline-medium">
          AI Creator<br />
          <em>&amp; Generative<br />Artist</em>
        </h2>
        <div className="overlay-details__specs">
          <div className="spec-row">
            <span className="spec-label">Focus</span>
            <span className="spec-value">AI-driven 3D & video</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">Tools</span>
            <span className="spec-value">Higgsfield, Meshy, R3F</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">Style</span>
            <span className="spec-value">Dark, cinematic, precise</span>
          </div>
        </div>
        <div className="overlay-details__desc">
          <p className="body-small">
            I work at the intersection of artificial
            intelligence and creative direction —
            producing visuals, experiences and
            worlds that feel genuinely new.
          </p>
          <p className="body-small" style={{ marginTop: '0.75rem' }}>
            Every project starts with a question
            machines haven't answered yet.
          </p>
        </div>
      </div>
    </div>
  )
}

// Section 2 — Work / CTA
function WorkText({ progress, visible }) {
  const opacity = visible ? Math.min(1, progress * 4) : 0
  const offsetY = visible ? (1 - Math.min(1, progress * 4)) * 20 : 20
  return (
    <div className="overlay-section overlay-discovery" style={{ opacity, transform: `translateY(${offsetY}px)` }}>
      <div className="overlay-discovery__left">
        <span className="label-tiny">Selected work</span>
        <h2 className="headline-medium">
          Creating at the<br />
          <em>frontier of what<br />AI can make</em>
        </h2>
      </div>
      <div className="overlay-discovery__columns">
        <div className="discovery-col">
          <p className="body-small">
            Generative 3D characters,
            cinematic AI video, interactive
            web experiences and brand
            identities built with AI-first tools.
          </p>
        </div>
        <div className="discovery-col">
          <p className="body-small">
            Open to collaborations,
            commissions and experiments.
            If you have an idea that needs
            a creative partner — let's talk.
          </p>
          <a href="#" className="cta-link" onClick={e => e.preventDefault()}>
            Get in touch →
          </a>
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
      <CraftText
        progress={section === 1 ? progress : section > 1 ? 1 : 0}
        visible={section === 1 || (section === 0 && progress > 0.6)}
      />
      <WorkText
        progress={section === 2 ? progress : 0}
        visible={section === 2 || (section === 1 && progress > 0.7)}
      />
    </div>
  )
}
