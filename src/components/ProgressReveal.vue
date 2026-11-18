<script setup>
// După fiecare bucată: toată lecția — ce a învățat e negru, restul estompat;
// bucata tocmai terminată se „înnegrește” animat. Trece singur după câteva secunde.
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useSessionStore } from '@/stores/session'
import LessonText from './LessonText.vue'

const AUTO_MS = 4000

const s = useSessionStore()
const done = computed(() => s.step.chunk + 1)
const total = computed(() => s.lesson.chunks.length)
const remaining = ref(AUTO_MS)
let timer = null
let ticker = null

function go() {
  clearTimeout(timer)
  clearInterval(ticker)
  s.next()
}
function onKey(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    go()
  }
}

onMounted(async () => {
  await nextTick()
  document.getElementById(`chunk-${s.step.chunk}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  timer = setTimeout(go, AUTO_MS)
  ticker = setInterval(() => (remaining.value = Math.max(0, remaining.value - 100)), 100)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  clearInterval(ticker)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="head">
    <h2>{{ done === total ? 'Ai trecut prin toată lecția! 🎉' : `Bravo! ${done} din ${total} bucăți învățate` }}</h2>
    <button class="btn primary" @click="go">
      {{ done === total ? 'Mergem mai departe ➜' : 'Următoarea bucată ➜' }}
    </button>
  </div>
  <div class="timer"><i :style="{ width: (100 * remaining) / AUTO_MS + '%' }"></i></div>
  <div class="card">
    <LessonText :lesson="s.lesson" :done-count="done - 1" :revealing="s.step.chunk" />
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.head h2 { margin: 0; }
.timer { height: 4px; background: var(--line); border-radius: 9px; overflow: hidden; margin-bottom: 14px; }
.timer i { display: block; height: 100%; background: var(--ok); transition: width 0.1s linear; }
</style>
