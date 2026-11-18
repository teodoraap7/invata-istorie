import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '../stores/session'

const LESSON = {
  id: 'test',
  title: 'Test',
  chapter: 'C1',
  chunks: [
    'Cuza a fost ales domn în 1859.',
    'Unirea s-a făcut prin dubla alegere.',
    'Capitala a devenit Bucureștiul în 1862.',
  ],
  questions: [{ q: 'Când a fost ales Cuza?', a: '1859' }],
}

/** Trece o bucată: citire -> (copiere) -> memorie -> progres, scriind corect din prima. */
function passChunk(s) {
  s.recordListen() // a ascultat, deci nu e „prea repede”
  s.markRead()
  if (s.step.kind === 'copy') {
    expect(s.submitText(s.chunkText).passed).toBe(true)
    s.next()
  }
  expect(s.step.kind).toBe('recall')
  expect(s.submitText(s.chunkText).passed).toBe(true)
  s.next()
  // rundele „încă o dată” (minim 1)
  while (s.step.kind === 'recall' && s.step.again) {
    expect(s.submitText(s.chunkText).passed).toBe(true)
    s.next()
  }
  expect(s.step.kind).toBe('progress')
  s.next()
}

describe('sesiunea de învățare', () => {
  let s
  beforeEach(() => {
    setActivePinia(createPinia())
    s = useSessionStore()
    s.start(LESSON, 'Ana')
    s.markOverviewDone()
  })

  it('începe cu lecția completă, apoi citirea primei bucăți', () => {
    setActivePinia(createPinia())
    const fresh = useSessionStore()
    fresh.start(LESSON, 'Ana')
    expect(fresh.step).toEqual({ kind: 'overview' })
    fresh.recordListen()
    fresh.markOverviewDone()
    expect(fresh.run.overviewListens).toBe(1)
    expect(fresh.step).toEqual({ kind: 'read', chunk: 0 })
    expect(s.run.learnerName).toBe('Ana')
    expect(s.run.events[0].type).toBe('start')
  })

  it('cere recitire dacă a citit prea repede', () => {
    expect(s.markRead().tooFast).toBe(true)
    expect(s.step.kind).toBe('read')
    expect(s.markRead().tooFast).toBe(false) // a doua oară îl lasă
    expect(s.step.kind).toBe('copy')
  })

  it('același text verificat de mai multe ori contează o singură dată', () => {
    s.recordListen()
    s.markRead()
    s.submitText('Cuza a fost')
    expect(s.submitText('Cuza a fost ').unchanged).toBe(true)
    s.submitText('Cuza a fost')
    expect(s.cur.attempts).toBe(1)
    expect(s.run.events.filter((e) => e.type === 'copy_check')).toHaveLength(1)
    s.submitText('Cuza a fost ales')
    expect(s.cur.attempts).toBe(2)
  })

  it('nu trece mai departe cu textul incomplet', () => {
    s.recordListen()
    s.markRead()
    const r = s.submitText('Cuza a fost')
    expect(r.passed).toBe(false)
    expect(s.step.kind).toBe('copy')
  })

  it('după 2 bucăți scrise din prima sare peste copiere', () => {
    passChunk(s)
    passChunk(s)
    expect(s.fastMode).toBe(true)
    s.recordListen()
    s.markRead()
    expect(s.step).toEqual({ kind: 'recall', chunk: 2 })
    expect(s.run.chunks[2].copySkipped).toBe(true)
  })

  it('repetă bucata grea înainte de recapitulare', () => {
    s.recordListen()
    s.markRead()
    s.submitText(s.chunkText)
    s.next()
    s.submitText('greșit')
    s.submitText('tot greșit')
    s.recordShow(4000)
    expect(s.submitText(s.chunkText).passed).toBe(true)
    expect(s.run.chunks[0].recallAttempts).toBe(3)
    expect(s.run.chunks[0].firstTry).toBe(false)
    s.next()
    // n-a ieșit din prima -> o mai scrie de 2 ori
    expect(s.step).toEqual({ kind: 'recall', chunk: 0, again: true, round: 1, of: 2 })
    s.submitText(s.chunkText)
    s.next()
    expect(s.step).toEqual({ kind: 'recall', chunk: 0, again: true, round: 2, of: 2 })
    s.submitText(s.chunkText)
    s.next()
    expect(s.step).toEqual({ kind: 'progress', chunk: 0 }) // tranziția vine după rundele „încă o dată”
    s.next()
    passChunk(s)
    passChunk(s)
    expect(s.step).toEqual({ kind: 'recall', chunk: 0, repeat: true })
  })

  it('scrisă din prima -> o mai scrie o dată (total 2)', () => {
    s.recordListen()
    s.markRead()
    s.submitText(s.chunkText)
    s.next()
    s.submitText(s.chunkText) // din prima, fără ajutor
    s.next()
    expect(s.step).toEqual({ kind: 'recall', chunk: 0, again: true, round: 1, of: 1 })
    s.submitText(s.chunkText)
    s.next()
    expect(s.step).toEqual({ kind: 'progress', chunk: 0 })
  })

  it('cu ajutor -> o mai scrie de 2 ori (total 3); runda cu ajutor adaugă +1', () => {
    s.recordListen()
    s.markRead()
    s.submitText(s.chunkText)
    s.next()
    s.recordListen() // a cerut să asculte
    s.submitText(s.chunkText)
    s.next()
    expect(s.step).toEqual({ kind: 'recall', chunk: 0, again: true, round: 1, of: 2 })
    s.recordShow(4000) // iar ajutor -> +1
    s.submitText(s.chunkText)
    s.next()
    expect(s.step).toEqual({ kind: 'recall', chunk: 0, again: true, round: 2, of: 3 })
    s.submitText(s.chunkText)
    s.next()
    expect(s.step).toEqual({ kind: 'recall', chunk: 0, again: true, round: 3, of: 3 })
    s.submitText(s.chunkText)
    s.next()
    expect(s.step).toEqual({ kind: 'progress', chunk: 0 })
    expect(s.run.chunks[0].again).toHaveLength(3)
  })

  it('recapitularea arată unde s-a blocat și apoi trec întrebările', () => {
    passChunk(s)
    passChunk(s)
    passChunk(s)
    expect(s.step.kind).toBe('final')
    const r = s.submitFinal(LESSON.chunks[0])
    expect(r.passed).toBe(false)
    expect(r.stuckChunk).toBe(1)
    expect(s.submitFinal(LESSON.chunks.join(' ')).passed).toBe(true)
    s.next()
    expect(s.step.kind).toBe('quiz')
    expect(s.answerQuestion('în 1859').correct).toBe(true)
  })

  it('termină lecția după ultima întrebare', () => {
    passChunk(s)
    passChunk(s)
    passChunk(s)
    s.submitFinal(LESSON.chunks.join(' '))
    s.next()
    while (s.step.kind === 'quiz') {
      s.answerQuestion('nu știu')
      s.nextQuestion()
    }
    expect(s.step.kind).toBe('done')
    expect(s.run.status).toBe('done')
    expect(s.run.quiz.length).toBeGreaterThan(0)
  })
})
