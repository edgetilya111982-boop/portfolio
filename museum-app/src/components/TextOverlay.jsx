import React, { useState } from 'react'
import './TextOverlay.css'

const CATEGORIES = [
  {
    id: 'animation',
    num: '01',
    label: 'Анимация\nвидео',
    sub: 'AI motion & video',
    accent: '#38d9ff',
  },
  {
    id: 'art',
    num: '02',
    label: 'Арт\nвизуал',
    sub: 'Generative art',
    accent: '#c084fc',
  },
  {
    id: 'music',
    num: '03',
    label: 'Музыка',
    sub: 'AI sound design',
    accent: '#f59e0b',
  },
]

// Section 0 — Hero
function HeroText({ opacity }) {
  return (
    <div className="overlay-section overlay-hero" style={{ opacity }}>
      <div className="overlay-hero__headline">
        <h1 className="headline-large">
          Я создаю образы,<br />
          которые ИИ<br />
          <span className="hero-accent">ещё не видел.</span>
        </h1>
      </div>
      <div className="overlay-hero__body">
        <p className="body-small">
          Zak — AI-дизайнер, саунд-дизайнер<br />
          и автор визуального контента.<br />
          Строю будущее инструментами ИИ.
        </p>
        <div className="overlay-hero__meta">
          <span className="label-tiny">Открыт к проектам</span>
          <span className="label-tiny">·</span>
          <span className="label-tiny">2026</span>
        </div>
      </div>
    </div>
  )
}

// Section 1 — Category cards
function CategoryCards({ opacity, onOpenCategory }) {
  return (
    <div
      className="overlay-section overlay-categories"
      style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}
    >
      <div className="categories-grid">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className="cat-card"
            style={{ '--cat-accent': cat.accent }}
            onClick={() => onOpenCategory(cat.id)}
          >
            <div className="cat-card__glow" />
            <span className="cat-card__num label-tiny">{cat.num}</span>
            <div className="cat-card__bottom">
              <h2 className="cat-card__name">{cat.label}</h2>
              <span className="cat-card__sub label-tiny">{cat.sub}</span>
            </div>
            <span className="cat-card__arrow">→</span>
            <div className="cat-card__stripe" />
          </button>
        ))}
      </div>
    </div>
  )
}


const TG_TOKEN = import.meta.env.VITE_TG_TOKEN
const TG_CHAT  = import.meta.env.VITE_TG_CHAT || '@zakinsk'

async function sendToTelegram(name, contact, message) {
  const text =
    `🎨 <b>Новая заявка с сайта</b>\n\n` +
    `👤 <b>Имя:</b> ${name}\n` +
    `📱 <b>Контакт:</b> ${contact}\n` +
    `💬 <b>Проект:</b> ${message}`
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) throw new Error('Telegram error')
}

// Section 2 — Contacts
function ContactText({ opacity, onOpenQuiz }) {
  const [name,    setName]    = useState('')
  const [contact, setContact] = useState('')
  const [msg,     setMsg]     = useState('')
  const [status,  setStatus]  = useState('idle')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !contact.trim() || !msg.trim()) return
    setStatus('sending')
    try {
      await sendToTelegram(name.trim(), contact.trim(), msg.trim())
      setStatus('ok')
      setName(''); setContact(''); setMsg('')
    } catch {
      setStatus('err')
    }
  }

  return (
    <div className="overlay-section overlay-contact" style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}>
      <div className="contact-inner">
        <h2 className="headline-large contact-headline">
          Создадим <span className="hero-accent">что‑то невероятное</span>
        </h2>

        <div className="contact-links-row">
          <a href="https://t.me/zakinskiy" className="contact-link-inline" target="_blank" rel="noreferrer">
            <span className="label-tiny">TG</span>
            <span className="contact-link__value">@zakinskiy</span>
          </a>
          <span className="contact-sep">·</span>
          <a href="mailto:qeepil@bk.ru" className="contact-link-inline">
            <span className="label-tiny">Email</span>
            <span className="contact-link__value">qeepil@bk.ru</span>
          </a>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="contact-form__row">
            <div className="contact-form__field">
              <label className="label-tiny">Ваше имя</label>
              <input
                className="contact-form__input"
                type="text"
                placeholder="Иван"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={status === 'sending'}
                maxLength={80}
              />
            </div>
            <div className="contact-form__field">
              <label className="label-tiny">Telegram / телефон</label>
              <input
                className="contact-form__input"
                type="text"
                placeholder="@username или +7..."
                value={contact}
                onChange={e => setContact(e.target.value)}
                disabled={status === 'sending'}
                maxLength={80}
              />
            </div>
          </div>
          <div className="contact-form__field">
            <label className="label-tiny">О проекте</label>
            <textarea
              className="contact-form__input contact-form__textarea"
              placeholder="Расскажите, что хотите создать..."
              value={msg}
              onChange={e => setMsg(e.target.value)}
              disabled={status === 'sending'}
              maxLength={1000}
              rows={2}
            />
          </div>

          {status === 'ok' && (
            <p className="contact-form__feedback contact-form__feedback--ok">
              ✓ Заявка отправлена — скоро свяжусь
            </p>
          )}
          {status === 'err' && (
            <p className="contact-form__feedback contact-form__feedback--err">
              Ошибка отправки — напишите напрямую в Telegram
            </p>
          )}

          <button
            className="contact-form__btn"
            type="submit"
            disabled={status === 'sending' || !name.trim() || !contact.trim() || !msg.trim()}
          >
            {status === 'sending' ? 'Отправка...' : 'Отправить заявку →'}
          </button>
        </form>

        <div className="contact-quiz-alt">
          <span className="contact-sep">или</span>
          <button className="contact-quiz-btn" type="button" onClick={onOpenQuiz}>
            Заполнить бриф →
          </button>
          <span className="label-tiny" style={{ color: 'rgba(184,204,224,0.5)' }}>
            поможет точнее сформулировать задачу
          </span>
        </div>
      </div>
    </div>
  )
}

export default function TextOverlay({ scrollData, onOpenQuiz, onOpenCategory }) {
  const { raw } = scrollData
  const heroOp    = Math.max(0, 1 - Math.abs(raw - 0) * 2.5)
  const worksOp   = Math.max(0, 1 - Math.abs(raw - 1) * 2.5)
  const contactOp = Math.max(0, 1 - Math.abs(raw - 2) * 2.5)

  return (
    <div className="text-overlay">
      <HeroText opacity={heroOp} />
      <CategoryCards opacity={worksOp} onOpenCategory={onOpenCategory} />
      <ContactText opacity={contactOp} onOpenQuiz={onOpenQuiz} />
    </div>
  )
}
