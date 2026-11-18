// Verificarea textului scris de elev față de textul original.
// Tolerează: diacritice lipsă, majuscule, punctuație, greșeli mici de tastare.
// Strict la: cifre (ani, date) și ordinea cuvintelor.

/** Procentul minim de cuvinte corecte ca să treacă mai departe. */
export const PASS_THRESHOLD = 90

/** „Țara” -> „tara”: litere mici, fără diacritice. */
export function normalize(word) {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const ROMAN_RE = /^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/
const ROMAN_VALUES = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }

/** „xviii” -> 18; null dacă nu e un număr roman valid. */
export function romanToNumber(word) {
  const w = word.toLowerCase()
  if (!w || !ROMAN_RE.test(w)) return null
  let total = 0
  for (let i = 0; i < w.length; i++) {
    const v = ROMAN_VALUES[w[i]]
    const next = ROMAN_VALUES[w[i + 1]] || 0
    total += v < next ? -v : v
  }
  return total
}

/**
 * Valoarea numerică a unui cuvânt: „1859” -> 1859, „XVIII” -> 18.
 * În textul original, doar cuvintele scrise cu MAJUSCULE sunt considerate cifre romane
 * (ca „mi” din „mi-a” să nu devină 1001). Ce scrie elevul poate fi și cu litere mici.
 */
function numberValue(word, fromTarget) {
  if (/^\d+$/.test(word)) return Number(word)
  if (fromTarget && !/^[IVXLCDM]+$/.test(word)) return null
  return romanToNumber(word)
}

/** Împarte textul în cuvinte (litere + cifre). „l-a” devine „l”, „a”. */
export function tokenize(text, fromTarget = false) {
  return (String(text ?? '').match(/[\p{L}\p{N}]+/gu) || []).map((w) => ({
    original: w,
    norm: normalize(w),
    value: numberValue(w, fromTarget),
  }))
}

/**
 * Cuvântul scris de elev (u) se potrivește cu cel din original (t)?
 * Numerele (arabe sau romane) trebuie să aibă exact aceeași valoare:
 * „XVIII” = „xviii” = „18”, dar „XVII” ≠ „XVIII”.
 */
export function tokensMatch(t, u) {
  if (t.value != null) return u.value === t.value || u.norm === t.norm
  if (/^\d+$/.test(u.norm)) return false // o cifră în loc de cuvânt
  return sameWord(t.norm, u.norm)
}

export const wordCount = (text) => tokenize(text).length

/** Împarte un paragraf în propoziții (pentru citirea cu voce tare). */
export function splitSentences(text) {
  return (String(text).match(/[^.!?]+[.!?]*["”»)]*\s*/g) || [String(text)])
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Distanța Levenshtein: câte litere trebuie schimbate ca să ajungi de la a la b. */
export function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/** Două cuvinte (deja normalizate) sunt „la fel”? */
export function sameWord(a, b) {
  if (a === b) return true
  if (/\d/.test(a) || /\d/.test(b)) return false // anii trebuie exacți
  const len = Math.max(a.length, b.length)
  if (len < 5) return false // cuvintele scurte trebuie exacte
  if (Math.abs(a.length - b.length) > 2) return false
  return levenshtein(a, b) <= (len >= 9 ? 2 : 1)
}

/**
 * Compară textul original cu ce a scris elevul (LCS pe cuvinte).
 * Întoarce:
 *  - ops: lista de cuvinte, fiecare { type: 'ok' | 'extra' | 'missing', word }
 *  - matched / total / missing / extras / accuracy (%)
 *  - accuracy: cuvinte corecte / (cuvinte din original + cuvinte în plus)
 *              => și cuvintele lipsă, și cele greșite/în plus scad scorul
 *  - passed: true dacă accuracy >= `threshold`% și toți anii/cifrele sunt corecte
 *            (niciun an lipsă și niciun an în plus)
 *  - firstMissingIndex: poziția primului cuvânt lipsă din original (-1 dacă nu lipsește nimic)
 */
export function compareText(target, typed, threshold = PASS_THRESHOLD) {
  const T = tokenize(target, true)
  const U = tokenize(typed)
  const n = T.length
  const m = U.length

  const eq = T.map((t) => U.map((u) => tokensMatch(t, u)))
  // dp[i][j] = lungimea celei mai lungi subsecvențe comune pentru T[i..] și U[j..]
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq[i][j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops = []
  let i = 0
  let j = 0
  let firstMissingIndex = -1
  let firstExtraNear = -1
  while (i < n || j < m) {
    if (i < n && j < m && eq[i][j] && dp[i][j] === dp[i + 1][j + 1] + 1) {
      ops.push({ type: 'ok', word: U[j].original, number: T[i].value != null })
      i++
      j++
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      ops.push({ type: 'extra', word: U[j].original, number: /^\d+$/.test(U[j].norm) })
      if (firstExtraNear < 0) firstExtraNear = Math.min(i, n - 1)
      j++
    } else {
      ops.push({ type: 'missing', word: T[i].original, number: T[i].value != null })
      if (firstMissingIndex < 0) firstMissingIndex = i
      i++
    }
  }

  const matched = n && m ? dp[0][0] : 0
  const extras = m - matched
  // cuvintele în plus / greșite contează ca greșeli, la fel ca cele lipsă
  const accuracy = n ? Math.round((100 * matched) / (n + extras)) : 0
  // cifrele (ani, zile) trebuie să fie exacte: nici lipsă, nici inventate
  const missingNumbers = ops.filter((o) => o.type === 'missing' && o.number).length
  const extraNumbers = ops.filter((o) => o.type === 'extra' && o.number).length
  return {
    ops,
    matched,
    total: n,
    missing: n - matched,
    extras,
    accuracy,
    missingNumbers,
    extraNumbers,
    passed: n > 0 && accuracy >= threshold && missingNumbers === 0 && extraNumbers === 0,
    firstMissingIndex,
    stuckIndex: firstMissingIndex >= 0 ? firstMissingIndex : firstExtraNear,
  }
}

/**
 * Verifică răspunsul la o întrebare: cuvintele-cheie din răspunsul corect
 * trebuie să apară în răspunsul elevului (toate, dacă sunt 1–2; 60% dacă sunt mai multe).
 */
export function checkAnswer(correctAnswer, answer) {
  let keys = tokenize(correctAnswer, true).filter((t) => t.norm.length >= 3 || t.value != null)
  if (!keys.length) keys = tokenize(correctAnswer, true)
  if (!keys.length) return false
  const given = tokenize(answer)
  const hits = keys.filter((k) => given.some((g) => tokensMatch(k, g))).length
  return hits / keys.length >= (keys.length <= 2 ? 1 : 0.6)
}
