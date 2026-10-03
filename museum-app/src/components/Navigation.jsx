import React from 'react'
import './Navigation.css'

const NAV_LINKS = [
  { label: 'Главная', section: 0 },
  { label: 'Работы',  section: 1 },
  { label: 'Обо мне', section: 0 },
  { label: 'Контакты', section: 2 },
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
          <span className="nav__logo-sub">AI-ДИЗАЙНЕР</span>
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
        <button className="nav__btn" onClick={() => goto(2)}>Создадим вместе →</button>
      </div>
    </nav>
  )
}
