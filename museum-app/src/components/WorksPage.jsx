import React, { useState, useRef } from 'react'
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
  music:     { label: 'Музыка',         accent: '#f59e0b' },
}

function WorkCard({ work, accent }) {
  const videoRef = useRef(null)
  const modalRef = useRef(null)
  const [modal, setModal] = useState(false)

  const handleEnter = () => {
    if (videoRef.current) videoRef.current.play().catch(() => {})
  }
  const handleLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }
  const openModal = () => setModal(true)
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
        className="wp-card"
        style={{ '--accent': accent }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={openModal}
      >
        <video
          ref={videoRef}
          className="wp-card__video"
          src={work.video}
          muted
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

  return (
    <div className="works-page" onWheel={e => e.stopPropagation()}>
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
          <div className="works-page__grid">
            {works.map(w => (
              <WorkCard key={w.id} work={w} accent={meta.accent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
