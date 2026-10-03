import React from 'react'
import './GridLines.css'

export default function GridLines({ count = 8 }) {
  return (
    <div className="grid-lines" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="grid-line" />
      ))}
    </div>
  )
}
