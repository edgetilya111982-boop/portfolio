import React from 'react'
import './Navigation.css'

const NAV_LINKS = ['Home', 'Collection', 'Artists', 'Events', 'Visit']

export default function Navigation() {
  return (
    <nav className="nav">
      <div className="nav__logo">
        <span className="nav__logo-mark">◈</span>
        <div className="nav__logo-text">
          <span className="nav__logo-name">FUTURA</span>
          <span className="nav__logo-sub">MUSEUM</span>
        </div>
      </div>
      <ul className="nav__links">
        {NAV_LINKS.map((link, i) => (
          <li key={link}>
            <a
              href="#"
              className={`nav__link ${i === 0 ? 'nav__link--active' : ''}`}
              onClick={e => e.preventDefault()}
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
      <div className="nav__cta">
        <button className="nav__btn">Explore Collection</button>
      </div>
    </nav>
  )
}
