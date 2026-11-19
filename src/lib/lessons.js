import { demoLesson } from '@/data/demoLesson'
import { fetchLessons } from './api'
import { parseEnumeration } from './compare'

const CACHE_KEY = 'memorez_lessons'

const ENUM_RE = /\[([^\]]+)\]/g

/**
 * În textul lecției, o enumerare care se poate scrie în orice ordine e pusă între paranteze drepte:
 *   „un regim [social, politic, economic și cultural] impus...”
 * Aici scoatem parantezele (elevul nu le vede) și ținem minte enumerările pentru verificare.
 */
export function prepareLesson(lesson) {
  const groups = []
  const chunks = lesson.chunks.map((text, i) => {
    groups[i] = [...text.matchAll(ENUM_RE)].map((m) => parseEnumeration(m[1]))
    return text.replace(ENUM_RE, '$1')
  })
  return { ...lesson, chunks, groups }
}

/** Lecțiile din Sheet. Fără internet: ultima copie salvată. Dacă nu există nimic: lecția demo. */
export async function loadLessons() {
  try {
    const lessons = (await fetchLessons()).filter((l) => l.chunks?.length).map(prepareLesson)
    if (lessons.length) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(lessons))
      } catch {
        /* ignorăm */
      }
      return lessons
    }
  } catch {
    /* fără internet / Sheet indisponibil */
  }
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]').map((l) => (l.groups ? l : prepareLesson(l)))
    if (cached.length) return cached
  } catch {
    /* ignorăm */
  }
  return [demoLesson]
}
