import { tokenize, sameWord } from './compare'

/**
 * Întrebările de la finalul lecției:
 *  - cele scrise de tine în lecție (Î / R)
 *  - plus 2–3 de tip „completează”, generate automat: ascundem un an
 *    sau cel mai lung cuvânt (de preferat un nume propriu) dintr-o bucată.
 */
export function buildQuiz(lesson, random = Math.random) {
  const own = (lesson.questions || [])
    .filter((q) => q && q.q && q.a)
    .map((q) => ({ type: 'question', q: q.q, a: q.a }))

  const cloze = []
  lesson.chunks.forEach((text, chunk) => {
    const words = text.match(/[\p{L}\p{N}]+/gu) || []
    let pick = words.find((w) => /^\d{3,4}$/.test(w))
    if (!pick) {
      const long = words.filter((w) => w.length >= 7).sort((a, b) => b.length - a.length)
      pick = long.find((w) => /^\p{Lu}/u.test(w)) || long[0]
    }
    if (!pick) return
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${pick}(?![\\p{L}\\p{N}])`, 'u')
    cloze.push({ type: 'cloze', q: text.replace(re, '_____'), a: pick, chunk })
  })

  for (let i = cloze.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[cloze[i], cloze[j]] = [cloze[j], cloze[i]]
  }
  return [...own, ...cloze.slice(0, own.length >= 4 ? 2 : 3)]
}

/** Bucata din lecție cea mai legată de o întrebare (o arătăm la răspuns greșit). */
export function relatedChunk(lesson, question) {
  if (question.chunk != null) return question.chunk
  const keys = tokenize(`${question.q} ${question.a}`)
    .filter((t) => t.norm.length >= 4 || /\d/.test(t.norm))
    .map((t) => t.norm)
  let best = 0
  let bestScore = -1
  lesson.chunks.forEach((text, i) => {
    const words = tokenize(text).map((t) => t.norm)
    const score = keys.filter((k) => words.some((w) => sameWord(k, w))).length
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}
