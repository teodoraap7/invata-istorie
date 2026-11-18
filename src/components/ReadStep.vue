<script setup>
// Pasul 1: textul pe ecran + citit cu voce tare, cu propoziția curentă evidențiată.
import { ref, computed, onBeforeUnmount } from 'vue'
import { useSessionStore } from '@/stores/session'
import { splitSentences } from '@/lib/compare'
import { speakSentences, stopSpeaking, canSpeak } from '@/lib/speech'
import { formatDuration } from '@/lib/format'
// mod de test: doar cu npm run dev (în build-ul publicat codul e scos complet)
const DEV_TOOLS = import.meta.env.DEV

const s = useSessionStore()
const sentences = computed(() => splitSentences(s.chunkText))
const active = ref(-1)
const warning = ref('')

function listen() {
  s.recordListen()
  speakSentences(sentences.value, (i) => (active.value = i))
}

function done() {
  stopSpeaking()
  const r = s.markRead({ skipSpeedCheck: DEV_TOOLS })
  if (r.tooFast) {
    warning.value = `Ai citit foarte repede (${formatDuration(r.ms)}). Mai citește o dată cu atenție, apoi apasă din nou.`
  }
}

onBeforeUnmount(stopSpeaking)
</script>

<template>
  <div class="card">
    <div v-if="s.lesson.cues?.[s.step.chunk]" class="cue">Î: {{ s.lesson.cues[s.step.chunk] }}</div>
    <div class="reading">
      <template v-for="(sentence, i) in sentences" :key="i">
        <span :class="{ on: i === active }" class="sentence">{{ sentence }}</span>{{ ' ' }}
      </template>
    </div>
    <div class="row">
      <button v-if="canSpeak()" class="btn" @click="listen">🔊 Ascultă și urmărește</button>
      <button class="btn primary" @click="done">Am citit, mergem mai departe ➜</button>
    </div>
    <div v-if="warning" class="feedback warn">{{ warning }}</div>
    <p class="tip">Citește de 2–3 ori, cu voce tare dacă poți. Urmează să o scrii.</p>
  </div>
</template>

<style scoped>
.sentence { border-radius: 4px; transition: background 0.2s; }
.sentence.on { background: var(--highlight); }
</style>
