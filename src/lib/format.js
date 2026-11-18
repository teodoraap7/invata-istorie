import { wordCount } from './compare'

/** 83000 -> „1 min 23 s” */
export function formatDuration(ms) {
  const s = Math.round(Math.max(0, ms || 0) / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m} min${r ? ` ${r} s` : ''}`
}

/** Cât timp arătăm textul când elevul apasă „Arată-mi”: 3,5–12 s, după lungime. */
export function showDuration(text) {
  return Math.min(12000, Math.max(3500, 2500 + wordCount(text) * 180))
}
