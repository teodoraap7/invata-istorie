// Comunicarea cu Google Apps Script (Sheet-ul tău).
// Elevul: trimite sesiunea + evenimentele noi. Dacă nu e internet, păstrează local și retrimite.
// Admin: cere datele cu parola (verificată pe server).
import { reactive } from 'vue'
import { summarize } from './summary'

const API_URL = import.meta.env.VITE_API_URL
const PENDING_KEY = 'memorez_pending' // sesiuni netrimise încă
const SENT_KEY = 'memorez_sent_seq' // până la ce eveniment am trimis, pe sesiune

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '') ?? fallback
  } catch {
    return fallback
  }
}
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* fără localStorage — continuăm fără copie locală */
  }
}

async function post(body, { keepalive = false } = {}) {
  if (!API_URL) throw new Error('VITE_API_URL lipsește din .env')
  // text/plain => browserul nu mai face cererea „preflight” pe care Apps Script nu o acceptă
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    keepalive,
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'eroare')
  return data
}

/* ---------------- salvarea sesiunii (elev) ---------------- */

let sending = false
let again = false
export const syncState = reactive({ status: 'idle' }) // 'idle' | 'sending' | 'ok' | 'offline'

/** Apelat de store la fiecare schimbare importantă. Trimite cel mult o cerere odată. */
export function saveRun(run) {
  const pending = readJSON(PENDING_KEY, {})
  pending[run.id] = run
  writeJSON(PENDING_KEY, pending)
  flush()
}

async function flush() {
  if (sending) {
    again = true
    return
  }
  sending = true
  syncState.status = 'sending'
  try {
    do {
      again = false
      const pending = readJSON(PENDING_KEY, {})
      for (const run of Object.values(pending)) await sendOne(run)
    } while (again)
    syncState.status = 'ok'
  } catch {
    syncState.status = 'offline' // rămâne în PENDING și se retrimite la următoarea salvare
  } finally {
    sending = false
  }
}

async function sendOne(run) {
  const sent = readJSON(SENT_KEY, {})
  const lastSeq = sent[run.id] || 0
  const newEvents = (run.events || []).filter((e) => (e.seq || 0) > lastSeq)
  const { events: _omit, ...runWithoutEvents } = run // eslint-disable-line no-unused-vars
  await post(
    { action: 'saveRun', run: runWithoutEvents, newEvents, summary: summarize(run) },
    { keepalive: document.visibilityState === 'hidden' },
  )
  sent[run.id] = run.eventSeq || lastSeq
  writeJSON(SENT_KEY, sent)
  const pending = readJSON(PENDING_KEY, {})
  if (pending[run.id] && (pending[run.id].eventSeq || 0) <= sent[run.id]) delete pending[run.id]
  writeJSON(PENDING_KEY, pending)
}

/** La pornirea aplicației: trimite ce a rămas netrimis data trecută. */
export function retryPending() {
  if (Object.keys(readJSON(PENDING_KEY, {})).length) flush()
}

/* ---------------- lecțiile ---------------- */

export async function fetchLessons() {
  const res = await fetch(`${API_URL}?action=lessons`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error)
  return data.lessons
}

/* ---------------- admin ---------------- */

export async function adminRuns(key) {
  return (await post({ action: 'adminRuns', key })).runs
}

export async function adminRun(key, id) {
  return (await post({ action: 'adminRun', key, id })).run
}
