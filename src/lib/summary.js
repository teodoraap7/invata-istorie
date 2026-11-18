/** Rezumatul unei sesiuni (folosit la final și în panoul tău). */
export function summarize(run) {
  const chunks = run.chunks || []
  const fin = run.final || {}
  const hints = fin.hints || {}
  const sum = (key) => chunks.reduce((a, c) => a + (c[key] || 0), 0)
  const rep = (key) => chunks.reduce((a, c) => a + ((c.repeat && c.repeat[key]) || 0), 0)

  const lastT = run.endedAt || run.updatedAt || run.startedAt + ((run.events || []).at(-1)?.t || 0)
  const totalMs = lastT - run.startedAt
  // rundele „încă o dată” (după ce a cerut ajutor)
  const again = (key) => chunks.reduce((a, c) => a + (c.again || []).reduce((x, r) => x + (r[key] || 0), 0), 0)
  const shows = sum('shows') + rep('shows') + again('shows') + (fin.shows || 0)
  const listens = sum('listens') + rep('listens') + again('listens') + (fin.listens || 0)

  const difficulty = (c) =>
    (c.recallAttempts || 0) +
    1.5 * ((c.shows || 0) + (c.listens || 0)) +
    (c.repeat ? c.repeat.attempts + c.repeat.shows + c.repeat.listens : 0) +
    1.5 * (hints[c.i] || 0)
  const hardest = chunks
    .filter((c) => c.recallAttempts >= 3 || c.shows + c.listens >= 2 || hints[c.i])
    .sort((a, b) => difficulty(b) - difficulty(a))
    .map((c) => c.i)

  const readMs = sum('readMs')
  return {
    chunkCount: chunks.length,
    totalMs,
    activeMs: Math.max(0, totalMs - (run.awayMs || 0)),
    readMs,
    overviewMs: run.overviewMs || 0,
    overviewListens: run.overviewListens || 0,
    copyMs: sum('copyMs'),
    recallMs: sum('recallMs') + rep('ms') + again('ms'),
    finalMs: fin.ms || 0,
    shows,
    showMs: sum('showMs') + rep('showMs') + again('showMs') + (fin.showMs || 0),
    listens,
    readListens: sum('readListens'),
    helps: shows + listens,
    attempts: sum('copyAttempts') + sum('recallAttempts') + rep('attempts') + again('attempts') + (fin.attempts || 0),
    againRounds: chunks.reduce((a, c) => a + (c.again || []).length, 0),
    firstTry: chunks.filter((c) => c.firstTry).length,
    quizCorrect: (run.quiz || []).filter((q) => q.correct).length,
    quizTotal: (run.quiz || []).length,
    wordsPerMinute: readMs ? Math.round(sum('words') / (readMs / 60000)) : 0,
    hardest,
    pastes: sum('pastes') + (fin.pastes || 0),
    copySkipped: chunks.filter((c) => c.copySkipped).length,
  }
}
