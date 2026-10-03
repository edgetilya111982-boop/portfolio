import React from 'react'
import './Navigation.css'

const NAV_LINKS = [
  { label: 'Home',    section: 0 },
  { label: 'Work',    section: 1 },
  { label: 'About',   section: 0 },
  { label: 'Tools',   section: 1 },
  { label: 'Contact', section: 2 },
]

function goto(index) {
  window.dispatchEvent(new CustomEvent('goto-section', { detail: { index } }))
}

export default function Navigation() {
  return (
    <nav className="nav">
      <div className="nav__logo" onClick={() => goto(0)} style={{ cursor: 'pointer' }}>
        <span className="nav__logo-mark">◈</span>
        <div className="nav__logo-text">
          <span className="nav__logo-name">ZAK</span>
          <span className="nav__logo-sub">AI CREATOR</span>
        </div>
      </div>
      <ul className="nav__links">
        {NAV_LINKS.map(({ label, section }) => (
          <li key={label}>
            <a
              href="#"
              className="nav__link"
              onClick={e => { e.preventDefault(); goto(section) }}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      <div className="nav__cta">
        <button className="nav__btn" onClick={() => goto(2)}>Let's create →</button>
      </div>
    </nav>
  )
}
