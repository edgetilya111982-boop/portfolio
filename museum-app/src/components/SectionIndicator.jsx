import React from 'react'
import './SectionIndicator.css'

const SECTIONS = ['01 — Hero', '02 — Details', '03 — Discovery']

export default function SectionIndicator({ section }) {
  return (
    <div className="section-indicator">
      {SECTIONS.map((label, i) => (
        <div
          key={i}
          className={`section-dot ${i === section ? 'section-dot--active' : ''}`}
        >
          <span className="section-dot__pip" />
          <span className="section-dot__label">{label}</span>
        </div>
      ))}
    </div>
  )
}
