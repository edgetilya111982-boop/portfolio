import React from 'react'
import './NeonSign.css'

// One image drawn twice: a dim "unlit" copy underneath and a glowing copy on top that flickers.
export default function NeonSign({ src, className = '', style }) {
  return (
    <div className={`neon ${className}`} style={style} aria-hidden="true">
      <img className="neon__off" src={src} alt="" draggable={false} />
      <img className="neon__on" src={src} alt="" draggable={false} />
    </div>
  )
}
