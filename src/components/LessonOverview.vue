<script setup>
// Primul ecran: lecția completă. O citește (sau o ascultă) o dată, apoi trece la învățare.
import { ref, computed, onBeforeUnmount } from 'vue'
import { useSessionStore } from '@/stores/session'
import { splitSentences } from '@/lib/compare'
import { speakSentences, stopSpeaking, canSpeak } from '@/lib/speech'
import LessonText from './LessonText.vue'

const s = useSessionStore()
const speakingChunk = ref(-1)
const speaking = ref(false)

// toate propozițiile, ținând minte din ce bucată e fiecare (pentru evidențiere)
const sentences = computed(() =>
  s.lesson.chunks.flatMap((c, i) => splitSentences(c).map((text) => ({ text, chunk: i }))),
)

async function listen() {
  s.recordListen()
  speaking.value = true
  const list = sentences.value
  await speakSentences(
    list.map((x) => x.text),
    (k) => {
      speakingChunk.value = k >= 0 ? list[k].chunk : -1
      if (k >= 0) document.getElementById(`chunk-${list[k].chunk}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
  )
  speaking.value = false
}
function stop() {
  stopSpeaking()
  speaking.value = false
  speakingChunk.value = -1
}
function start() {
  stopSpeaking()
  s.markOverviewDone()
}

onBeforeUnmount(stopSpeaking)
</script>

<template>
  <h1>{{ s.lesson.title }}</h1>
  <p class="sub">Citește toată lecția o dată, ca să vezi întregul. Apoi o învățăm bucată cu bucată ({{ s.lesson.chunks.length }} bucăți).</p>
  <div class="card">
    <LessonText :lesson="s.lesson" :speaking="speakingChunk" />
  </div>
  <div class="actions row">
    <template v-if="canSpeak()">
      <button v-if="!speaking" class="btn" @click="listen">🔊 Ascultă toată lecția</button>
      <button v-else class="btn" @click="stop">⏹ Oprește</button>
    </template>
    <button class="btn primary" @click="start">Am citit-o, încep învățarea ➜</button>
  </div>
</template>

<style scoped>
.actions { position: sticky; bottom: 0; background: var(--bg); padding: 12px 0; border-top: 1px solid var(--line); }
</style>
