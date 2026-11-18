// Citire cu voce tare prin Web Speech API (vocea browserului, în română).

let token = 0

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

function romanianVoice() {
  return window.speechSynthesis.getVoices().find((v) => /^ro/i.test(v.lang)) || null
}

export function stopSpeaking() {
  token++
  if (canSpeak()) window.speechSynthesis.cancel()
}

/**
 * Citește propozițiile pe rând. onSentence(i) e apelat când începe propoziția i
 * (pentru evidențiere) și cu -1 la final.
 */
export async function speakSentences(sentences, onSentence = () => {}) {
  if (!canSpeak()) return
  stopSpeaking()
  const mine = token
  const voice = romanianVoice()
  for (let i = 0; i < sentences.length; i++) {
    if (mine !== token) return
    onSentence(i)
    await new Promise((resolve) => {
      // siguranță: unele browsere nu trimit niciodată „onend”
      const safety = setTimeout(resolve, 3000 + sentences[i].length * 120)
      const done = () => {
        clearTimeout(safety)
        resolve()
      }
      const u = new SpeechSynthesisUtterance(sentences[i])
      u.lang = 'ro-RO'
      if (voice) u.voice = voice
      u.rate = 0.95
      u.onend = done
      u.onerror = done
      window.speechSynthesis.speak(u)
    })
  }
  if (mine === token) onSentence(-1)
}
