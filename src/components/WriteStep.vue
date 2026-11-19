<script setup>
// Pasul 2 (copy: textul e vizibil) și pasul 3 (recall: textul e ascuns, cu ajutoare).
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
const isRecall = computed(() => s.step.kind === 'recall')
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
  const r = s.submitText(text.value, { cps: guard.charsPerSecond() })
  result.value = r
  if (r.unchanged) notice.value = 'Ai verificat deja textul ăsta — corectează-l întâi.'
  if (r.passed) {
    success.value = true
    setTimeout(() => s.next(), 900)
  } else input.value?.focus()
}
function show() {
  const ms = showDuration(s.chunkText)
  s.recordShow(ms)
  showing.value = true
  overlay.value.open(s.chunkText, ms)
}
async function listen() {
  s.recordListen()
  speaking.value = true
  await speakSentences(splitSentences(s.chunkText))
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
  const words = s.chunkText.split(' ')
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
    <div v-if="s.lesson.cues?.[s.step.chunk]" class="cue">Î: {{ s.lesson.cues[s.step.chunk] }}</div>
    <div v-if="isRecall" class="hidden-text">
      Textul e ascuns. Scrie bucata {{ s.step.chunk + 1 }} din memorie, de la cap la coadă.
      <template v-if="s.step.again"><br /><b>Încă o dată ({{ s.step.round }} din {{ s.step.of }}) — ca să se fixeze. Încearcă fără ajutor.</b></template>
      <template v-else-if="s.step.repeat"><br /><b>O repetăm pentru că a fost mai grea.</b></template>
    </div>
    <div v-else class="reading dim">{{ s.chunkText }}</div>

    <textarea
      ref="input"
      :value="text"
      @beforeinput="guard.onBeforeInput"
      @input="guard.onInput"
      placeholder="Scrie aici…"
      spellcheck="false"
      autocomplete="off"
      :disabled="success || locked"
      @keydown="onKeydown"
      @paste="onPaste"
      @drop.prevent
    ></textarea>

    <div class="row" style="margin-top: 12px">
      <button class="btn primary" :disabled="success || locked" @click="check">Verifică</button>
      <template v-if="isRecall">
        <button class="btn" :disabled="success || locked" @click="show">👁 Arată-mi textul</button>
        <button v-if="canSpeak() && !speaking" class="btn" :disabled="success || locked" @click="listen">🔊 Ascultă-l</button>
        <button v-if="speaking" class="btn" @click="stopListening">⏹ Gata, am ascultat</button>
      </template>
      <span class="tip"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> = verifică</span>
    </div>

    <p v-if="speaking" class="tip">🔊 Ascultă… Poți scrie după ce se termină.</p>
    <div v-if="DEV_TOOLS && !success" class="row dev-bar">
      <span>🧪 Test:</span>
      <button class="btn small" @click="devFill()">Completează corect</button>
      <button class="btn small" @click="devFill(true)">Completează cu greșeli</button>
    </div>
    <div v-if="notice" class="feedback warn">{{ notice }}</div>
    <div v-if="success" class="feedback ok">
      <b>Perfect!</b> {{ isRecall ? 'Ai scris-o din memorie.' : 'Acum o scrii fără să o vezi.' }}
    </div>
    <div v-else-if="result" class="feedback bad">
      <b>{{ result.accuracy }}% corect.</b>
      <template v-if="result.missingNumbers || result.extraNumbers"> Un an sau o cifră lipsește sau e greșită.</template>
      <template v-if="result.missing"> Lipsesc {{ result.missing }} cuvinte.</template>
      <template v-if="result.extras"> {{ result.extras }} cuvinte greșite sau în plus (tăiate cu roșu).</template>
      Corectează și verifică din nou.
      <DiffView :ops="result.ops" />
    </div>

    <ShowOverlay ref="overlay" @closed="onOverlayClosed" />
  </div>
</template>
