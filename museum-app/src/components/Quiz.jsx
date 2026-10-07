import React, { useState, useEffect, useRef } from 'react'
import './Quiz.css'
import quizConfig from '../data/quiz-config.json'

const TG_TOKEN = import.meta.env.VITE_TG_TOKEN
const TG_CHAT  = import.meta.env.VITE_TG_CHAT || '@zakinsk'

const TYPE_OPTIONS = [
  { id: 'animation', label: 'Анимация' },
  { id: 'ad',        label: 'Рекламный ролик' },
  { id: 'clip',      label: 'Музыкальный клип' },
  { id: 'art',       label: 'Арт-проект' },
  { id: 'other',     label: 'Другое' },
]

const GOAL_OPTIONS = [
  { id: 'social',    label: 'Социальные сети' },
  { id: 'brand',     label: 'Реклама бренда' },
  { id: 'personal',  label: 'Личный проект' },
  { id: 'event',     label: 'Мероприятие / ивент' },
  { id: 'other',     label: 'Другое' },
]

const TIMING_OPTIONS = [
  { id: 'urgent',  label: 'Срочно',               sub: 'до 2 недель' },
  { id: 'month',   label: 'В течение месяца',      sub: '2–4 недели' },
  { id: 'quarter', label: '1–3 месяца',            sub: 'без спешки' },
  { id: 'open',    label: 'Пока не определился',   sub: '' },
]

const MOODS    = ['Драматичное', 'Лёгкое', 'Эпическое', 'Медитативное', 'Энергичное']
const BUDGETS  = ['до $200', '$200–500', '$500–1500', '$1500+', 'Обсудим']
const CHANNELS = ['Instagram', 'YouTube', 'TikTok', 'Offline / ТВ', 'Другое']

// Steps: 0=type, 1=goal, 2=timing, 3=styles(B), 4=details(C), 5=result
const TOTAL_INPUT_STEPS = 4

async function sendFilesToTelegram(files) {
  for (const file of files) {
    const form = new FormData()
    form.append('chat_id', TG_CHAT)
    form.append('document', file, file.name)
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendDocument`, {
      method: 'POST',
      body: form,
    })
  }
}

async function sendBriefToTelegram(answers) {
  const lines = [
    '📋 <b>Новый бриф с сайта</b>',
    '',
    `🎯 <b>Что создаём:</b> ${answers.type}`,
    `📌 <b>Цель:</b> ${answers.goal}`,
    `⏰ <b>Срок:</b> ${answers.timing}`,
    answers.styles.length > 0 ? `🎨 <b>Стили:</b> ${answers.styles.join(', ')}` : null,
    answers.audience ? `👥 <b>Аудитория:</b> ${answers.audience}` : null,
    answers.mood     ? `🎭 <b>Настроение:</b> ${answers.mood}` : null,
    answers.budget   ? `💰 <b>Бюджет:</b> ${answers.budget}` : null,
    answers.channels.length > 0 ? `📺 <b>Каналы:</b> ${answers.channels.join(', ')}` : null,
    answers.comment  ? `💬 <b>Комментарий:</b> ${answers.comment}` : null,
    answers.files?.length > 0 ? `📎 <b>Файлов:</b> ${answers.files.length}` : null,
  ].filter(Boolean).join('\n')

  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: lines, parse_mode: 'HTML' }),
  })
  if (!res.ok) throw new Error('Telegram error')
  if (answers.files?.length > 0) {
    await sendFilesToTelegram(answers.files)
  }
}

// ── Card: single select ──────────────────────────────────────────────────────
function CardOption({ label, sub, selected, onClick }) {
  return (
    <button
      type="button"
      className={`quiz-card ${selected ? 'quiz-card--selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="quiz-card__label">{label}</span>
      {sub && <span className="quiz-card__sub">{sub}</span>}
    </button>
  )
}

// ── Step A1: What to create ──────────────────────────────────────────────────
function StepType({ selected, onSelect }) {
  return (
    <div className="quiz-step">
      <p className="quiz-step__num label-tiny">Блок A · 1 из 3</p>
      <h2 className="quiz-step__q">Что вы хотите создать?</h2>
      <div className="quiz-cards quiz-cards--list">
        {TYPE_OPTIONS.map(o => (
          <CardOption
            key={o.id}
            label={o.label}
            selected={selected === o.label}
            onClick={() => onSelect(o.label)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step A2: Goal ────────────────────────────────────────────────────────────
function StepGoal({ selected, onSelect }) {
  return (
    <div className="quiz-step">
      <p className="quiz-step__num label-tiny">Блок A · 2 из 3</p>
      <h2 className="quiz-step__q">Для чего нужен этот контент?</h2>
      <div className="quiz-cards quiz-cards--list">
        {GOAL_OPTIONS.map(o => (
          <CardOption
            key={o.id}
            label={o.label}
            selected={selected === o.label}
            onClick={() => onSelect(o.label)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step A3: Timing ──────────────────────────────────────────────────────────
function StepTiming({ selected, onSelect }) {
  return (
    <div className="quiz-step">
      <p className="quiz-step__num label-tiny">Блок A · 3 из 3</p>
      <h2 className="quiz-step__q">Когда нужен результат?</h2>
      <div className="quiz-cards quiz-cards--list">
        {TIMING_OPTIONS.map(o => (
          <CardOption
            key={o.id}
            label={o.label}
            sub={o.sub}
            selected={selected === o.label}
            onClick={() => onSelect(o.label)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step B: Style grid ───────────────────────────────────────────────────────
function StepStyles({ styles, selected, onToggle, onHover, onLeave }) {
  return (
    <div className="quiz-step">
      <p className="quiz-step__num label-tiny">Блок B · Необязательно</p>
      <h2 className="quiz-step__q">Выберите близкие визуальные стили</h2>
      <p className="quiz-step__hint">Можно несколько. Ассеты обновятся позже — сейчас это цветовые маяки.</p>
      <div className="quiz-cards quiz-cards--grid">
        {styles.map(s => (
          <button
            key={s.id}
            type="button"
            className={`quiz-style-card ${selected.includes(s.label) ? 'quiz-style-card--selected' : ''}`}
            style={{ background: s.gradient }}
            onClick={() => onToggle(s.label)}
            onMouseEnter={() => onHover(s.audio)}
            onMouseLeave={onLeave}
            aria-pressed={selected.includes(s.label)}
          >
            <span className="quiz-style-card__label">{s.label}</span>
            <span className="quiz-style-card__desc">{s.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Step C: Details ──────────────────────────────────────────────────────────
function StepDetails({ answers, onChange, onToggleChannel }) {
  return (
    <div className="quiz-step">
      <p className="quiz-step__num label-tiny">Блок C · Необязательно</p>
      <h2 className="quiz-step__q">Расскажите чуть больше</h2>

      <div className="quiz-details">
        <div className="quiz-details__field">
          <label className="label-tiny">Целевая аудитория</label>
          <input
            className="quiz-input"
            type="text"
            placeholder="Например: молодёжь 18–25, B2B клиенты..."
            value={answers.audience}
            onChange={e => onChange('audience', e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="quiz-details__field">
          <label className="label-tiny">Настроение / атмосфера</label>
          <div className="quiz-chips">
            {MOODS.map(m => (
              <button
                key={m}
                type="button"
                className={`quiz-chip ${answers.mood === m ? 'quiz-chip--active' : ''}`}
                onClick={() => onChange('mood', answers.mood === m ? '' : m)}
                aria-pressed={answers.mood === m}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-details__field">
          <label className="label-tiny">Ориентировочный бюджет</label>
          <div className="quiz-chips">
            {BUDGETS.map(b => (
              <button
                key={b}
                type="button"
                className={`quiz-chip ${answers.budget === b ? 'quiz-chip--active' : ''}`}
                onClick={() => onChange('budget', answers.budget === b ? '' : b)}
                aria-pressed={answers.budget === b}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-details__field">
          <label className="label-tiny">Платформа / канал публикации</label>
          <div className="quiz-chips">
            {CHANNELS.map(c => (
              <button
                key={c}
                type="button"
                className={`quiz-chip ${answers.channels.includes(c) ? 'quiz-chip--active' : ''}`}
                onClick={() => onToggleChannel(c)}
                aria-pressed={answers.channels.includes(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-details__field">
          <label className="label-tiny">Дополнительно</label>
          <textarea
            className="quiz-input quiz-input--textarea"
            placeholder="Особые пожелания, детали проекта..."
            value={answers.comment}
            onChange={e => onChange('comment', e.target.value)}
            maxLength={800}
            rows={3}
          />
        </div>

        <div className="quiz-details__field">
          <label className="label-tiny" htmlFor="quiz-file-upload">Референсы</label>
          <label className="quiz-upload" htmlFor="quiz-file-upload">
            <span className="quiz-upload__icon">↑</span>
            <span className="quiz-upload__text">
              {answers.files.length > 0
                ? `${answers.files.length} файл${answers.files.length > 1 ? (answers.files.length < 5 ? 'а' : 'ов') : ''} выбрано`
                : 'Загрузить изображения или видео'}
            </span>
            <span className="quiz-upload__hint">PNG, JPG, MP4 · до 20 МБ каждый</span>
          </label>
          <input
            id="quiz-file-upload"
            type="file"
            multiple
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={e => onChange('files', Array.from(e.target.files || []))}
          />
          {answers.files.length > 0 && (
            <ul className="quiz-upload__list">
              {answers.files.map((f, i) => (
                <li key={i} className="quiz-upload__item">
                  <span>{f.name}</span>
                  <button
                    type="button"
                    className="quiz-upload__remove"
                    aria-label={`Удалить ${f.name}`}
                    onClick={() => onChange('files', answers.files.filter((_, j) => j !== i))}
                  >×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Result page ──────────────────────────────────────────────────────────────
function StepResult({ rec, onOrder }) {
  return (
    <div className="quiz-step quiz-step--result">
      <p className="quiz-step__num label-tiny">Ваш результат</p>
      <h2 className="quiz-step__q">{rec.title}</h2>
      <p className="quiz-result__body">{rec.body}</p>
      <button className="quiz-result__btn" onClick={onOrder}>
        Оформить заявку →
      </button>
      <p className="quiz-result__note label-tiny">
        Бриф уже отправлен — свяжусь с вами в ближайшее время
      </p>
    </div>
  )
}

// ── Main Quiz component ──────────────────────────────────────────────────────
export default function Quiz({ onClose, onOrder }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({
    type: '', goal: '', timing: '',
    styles: [], audience: '', mood: '',
    budget: '', channels: [], comment: '',
    files: [],
    _hp: '', // honeypot
  })
  const [sent, setSent] = useState(false)
  const audioRef = useRef(null)

  // Auto-send brief when result page appears
  useEffect(() => {
    if (step === 5 && !sent) {
      setSent(true)
      if (!answers._hp) {
        sendBriefToTelegram(answers).catch(() => {})
      }
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = () => {
    if (step === 0) return !!answers.type
    if (step === 1) return !!answers.goal
    if (step === 2) return !!answers.timing
    return true
  }

  const next = () => setStep(s => Math.min(s + 1, 5))
  const back = () => {
    if (step === 0) onClose()
    else setStep(s => s - 1)
  }

  const set = (field, val) => setAnswers(a => ({ ...a, [field]: val }))
  const toggleStyle   = l => setAnswers(a => ({ ...a, styles:   a.styles.includes(l)   ? a.styles.filter(x => x !== l)   : [...a.styles, l]   }))
  const toggleChannel = l => setAnswers(a => ({ ...a, channels: a.channels.includes(l) ? a.channels.filter(x => x !== l) : [...a.channels, l] }))

  const playPreview = src => {
    if (!src) return
    if (audioRef.current) audioRef.current.pause()
    audioRef.current = new Audio(src)
    audioRef.current.volume = 0.4
    audioRef.current.play().catch(() => {})
  }
  const stopPreview = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }

  const getRec = () => {
    const map = { 'Анимация': 'animation', 'Рекламный ролик': 'ad', 'Музыкальный клип': 'clip', 'Арт-проект': 'art' }
    return quizConfig.recommendations[map[answers.type]] || quizConfig.recommendations.default
  }

  const pct = step >= 5 ? 100 : Math.round((step / TOTAL_INPUT_STEPS) * 100)

  return (
    <div className="quiz" role="dialog" aria-modal="true" aria-label="Квиз-бриф">
      {/* Header */}
      <header className="quiz__header">
        <button className="quiz__back" onClick={back} aria-label="Назад">
          ← {step === 0 ? 'Портфолио' : 'Назад'}
        </button>
        {step < 5 && (
          <div
            className="quiz__progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Шаг ${step + 1} из ${TOTAL_INPUT_STEPS + 1}`}
          >
            <div className="quiz__progress-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
        <span className="quiz__step-label label-tiny">
          {step < 5 ? `${step + 1} / ${TOTAL_INPUT_STEPS + 1}` : '✓'}
        </span>
      </header>

      {/* Body */}
      <main className="quiz__body">
        {step === 0 && <StepType    selected={answers.type}   onSelect={v => set('type', v)} />}
        {step === 1 && <StepGoal    selected={answers.goal}   onSelect={v => set('goal', v)} />}
        {step === 2 && <StepTiming  selected={answers.timing} onSelect={v => set('timing', v)} />}
        {step === 3 && (
          <StepStyles
            styles={quizConfig.styles}
            selected={answers.styles}
            onToggle={toggleStyle}
            onHover={playPreview}
            onLeave={stopPreview}
          />
        )}
        {step === 4 && (
          <StepDetails
            answers={answers}
            onChange={set}
            onToggleChannel={toggleChannel}
          />
        )}
        {step === 5 && <StepResult rec={getRec()} onOrder={onOrder} />}
      </main>

      {/* Footer */}
      {step < 5 && (
        <footer className="quiz__footer">
          {(step === 3 || step === 4) && (
            <button className="quiz__skip" onClick={next} type="button">
              Пропустить
            </button>
          )}
          <button
            className="quiz__next"
            onClick={next}
            disabled={!canNext()}
            type="button"
          >
            {step === 4 ? 'Получить результат →' : 'Далее →'}
          </button>
        </footer>
      )}

      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        style={{ position: 'absolute', left: '-9999px', width: '1px', opacity: 0, pointerEvents: 'none' }}
        value={answers._hp}
        onChange={e => set('_hp', e.target.value)}
      />
    </div>
  )
}
