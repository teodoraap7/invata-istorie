import { formatDuration } from './format'

/** Textul în română pentru fiecare tip de eveniment (în cronologia din panou). */
export const EVENT_LABELS = {
  start: 'A început lecția',
  overview_listen: 'A ascultat lecția completă',
  overview_done: 'A citit lecția completă și a trecut la învățare',
  read_listen: 'A ascultat bucata (la citire)',
  read_done: 'A terminat de citit',
  read_too_fast: 'A citit prea repede — i s-a cerut să recitească',
  first_key: 'A început să scrie',
  copy_check: 'Verificare (scris după text)',
  copy_ok: 'A copiat corect bucata',
  copy_skipped: 'Copiere sărită (mod rapid)',
  recall_check: 'Încercare din memorie',
  recall_ok: 'A scris bucata din memorie',
  show: 'A cerut să VADĂ textul',
  listen: 'A cerut să ASCULTE textul',
  again_added: 'Programată încă o rundă de scris din memorie',
  again_ok: 'A rescris-o din memorie',
  paste_blocked: 'A încercat să lipească text',
  away_start: 'A ieșit din aplicație',
  away_end: 'S-a întors în aplicație',
  fast_on: 'Mod rapid pornit (merge bine)',
  fast_off: 'Mod rapid oprit',
  repeat_added: 'Bucată programată pentru repetare',
  repeats_start: 'Începe repetarea bucăților grele',
  repeat_ok: 'Bucata repetată, scrisă corect',
  final_check: 'Recapitulare: verificare',
  final_show: 'Recapitulare: a cerut să VADĂ',
  final_listen: 'Recapitulare: a cerut să ASCULTE',
  final_ok: 'A scris toată lecția',
  quiz_answer: 'A răspuns la o întrebare',
  done: 'A terminat lecția',
  abandon: 'A oprit lecția înainte de final',
  dev_jump: '🧪 Salt (mod de test)',
}

export function eventDetail(e) {
  const parts = []
  if (e.chunk != null) parts.push(`bucata ${e.chunk + 1}`)
  if (e.accuracy != null) parts.push(`${e.accuracy}% corect`)
  if (e.missing) parts.push(`${e.missing} cuvinte lipsă`)
  if (e.type === 'quiz_answer') parts.push(e.correct ? 'corect' : 'greșit')
  if (e.ms != null) parts.push(formatDuration(e.ms))
  if (e.firstTry) parts.push('din prima')
  if (e.round) parts.push(`runda ${e.round}${e.of ? ` din ${e.of}` : ''}`)
  return parts.join(' · ')
}

export function clock(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
