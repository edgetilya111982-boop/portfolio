import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './WorksPage.css'

const WORKS_DATA = {
  animation: [
    {
      id: 'w01',
      title: 'Анимация',
      tools: 'Higgsfield AI',
      desc: 'AI-анимация, где каждый кадр рождается из идеи — без рук, только воображение.',
      video: `${import.meta.env.BASE_URL}work_01.mp4`,
    },
    {
      id: 'w02',
      title: 'Рекламный ролик',
      tools: 'Higgsfield AI',
      desc: 'Кинематографичный ролик, созданный целиком инструментами генеративного ИИ.',
      video: `${import.meta.env.BASE_URL}work_02.mp4`,
    },
  ],
  art: [],
  music: [],
}

const CAT_META = {
  animation: { label: 'Анимация видео', accent: '#38d9ff' },
  art:       { label: 'Арт визуал',     accent: '#c084fc' },
  music:     { label: 'Музыка',         accent: '#4da6ff' },
}

function WorkCard({ work, accent, active, onSelect }) {
  const videoRef = useRef(null)
  const modalRef = useRef(null)
  const [modal, setModal] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (active) {
      v.play().catch(() => {})
    } else {
      v.pause()
      v.currentTime = 0
    }
  }, [active])

  const openModal = () => (active ? setModal(true) : onSelect())
  const closeModal = () => {
    if (modalRef.current) { modalRef.current.pause(); modalRef.current.muted = true }
    setModal(false)
  }

  return (
    <>
      {modal && createPortal(
        <div className="wp-modal" onClick={closeModal}>
          <video
            ref={modalRef}
            className="wp-modal__video"
            src={work.video}
            autoPlay
            playsInline
            controls
            onClick={e => e.stopPropagation()}
          />
          <button className="wp-modal__close" onClick={closeModal}>✕&nbsp;&nbsp;Закрыть</button>
        </div>,
        document.body
      )}

      <div
        className={`wp-card${active ? ' wp-card--active' : ''}`}
        style={{ '--accent': accent }}
        onClick={openModal}
      >
        <video
          ref={videoRef}
          className="wp-card__video"
          src={work.video}
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="wp-card__overlay">
          <div className="wp-card__info">
            <h3 className="wp-card__title">{work.title}</h3>
            <span className="wp-card__tools">{work.tools}</span>
          </div>
          <span className="wp-card__play">▷</span>
        </div>
        <div className="wp-card__stripe" />
      </div>
    </>
  )
}

export default function WorksPage({ category, onClose }) {
  const meta = CAT_META[category] || CAT_META.animation
  const works = WORKS_DATA[category] || []
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)

  const goTo = useCallback((i) => {
    const track = trackRef.current
    const el = track && track.children[i]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const handleScroll = () => {
    const track = trackRef.current
    if (!track) return
    const mid = track.scrollTop + track.clientHeight / 2
    let best = 0
    let bestDist = Infinity
    Array.from(track.children).forEach((el, i) => {
      const d = Math.abs(el.offsetTop + el.offsetHeight / 2 - mid)
      if (d < bestDist) { bestDist = d; best = i }
    })
    setActive(best)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); goTo(Math.min(active + 1, works.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); goTo(Math.max(active - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, works.length, goTo])

  return (
    <div
      className="works-page"
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(4,8,22,0.55) 0%, rgba(4,8,22,0.1) 60%), url(${import.meta.env.BASE_URL}works_bg.webp)`,
      }}
      onWheel={e => e.stopPropagation()}
    >
      <div className="works-page__header">
        <button className="works-page__back" onClick={onClose}>← Назад</button>
        <h1 className="works-page__title" style={{ color: meta.accent }}>{meta.label}</h1>
      </div>

      <div className="works-page__body">
        {works.length === 0 ? (
          <div className="works-page__empty">
            <span className="works-page__empty-icon">◈</span>
            <p className="works-page__empty-text">Работы скоро появятся</p>
          </div>
        ) : (
          <div className="works-carousel">
            <div className="works-carousel__track" ref={trackRef} onScroll={handleScroll}>
              {works.map((w, i) => (
                <WorkCard
                  key={w.id}
                  work={w}
                  accent={meta.accent}
                  active={i === active}
                  onSelect={() => goTo(i)}
                />
              ))}
            </div>
            <div className="works-carousel__nav">
              <button
                className="works-carousel__arrow"
                onClick={() => goTo(Math.max(active - 1, 0))}
                disabled={active === 0}
                aria-label="Предыдущая работа"
              >↑</button>
              <div className="works-carousel__dots">
                {works.map((w, i) => (
                  <button
                    key={w.id}
                    className={`works-carousel__dot${i === active ? ' is-active' : ''}`}
                    style={{ '--accent': meta.accent }}
                    onClick={() => goTo(i)}
                    aria-label={`Работа ${i + 1}`}
                  />
                ))}
              </div>
              <button
                className="works-carousel__arrow"
                onClick={() => goTo(Math.min(active + 1, works.length - 1))}
                disabled={active === works.length - 1}
                aria-label="Следующая работа"
              >↓</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
