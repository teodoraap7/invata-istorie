// Starea unei sesiuni de învățare: ce pas urmează, cronometre, încercări,
// ajutoare cerute și jurnalul complet de evenimente (care ajunge la tine).
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { compareText, wordCount, checkAnswer, PASS_THRESHOLD } from '@/lib/compare'
import { buildQuiz, relatedChunk } from '@/lib/quiz'
import { saveRun } from '@/lib/api'

/** Sub atâtea ms pe cuvânt considerăm că a citit „prea repede”. */
const MIN_READ_MS_PER_WORD = 220
/** De la atâtea încercări o bucată e „grea” și se repetă. */
const HARD_ATTEMPTS = 3
/** De la atâtea ajutoare (vezi + ascultă) o bucată e „grea”. */
const HARD_HELPS = 2
/** După atâtea bucăți la rând scrise din prima, sărim peste copiere. */
const FAST_STREAK = 2
/**
 * Scrisul repetat din memorie, după ce a reușit o bucată:
 *  - a scris-o din prima, fără ajutor  -> o mai scrie de 1 dată  (total minim 2)
 *  - altfel (mai multe încercări sau ajutor) -> o mai scrie de 2 ori (total minim 3)
 *  - fiecare rundă în plus care nu iese din prima, fără ajutor -> încă +1
 */
const AGAIN_IF_CLEAN = 1
const AGAIN_IF_NOT_CLEAN = 2
const MAX_AGAIN = 5
const MAX_EVENTS = 700

const newCounters = () => ({
  attempts: 0,
  shows: 0,
  showMs: 0,
  listens: 0,
  pastes: 0,
  firstKeyMs: null,
  accuracy: [],
  hints: {},
  lastText: null, // ultimul text verificat (ca să nu numărăm de 2 ori același text)
  lastResult: null,
})

export const useSessionStore = defineStore('session', () => {
  const lesson = ref(null)
  const run = ref(null)
  const queue = ref([])
  const pos = ref(0)
  const fastMode = ref(false)
  const streak = ref(0)
  const struggled = ref([])
  const cur = ref(newCounters())
  const quiz = ref([])
  const quizIndex = ref(0)

  // cronometre (nu trebuie să fie reactive)
  let stepStart = 0
  let stepAway = 0
  let hiddenAt = null
  let quizStart = 0
  let readWarned = false

  /* ---------- getters ---------- */
  const step = computed(() => queue.value[pos.value] ?? null)
  const chunkText = computed(() =>
    step.value?.chunk != null ? lesson.value.chunks[step.value.chunk] : '',
  )
  const fullText = computed(() => (lesson.value ? lesson.value.chunks.join(' ') : ''))
  // enumerările care se pot scrie în orice ordine (din parantezele [ ] ale lecției)
  const chunkGroups = computed(() => (step.value?.chunk != null ? lesson.value.groups?.[step.value.chunk] || [] : []))
  const allGroups = computed(() => (lesson.value?.groups || []).flat())
  const currentQuestion = computed(() => quiz.value[quizIndex.value] ?? null)
  const progress = computed(() => {
    const total = queue.value.length - 1
    return total > 0 ? Math.min(100, Math.round((100 * pos.value) / total)) : 0
  })
  const isActive = computed(() => !!run.value && !run.value.endedAt)

  /* ---------- utilitare interne ---------- */
  function elapsed() {
    const t = Date.now()
    return t - stepStart - stepAway - (hiddenAt ? t - hiddenAt : 0)
  }
  function chunkRecord() {
    return run.value.chunks[step.value.chunk]
  }
  function log(type, detail = {}) {
    const st = step.value
    run.value.eventSeq = (run.value.eventSeq || 0) + 1
    run.value.events.push({
      seq: run.value.eventSeq,
      t: Date.now() - run.value.startedAt,
      type,
      step: st?.kind ?? null,
      chunk: st?.chunk ?? null,
      ...detail,
    })
    if (run.value.events.length > MAX_EVENTS) run.value.events.splice(0, run.value.events.length - MAX_EVENTS)
    run.value.updatedAt = Date.now()
  }
  function persist() {
    if (run.value) saveRun(JSON.parse(JSON.stringify(run.value)))
  }
  function chunkOfWord(index) {
    let count = 0
    for (let k = 0; k < lesson.value.chunks.length; k++) {
      count += wordCount(lesson.value.chunks[k])
      if (index < count) return k
    }
    return lesson.value.chunks.length - 1
  }

  /* ---------- pornire și trecerea între pași ---------- */
  function start(l, learnerName, { test = false } = {}) {
    const now = Date.now()
    lesson.value = l
    // întâi lecția completă; apoi pe fiecare bucată: citire, copiere, memorie, progres
    const q = [{ kind: 'overview' }]
    l.chunks.forEach((_, chunk) => {
      q.push({ kind: 'read', chunk }, { kind: 'copy', chunk }, { kind: 'recall', chunk }, { kind: 'progress', chunk })
    })
    q.push({ kind: 'repeats' }, { kind: 'final' }, { kind: 'quiz' }, { kind: 'done' })
    queue.value = q
    pos.value = 0
    fastMode.value = false
    streak.value = 0
    struggled.value = []
    quiz.value = buildQuiz(l)
    quizIndex.value = 0
    stepAway = 0
    hiddenAt = null
    run.value = {
      id: now.toString(36) + Math.random().toString(36).slice(2, 6),
      learnerName: learnerName.trim(),
      lessonId: l.id,
      lessonTitle: l.title,
      chapter: l.chapter || '',
      startedAt: now,
      updatedAt: now,
      endedAt: null,
      status: 'in_progress',
      test, // sesiune făcută de tine în modul de test
      overviewMs: 0, // cât a stat pe lecția completă, la început
      overviewListens: 0,
      chunks: l.chunks.map((text, i) => ({
        i,
        words: wordCount(text),
        readMs: 0,
        readListens: 0,
        copyAttempts: 0,
        copyMs: 0,
        copySkipped: false,
        recallAttempts: 0,
        recallMs: 0,
        thinkMs: null,
        shows: 0,
        showMs: 0,
        listens: 0,
        pastes: 0,
        firstTry: null,
        accuracy: [],
        repeat: null,
        again: [],
      })),
      final: null,
      quiz: [],
      awayMs: 0,
      awayCount: 0,
      events: [],
    }
    stepStart = now
    log('start', { name: run.value.learnerName })
    enterStep()
  }

  function enterStep() {
    // pași „automați”, care nu au ecran propriu
    for (;;) {
      const st = step.value
      if (!st) return
      if (st.kind === 'copy' && fastMode.value) {
        run.value.chunks[st.chunk].copySkipped = true
        log('copy_skipped')
        pos.value++
        continue
      }
      if (st.kind === 'repeats') {
        const reps = struggled.value.map((chunk) => ({ kind: 'recall', chunk, repeat: true }))
        queue.value.splice(pos.value, 1, ...reps)
        if (reps.length) log('repeats_start', { chunks: struggled.value.map((c) => c + 1) })
        continue
      }
      if (st.kind === 'quiz' && !quiz.value.length) {
        pos.value++
        continue
      }
      break
    }
    stepStart = Date.now()
    stepAway = 0
    readWarned = false
    cur.value = newCounters()
    if (step.value.kind === 'quiz') {
      quizIndex.value = 0
      quizStart = Date.now()
    }
    if (step.value.kind === 'done') finish()
    persist()
  }

  function next() {
    pos.value++
    enterStep()
  }

  /* ---------- lecția completă (la început) ---------- */
  function markOverviewDone() {
    const ms = elapsed()
    run.value.overviewMs += ms
    log('overview_done', { ms })
    next()
  }

  /* ---------- pasul 1: citire ---------- */
  /** Elevul apasă „Am citit”. Dacă a fost prea rapid, îi cerem (o dată) să recitească. */
  function markRead({ skipSpeedCheck = false } = {}) {
    const ms = elapsed()
    const rec = chunkRecord()
    if (!skipSpeedCheck && !readWarned && rec.readListens === 0 && ms < wordCount(chunkText.value) * MIN_READ_MS_PER_WORD) {
      readWarned = true
      log('read_too_fast', { ms })
      return { tooFast: true, ms }
    }
    rec.readMs += ms
    log('read_done', { ms })
    next()
    return { tooFast: false, ms }
  }

  /* ---------- ajutoare și comportament ---------- */
  function recordListen(chunkIndex = null) {
    if (step.value.kind === 'overview') {
      run.value.overviewListens++
      log('overview_listen')
      return
    }
    if (step.value.kind === 'read') {
      chunkRecord().readListens++
      log('read_listen')
      return
    }
    cur.value.listens++
    if (chunkIndex != null) cur.value.hints[chunkIndex] = (cur.value.hints[chunkIndex] || 0) + 1
    log(step.value.kind === 'final' ? 'final_listen' : 'listen', chunkIndex != null ? { chunk: chunkIndex } : {})
  }

  function recordShow(ms, chunkIndex = null) {
    cur.value.shows++
    cur.value.showMs += ms
    if (chunkIndex != null) cur.value.hints[chunkIndex] = (cur.value.hints[chunkIndex] || 0) + 1
    log(step.value.kind === 'final' ? 'final_show' : 'show', { ms, ...(chunkIndex != null ? { chunk: chunkIndex } : {}) })
  }

  /**
   * reason: 'paste' (lipire), 'jump' (mult text apărut deodată), 'not_typed' (text care n-a fost tastat),
   *         'too_fast' (scris neomenește de repede; `chars` = caractere pe secundă)
   */
  function recordPaste(reason = 'paste', chars = null) {
    cur.value.pastes++
    const type = { not_typed: 'not_typed', too_fast: 'typed_too_fast' }[reason] || 'paste_blocked'
    log(type, { reason, ...(chars != null ? { chars } : {}) })
  }

  /** Prima tastă apăsată în pas = cât a stat până a început să scrie. */
  function recordFirstKey() {
    if (cur.value.firstKeyMs != null) return
    cur.value.firstKeyMs = elapsed()
    log('first_key', { ms: cur.value.firstKeyMs })
  }

  /** Ascunderea / revenirea în aplicație (schimbat tab-ul, ieșit din app pe telefon). */
  function setHidden(hidden) {
    if (!isActive.value) return
    if (hidden && !hiddenAt) {
      hiddenAt = Date.now()
      log('away_start')
      persist()
    } else if (!hidden && hiddenAt) {
      const ms = Date.now() - hiddenAt
      hiddenAt = null
      run.value.awayMs += ms
      run.value.awayCount++
      stepAway += ms
      log('away_end', { ms })
    }
  }

  /* ---------- pașii 2 și 3: scriere după text / din memorie ---------- */
  /** Verifică textul. Dacă a trecut, salvează rezultatul; UI-ul apelează apoi next(). */
  /** Același text trimis din nou, neschimbat? Atunci nu e o încercare nouă. */
  function sameAsLast(text) {
    const key = text.trim().replace(/\s+/g, ' ')
    if (cur.value.lastText === key && cur.value.lastResult) return cur.value.lastResult
    cur.value.lastText = key
    return null
  }

  /** `meta.cps`: viteza de scris (caractere/secundă), ajunge în date la fiecare verificare. */
  function submitText(text, meta = {}) {
    const repeated = sameAsLast(text)
    if (repeated) return { ...repeated, unchanged: true }
    const kind = step.value.kind
    const r = compareText(chunkText.value, text, PASS_THRESHOLD, chunkGroups.value)
    cur.value.lastResult = r
    cur.value.attempts++
    cur.value.accuracy.push(r.accuracy)
    log(`${kind}_check`, { accuracy: r.accuracy, missing: r.missing, extras: r.extras, ...(meta.cps ? { cps: meta.cps } : {}) })
    if (r.passed) completeWrite()
    return r
  }

  function completeWrite() {
    const st = step.value
    const rec = chunkRecord()
    const c = cur.value
    const ms = elapsed()
    rec.pastes += c.pastes
    if (st.kind === 'copy') {
      rec.copyAttempts += c.attempts
      rec.copyMs += ms
      log('copy_ok', { ms, attempts: c.attempts })
      return
    }
    const clean = c.attempts === 1 && c.shows === 0 && c.listens === 0
    if (st.again) {
      rec.again.push({ round: st.round, of: st.of, ms, attempts: c.attempts, shows: c.shows, showMs: c.showMs, listens: c.listens, accuracy: c.accuracy })
      log('again_ok', { ms, attempts: c.attempts, round: st.round, clean })
      // rundă care n-a ieșit din prima, fără ajutor -> încă una în plus
      const of = clean ? st.of : Math.min(MAX_AGAIN, st.of + 1)
      if (st.round < of) addAgain(st.chunk, st.round + 1, of, st.repeat)
      return
    }
    if (st.repeat) {
      rec.repeat = { ms, attempts: c.attempts, shows: c.shows, showMs: c.showMs, listens: c.listens, accuracy: c.accuracy }
      log('repeat_ok', { ms, attempts: c.attempts })
      addAgain(st.chunk, 1, clean ? AGAIN_IF_CLEAN : AGAIN_IF_NOT_CLEAN, true)
      return
    }
    Object.assign(rec, {
      recallAttempts: c.attempts,
      recallMs: ms,
      thinkMs: c.firstKeyMs,
      shows: c.shows,
      showMs: c.showMs,
      listens: c.listens,
      accuracy: c.accuracy,
      firstTry: c.attempts === 1 && c.shows === 0 && c.listens === 0,
    })
    log('recall_ok', { ms, attempts: c.attempts, firstTry: rec.firstTry })
    adapt(st.chunk, c)
    addAgain(st.chunk, 1, clean ? AGAIN_IF_CLEAN : AGAIN_IF_NOT_CLEAN)
  }

  /** Programează imediat runda `round` din `of` de scris din nou bucata, din memorie. */
  function addAgain(chunk, round, of, repeat = false) {
    const st = { kind: 'recall', chunk, again: true, round, of }
    if (repeat) st.repeat = true
    queue.value.splice(pos.value + 1, 0, st)
    log('again_added', { round, of })
  }

  /** Adaptarea: bucățile grele se repetă; dacă merge bine, sărim peste copiere. */
  function adapt(chunk, c) {
    const hard = c.attempts >= HARD_ATTEMPTS || c.shows + c.listens >= HARD_HELPS
    const clean = c.attempts === 1 && c.shows === 0 && c.listens === 0
    if (hard && !struggled.value.includes(chunk)) {
      struggled.value.push(chunk)
      log('repeat_added')
    }
    streak.value = clean ? streak.value + 1 : 0
    if (!fastMode.value && streak.value >= FAST_STREAK) {
      fastMode.value = true
      log('fast_on')
    } else if (fastMode.value && (hard || c.attempts >= 2)) {
      fastMode.value = false
      streak.value = 0
      log('fast_off')
    }
  }

  /* ---------- recapitularea întregii lecții ---------- */
  /** La ce bucată s-a blocat (pentru „Arată-mi / Ascultă unde m-am blocat”). */
  function stuckChunk(text) {
    const r = compareText(fullText.value, text, PASS_THRESHOLD, allGroups.value)
    return chunkOfWord(Math.max(0, r.stuckIndex))
  }

  function submitFinal(text, meta = {}) {
    const repeated = sameAsLast(text)
    if (repeated) return { ...repeated, unchanged: true }
    const r = { ...compareText(fullText.value, text, PASS_THRESHOLD, allGroups.value) }
    r.stuckChunk = chunkOfWord(Math.max(0, r.stuckIndex))
    cur.value.lastResult = r
    const c = cur.value
    c.attempts++
    c.accuracy.push(r.accuracy)
    log('final_check', { accuracy: r.accuracy, missing: r.missing, ...(meta.cps ? { cps: meta.cps } : {}) })
    if (r.passed) {
      run.value.final = {
        ms: elapsed(),
        attempts: c.attempts,
        shows: c.shows,
        showMs: c.showMs,
        listens: c.listens,
        hints: c.hints,
        accuracy: c.accuracy,
        thinkMs: c.firstKeyMs,
        pastes: c.pastes,
      }
      log('final_ok', { ms: run.value.final.ms })
    }
    return r
  }

  /* ---------- întrebări ---------- */
  function answerQuestion(answer) {
    const q = currentQuestion.value
    const correct = checkAnswer(q.a, answer)
    const ms = Date.now() - quizStart
    run.value.quiz.push({ type: q.type, q: q.q, a: q.a, answer: answer.trim(), correct, ms })
    log('quiz_answer', { correct, ms })
    return { correct, correctAnswer: q.a, relatedChunk: relatedChunk(lesson.value, q) }
  }

  function nextQuestion() {
    quizIndex.value++
    quizStart = Date.now()
    if (quizIndex.value < quiz.value.length) persist()
    else next()
  }

  /* ---------- doar pentru testare ---------- */
  /** Sare direct la primul pas de tipul dat ('final', 'quiz', sau 'recall' pentru bucata n). */
  function devJumpTo(kind, chunk = null) {
    const idx = queue.value.findIndex(
      (st, i) => i >= 0 && st.kind === kind && (chunk == null || st.chunk === chunk),
    )
    const target = kind === 'final' ? queue.value.findIndex((st) => st.kind === 'repeats' || st.kind === 'final') : idx
    if (target < 0) return
    log('dev_jump', { to: kind })
    pos.value = target
    enterStep()
  }

  /* ---------- final ---------- */
  function finish() {
    run.value.endedAt = Date.now()
    run.value.status = 'done'
    log('done')
  }

  function abandon() {
    if (!isActive.value) return
    run.value.endedAt = Date.now()
    run.value.status = 'abandoned'
    log('abandon')
    persist()
  }

  return {
    // stare
    lesson, run, queue, pos, fastMode, struggled, cur, quiz, quizIndex,
    // getters
    step, chunkText, fullText, currentQuestion, progress, isActive,
    // acțiuni
    start, next, markOverviewDone, markRead, recordListen, recordShow, recordPaste, recordFirstKey, setHidden,
    submitText, stuckChunk, submitFinal, answerQuestion, nextQuestion, abandon, devJumpTo,
  }
})
