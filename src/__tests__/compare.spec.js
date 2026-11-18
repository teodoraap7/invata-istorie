import { describe, it, expect } from 'vitest'
import { compareText, checkAnswer, normalize, splitSentences, romanToNumber } from '../lib/compare'

const TEXT = 'La 24 ianuarie 1859, Adunarea Electivă a Țării Românești l-a ales tot pe Cuza.'

describe('normalize', () => {
  it('scoate diacriticele și face litere mici', () => {
    expect(normalize('Țării')).toBe('tarii')
    expect(normalize('ÎNȘTIINȚARE')).toBe('instiintare')
  })
})

describe('compareText', () => {
  it('acceptă textul identic', () => {
    const r = compareText(TEXT, TEXT)
    expect(r.passed).toBe(true)
    expect(r.accuracy).toBe(100)
  })

  it('acceptă fără diacritice, fără punctuație, cu litere mici', () => {
    const r = compareText(TEXT, 'la 24 ianuarie 1859 adunarea electiva a tarii romanesti l a ales tot pe cuza')
    expect(r.passed).toBe(true)
  })

  it('acceptă o greșeală mică de tastare la un cuvânt lung', () => {
    const r = compareText(TEXT, 'La 24 ianuarie 1859, Adunarea Electiva a Tarii Romanesit l-a ales tot pe Cuza.')
    expect(r.passed).toBe(true)
  })

  it('respinge un an greșit', () => {
    const r = compareText(TEXT, 'La 24 ianuarie 1856, Adunarea Electivă a Țării Românești l-a ales tot pe Cuza.')
    expect(r.passed).toBe(false) // 93% corect, dar anul e greșit
    expect(r.missingNumbers).toBe(1)
  })

  it('respinge textul incomplet și spune ce lipsește', () => {
    const r = compareText(TEXT, 'La 24 ianuarie 1859, Adunarea Electivă a ales pe Cuza.')
    expect(r.passed).toBe(false)
    expect(r.missing).toBeGreaterThan(0)
    expect(r.firstMissingIndex).toBe(7) // primul cuvânt lipsă: „Țării”
  })

  it('trece la 90%: un cuvânt lipsă din 14', () => {
    const r = compareText(TEXT, 'La 24 ianuarie 1859, Adunarea Electivă a Țării Românești l-a ales pe Cuza.')
    expect(r.accuracy).toBe(93)
    expect(r.passed).toBe(true)
  })

  it('nu trece sub 90%: două cuvinte lipsă din 14', () => {
    const r = compareText(TEXT, 'La 24 ianuarie 1859, Adunarea a Țării Românești l-a ales pe Cuza.')
    expect(r.passed).toBe(false)
  })

  it('pragul se poate schimba', () => {
    const typed = 'La 24 ianuarie 1859, Adunarea Electivă a Țării Românești l-a ales pe Cuza.'
    expect(compareText(TEXT, typed, 100).passed).toBe(false)
  })

  it('respinge textul complet + multe cuvinte inventate', () => {
    const r = compareText(TEXT, TEXT + ' și apoi a plecat la Viena cu armata')
    expect(r.missing).toBe(0)
    expect(r.passed).toBe(false)
  })

  it('respinge textul complet + un an inventat', () => {
    const r = compareText(TEXT, TEXT + ' 1860')
    expect(r.passed).toBe(false)
  })

  it('cuvintele în plus scad procentul', () => {
    const r = compareText(TEXT, TEXT + ' bla bla')
    expect(r.accuracy).toBe(88) // 14 / (14 + 2)
    expect(r.passed).toBe(false)
  })

  it('respinge textul gol', () => {
    expect(compareText(TEXT, '').passed).toBe(false)
  })

  it('respinge cuvintele inversate', () => {
    const r = compareText('Cuza a fost ales domn', 'domn a fost ales Cuza')
    expect(r.passed).toBe(false)
  })
})

describe('checkAnswer', () => {
  it('recunoaște un an', () => {
    expect(checkAnswer('1856', 'în 1856')).toBe(true)
    expect(checkAnswer('1856', '1859')).toBe(false)
  })
  it('acceptă răspuns parțial dacă are majoritatea cuvintelor-cheie', () => {
    expect(checkAnswer('unirea Principatelor într-un singur stat numit România', 'unirea principatelor intr-un stat Romania')).toBe(true)
  })
})

describe('splitSentences', () => {
  it('împarte pe propoziții', () => {
    expect(splitSentences('Prima. A doua! A treia?')).toEqual(['Prima.', 'A doua!', 'A treia?'])
  })
})

describe('cifre romane', () => {
  const SEC = 'Regimul fanariot a fost impus în secolul XVIII.'

  it('transformă cifrele romane', () => {
    expect(romanToNumber('XVIII')).toBe(18)
    expect(romanToNumber('xix')).toBe(19)
    expect(romanToNumber('IV')).toBe(4)
    expect(romanToNumber('fanar')).toBe(null)
  })

  it('acceptă XVIII scris cu litere mici sau ca 18', () => {
    expect(compareText(SEC, 'Regimul fanariot a fost impus în secolul xviii').passed).toBe(true)
    expect(compareText(SEC, 'Regimul fanariot a fost impus în secolul 18').passed).toBe(true)
  })

  it('respinge un secol greșit (XVII în loc de XVIII)', () => {
    const r = compareText(SEC, 'Regimul fanariot a fost impus în secolul XVII')
    expect(r.passed).toBe(false)
    expect(r.missingNumbers).toBe(1)
  })

  it('acceptă „Petru I” scris „Petru 1” sau „petru i”', () => {
    const T = 'aliat cu țarul Rusiei Petru I'
    expect(compareText(T, 'aliat cu tarul Rusiei Petru 1').passed).toBe(true)
    expect(compareText(T, 'aliat cu tarul rusiei petru i').passed).toBe(true)
  })

  it('nu confundă cuvinte obișnuite cu cifre romane', () => {
    expect(compareText('Domnul mi-a spus', 'Domnul mi-a spus').passed).toBe(true)
  })

  it('la întrebări acceptă secolul scris oricum', () => {
    expect(checkAnswer('secolul XVIII', 'secolul 18')).toBe(true)
    expect(checkAnswer('secolul XVIII', 'secolul xvii')).toBe(false)
  })
})
