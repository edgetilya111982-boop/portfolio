import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './TextOverlay.css'

const WORKS = [
  {
    num: '01',
    title: 'Анимация',
    tools: 'Higgsfield AI',
    desc: 'AI-анимация, где каждый кадр рождается из идеи — без рук, только воображение',
    video: `${import.meta.env.BASE_URL}work_01.mp4`,
  },
  {
    num: '02',
    title: 'Рекламный ролик',
    tools: 'Higgsfield AI',
    desc: 'Кинематографичный ролик, созданный целиком инструментами генеративного ИИ',
    video: `${import.meta.env.BASE_URL}work_02.mp4`,
  },
]

// Section 0 — Hero
function HeroText({ opacity }) {
  return (
    <div className="overlay-section overlay-hero" style={{ opacity }}>
      <div className="overlay-hero__headline">
        <h1 className="headline-large">
          Я создаю образы<br />
          по вашим<br />
          <span className="hero-accent">Желаниям</span>
        </h1>
      </div>
      <div className="overlay-hero__body">
        <p className="body-small">
          Zak — AI-creator, саунд-дизайнер<br />
          и автор визуального контента<br />
          Строю будущее инструментами ИИ
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

// Section 1 — Works carousel
function WorksText({ opacity }) {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [modal, setModal] = useState(false)
  const videoRef = useRef(null)
  const modalVideoRef = useRef(null)

  // Start loading video only when section becomes visible
  useEffect(() => {
    if (opacity > 0.1 && !loaded) setLoaded(true)
  }, [opacity, loaded])

  // Play/pause preview video (always muted, pause when modal open)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = true
    if (!modal && opacity > 0.3) { v.play().catch(() => {}) }
    else v.pause()
  }, [opacity, modal])

  // Play modal video with sound when modal opens
  useEffect(() => {
    if (!modal) return
    const mv = modalVideoRef.current
    if (!mv) return
    mv.muted = false
    mv.volume = 1
    mv.currentTime = 0
    mv.play().catch(() => {})
  }, [modal])

  const prev = () => setCurrent(i => (i - 1 + WORKS.length) % WORKS.length)
  const next = () => setCurrent(i => (i + 1) % WORKS.length)
  const w = WORKS[current]

  const closeModal = () => {
    if (modalVideoRef.current) {
      modalVideoRef.current.pause()
      modalVideoRef.current.muted = true
    }
    setModal(false)
  }

  const handleVideoClick = () => setModal(true)

  return (
    <>
      {modal && createPortal(
        <div className="video-modal" onClick={closeModal}>
          <video
            ref={modalVideoRef}
            className="video-modal__video"
            src={w.video}
            playsInline
            onClick={e => e.stopPropagation()}
          />
          <button
            className="video-modal__close"
            onClick={closeModal}
            aria-label="Закрыть"
          >
            ✕&nbsp;&nbsp;Закрыть
          </button>
        </div>,
        document.body
      )}

      <div
        className="overlay-section overlay-works"
        style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}
      >
        <div className="works-header">
          <span className="label-tiny">Избранные работы</span>
          <span className="label-tiny works-counter">{current + 1} / {WORKS.length}</span>
        </div>

        <div className="works-card">
          <div className="works-card__video-wrap" onClick={handleVideoClick}>
            <video
              ref={videoRef}
              className="works-card__video"
              src={loaded ? w.video : undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              key={w.video}
            />
            <div className="works-card__fullscreen-hint">⛶</div>
          </div>
          <div className="works-card__info">
            <span className="works-card__num label-tiny">{w.num}</span>
            <h2 className="works-card__title headline-medium">{w.title}</h2>
            <span className="works-card__tools label-tiny">{w.tools}</span>
            <p className="works-card__desc body-small">{w.desc}</p>
          </div>
        </div>

        <div className="works-nav">
          <button className="works-nav__btn" onClick={prev} aria-label="Назад">←</button>
          <div className="works-nav__dots">
            {WORKS.map((_, i) => (
              <button
                key={i}
                className={`works-nav__dot ${i === current ? 'works-nav__dot--active' : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`Работа ${i + 1}`}
              />
            ))}
          </div>
          <button className="works-nav__btn" onClick={next} aria-label="Вперёд">→</button>
        </div>
      </div>
    </>
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
function ContactText({ opacity }) {
  const [name,    setName]    = useState('')
  const [contact, setContact] = useState('')
  const [msg,     setMsg]     = useState('')
  const [status,  setStatus]  = useState('idle') // idle | sending | ok | err

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
      </div>
    </div>
  )
}

export default function TextOverlay({ scrollData }) {
  const { raw } = scrollData
  const heroOp    = Math.max(0, 1 - Math.abs(raw - 0) * 2.5)
  const worksOp   = Math.max(0, 1 - Math.abs(raw - 1) * 2.5)
  const contactOp = Math.max(0, 1 - Math.abs(raw - 2) * 2.5)

  return (
    <div className="text-overlay">
      <HeroText opacity={heroOp} />
      <WorksText opacity={worksOp} />
      <ContactText opacity={contactOp} />
    </div>
  )
}
