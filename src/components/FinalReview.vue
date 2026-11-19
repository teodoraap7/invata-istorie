<script setup>
// Recapitularea: toată lecția din memorie. Ajutorul arată / citește doar bucata unde s-a blocat.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useSessionStore } from '@/stores/session'
import { splitSentences } from '@/lib/compare'
import { speakSentences, stopSpeaking, canSpeak } from '@/lib/speech'
import { showDuration } from '@/lib/format'
import DiffView from './DiffView.vue'
import ShowOverlay from './ShowOverlay.vue'
import { useTypingGuard } from '@/lib/typingGuard'
// mod de test: doar cu npm run dev (în build-ul publicat codul e scos complet)
const DEV_TOOLS = import.meta.env.DEV

const s = useSessionStore()
const text = ref('')
const result = ref(null)
const success = ref(false)
const notice = ref('')
const input = ref(null)
const overlay = ref(null)
// cât timp ascultă sau vede textul, nu poate scrie
const speaking = ref(false)
const showing = ref(false)
const locked = computed(() => speaking.value || showing.value)

function onKeydown(e) {
  if (e.key.length === 1) s.recordFirstKey()
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    check()
  }
}
const PASTE_MSG = 'Lipirea textului e dezactivată — scrie de mână. 🙂'
function onPaste(e) {
  e.preventDefault()
  s.recordPaste('paste')
  notice.value = PASTE_MSG
}
const guard = useTypingGuard(text, (reason, chars) => {
  s.recordPaste(reason, chars)
  notice.value = PASTE_MSG
})
function check() {
  if (success.value) return
  // text pus în câmp pe ocolite (din consolă), fără evenimente de tastare
  const inField = input.value?.value ?? text.value
  const sneaked = inField.trim() && inField !== text.value
  if (!sneaked && !text.value.trim()) return
  notice.value = ''
  if (sneaked || (!devFilled && !guard.typedByHand())) {
    s.recordPaste('not_typed', text.value.length)
    notice.value = 'Textul trebuie scris de mână, de la tastatură.'
    return
  }
  if (!devFilled && guard.tooFast()) {
    s.recordPaste('too_fast', guard.charsPerSecond())
    guard.reset()
    notice.value = 'Ai scris neobișnuit de repede. Scrie din nou, în ritmul tău.'
    return
  }
  const r = s.submitFinal(text.value, { cps: guard.charsPerSecond() })
  result.value = r
  if (r.unchanged) notice.value = 'Ai verificat deja textul ăsta — corectează-l întâi.'
  if (r.passed) {
    success.value = true
    setTimeout(() => s.next(), 1100)
  }
}
function show() {
  const k = s.stuckChunk(text.value)
  const chunk = s.lesson.chunks[k]
  const ms = showDuration(chunk)
  s.recordShow(ms, k)
  showing.value = true
  overlay.value.open(chunk, ms, `Bucata ${k + 1} — privește atent`)
}
async function listen() {
  const k = s.stuckChunk(text.value)
  s.recordListen(k)
  speaking.value = true
  await speakSentences(splitSentences(s.lesson.chunks[k]))
  speaking.value = false
  setTimeout(() => input.value?.focus())
}

function onOverlayClosed() {
  showing.value = false
  setTimeout(() => input.value?.focus())
}

function stopListening() {
  stopSpeaking()
  speaking.value = false
  setTimeout(() => input.value?.focus())
}

/* --- doar în modul de test --- */
function devFill(withMistake = false) {
  const words = s.fullText.split(' ')
  if (withMistake) words.splice(Math.floor(words.length / 2), 2)
  text.value = words.join(' ')
  devFilled = true
}
let devFilled = false

onMounted(() => input.value?.focus())
onBeforeUnmount(stopSpeaking)
</script>

<template>
  <div class="card">
    <div class="hidden-text">
      Scrie <b>toată lecția</b> din memorie, de la început până la sfârșit ({{ s.lesson.chunks.length }} bucăți).
    </div>
    <textarea
      ref="input"
      :value="text"
      @beforeinput="guard.onBeforeInput"
      @input="guard.onInput"
      style="min-height: 260px"
      placeholder="Scrie toată lecția…"
      spellcheck="false"
      autocomplete="off"
      :disabled="success || locked"
      @keydown="onKeydown"
      @paste="onPaste"
      @drop.prevent
    ></textarea>
    <div class="row" style="margin-top: 12px">
      <button class="btn primary" :disabled="success || locked" @click="check">Verifică</button>
      <button class="btn" :disabled="success || locked" @click="show">👁 Arată-mi unde m-am blocat</button>
      <button v-if="canSpeak() && !speaking" class="btn" :disabled="success || locked" @click="listen">🔊 Ascultă unde m-am blocat</button>
      <button v-if="speaking" class="btn" @click="stopListening">⏹ Gata, am ascultat</button>
    </div>
    <p v-if="speaking" class="tip">🔊 Ascultă… Poți scrie după ce se termină.</p>
    <div v-if="DEV_TOOLS && !success" class="row dev-bar">
      <span>🧪 Test:</span>
      <button class="btn small" @click="devFill()">Completează corect</button>
      <button class="btn small" @click="devFill(true)">Completează cu greșeli</button>
    </div>
    <div v-if="notice" class="feedback warn">{{ notice }}</div>
    <div v-if="success" class="feedback ok"><b>Bravo! Ai scris toată lecția.</b> Urmează câteva întrebări.</div>
    <div v-else-if="result" class="feedback bad">
      <b>{{ result.accuracy }}% corect.</b> Lipsesc {{ result.missing }} cuvinte<template v-if="result.extras">, {{ result.extras }} greșite sau în plus</template>.
      Te-ai blocat pe la bucata {{ result.stuckChunk + 1 }}.
      <DiffView :ops="result.ops" />
    </div>
    <ShowOverlay ref="overlay" @closed="onOverlayClosed" />
  </div>
</template>
