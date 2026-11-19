import { describe, it, expect } from 'vitest'
import { compareText, checkAnswer, normalize, splitSentences, romanToNumber, parseEnumeration } from '../lib/compare'
import { prepareLesson } from '../lib/lessons'

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

describe('enumerări în orice ordine', () => {
  const lesson = prepareLesson({
    chunks: ['Este un regim [social, politic, economic și cultural] impus de Imperiul Otoman.'],
  })
  const T = lesson.chunks[0]
  const G = lesson.groups[0]

  it('scoate parantezele din text', () => {
    expect(T).toBe('Este un regim social, politic, economic și cultural impus de Imperiul Otoman.')
    expect(parseEnumeration('social, politic, economic și cultural').items).toHaveLength(4)
  })

  it('acceptă elementele în altă ordine', () => {
    const r = compareText(T, 'Este un regim cultural, social, economic si politic impus de Imperiul Otoman', 90, G)
    expect(r.passed).toBe(true)
    expect(r.accuracy).toBe(100)
  })

  it('acceptă altă ordine și cu o greșeală de tastare', () => {
    expect(compareText(T, 'Este un regim cultural, economic, politic si socal impus de Imperiul Otoman', 90, G).passed).toBe(true)
  })

  it('fără marcaj [ ], ordinea contează', () => {
    expect(compareText(T, 'Este un regim cultural, social, economic si politic impus de Imperiul Otoman').passed).toBe(false)
  })

  it('un element lipsă tot lipsește', () => {
    const r = compareText(T, 'Este un regim cultural, social si politic impus de Imperiul Otoman', 90, G)
    expect(r.missing).toBe(1)
  })

  it('elemente din mai multe cuvinte', () => {
    const l = prepareLesson({ chunks: ['[Încălcarea autonomiei, grecizarea domniei, instabilitate la tron, fiscalitate excesivă].'] })
    const r = compareText(l.chunks[0], 'fiscalitate excesiva, instabilitate la tron, incalcarea autonomiei, grecizarea domniei', 90, l.groups[0])
    expect(r.passed).toBe(true)
  })
})
