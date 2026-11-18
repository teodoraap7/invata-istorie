import { demoLesson } from '@/data/demoLesson'
import { fetchLessons } from './api'

const CACHE_KEY = 'memorez_lessons'

/** Lecțiile din Sheet. Fără internet: ultima copie salvată. Dacă nu există nimic: lecția demo. */
export async function loadLessons() {
  try {
    const lessons = (await fetchLessons()).filter((l) => l.chunks?.length)
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
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]')
    if (cached.length) return cached
  } catch {
    /* ignorăm */
  }
  return [demoLesson]
}
