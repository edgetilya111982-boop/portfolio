import React from 'react'
import './NeonSign.css'

/*
 * One image, several layers (bottom to top):
 *   halo   – soft light the tubes throw on the wall, flickers with them
 *   shadow – the tubes' shadow on the wall, offset down and to the right
 *   off    – the unlit glass
 *   on     – the lit tubes with a layered glow, flickers
 *   glint  – a white highlight that slides along the tubes once per cycle
 */
export default function NeonSign({ src, className = '', style }) {
  return (
    <div className={`neon ${className}`} style={style} aria-hidden="true">
      <div className="neon__halo" />
      <img className="neon__shadow" src={src} alt="" draggable={false} />
      <img className="neon__off" src={src} alt="" draggable={false} />
      <img className="neon__on" src={src} alt="" draggable={false} />
      <img className="neon__glint" src={src} alt="" draggable={false} />
    </div>
  )
}
