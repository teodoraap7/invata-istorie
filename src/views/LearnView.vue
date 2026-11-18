<script setup>
// Ecranul de învățare: alege componenta potrivită pasului curent din store.
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { stopSpeaking } from '@/lib/speech'
import { syncState } from '@/lib/api'
// mod de test: doar cu npm run dev (în build-ul publicat codul e scos complet)
const DEV_TOOLS = import.meta.env.DEV
import LessonOverview from '@/components/LessonOverview.vue'
import ProgressReveal from '@/components/ProgressReveal.vue'
import ReadStep from '@/components/ReadStep.vue'
import WriteStep from '@/components/WriteStep.vue'
import FinalReview from '@/components/FinalReview.vue'
import QuizStep from '@/components/QuizStep.vue'
import DoneScreen from '@/components/DoneScreen.vue'

const s = useSessionStore()
const router = useRouter()

const LABELS = {
  read: 'Pasul 1 · Citește',
  copy: 'Pasul 2 · Scrie după text',
  recall: 'Pasul 3 · Din memorie',
  final: 'Recapitulare · Toată lecția',
  quiz: 'Întrebări',
}

const SYNC = { idle: '', sending: 'Se salvează…', ok: 'Salvat', offline: 'Fără internet — salvez mai târziu' }

const kind = computed(() => s.step?.kind)
const label = computed(() => {
  if (kind.value === 'recall' && s.step.again) return `Încă o dată ${s.step.round}/${s.step.of} · Din memorie`
  if (kind.value === 'recall' && s.step.repeat) return 'Repetare · Din memorie'
  if (kind.value === 'quiz') return `Întrebări · ${s.quizIndex + 1}/${s.quiz.length}`
  return LABELS[kind.value] || ''
})
const where = computed(() =>
  s.step?.chunk != null ? `Bucata ${s.step.chunk + 1}/${s.lesson.chunks.length}` : '',
)
// cheia forțează o componentă nouă (stare curată) la fiecare pas / întrebare
const stepKey = computed(() => `${s.pos}-${s.quizIndex}`)

function onVisibility() {
  s.setHidden(document.hidden)
}
function quit() {
  s.abandon()
  router.push('/')
}

onMounted(() => {
  if (!s.run) router.replace('/')
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  stopSpeaking()
})
</script>

<template>
  <div v-if="s.run && s.step">
    <template v-if="!['done', 'overview', 'progress'].includes(kind)">
      <div class="top">
        <div>
          <span class="pill">{{ label }}</span>
          <span class="tip" style="margin-left: 8px">{{ s.lesson.title }}<template v-if="where"> · {{ where }}</template></span>
        </div>
        <div class="row">
          <span class="sync" :class="syncState.status">{{ SYNC[syncState.status] }}</span>
          <button class="btn small ghost" @click="quit">✕ Oprește</button>
        </div>
      </div>
      <div class="bar"><i :style="{ width: s.progress + '%' }"></i></div>
      <div v-if="DEV_TOOLS" class="row dev-bar">
        <span>🧪 Sari la:</span>
        <button class="btn small" @click="s.devJumpTo('read', Math.max(0, s.lesson.chunks.length - 1))">Ultima bucată</button>
        <button class="btn small" @click="s.devJumpTo('final')">Recapitulare</button>
        <button class="btn small" @click="s.devJumpTo('quiz')">Întrebări</button>
        <button class="btn small" @click="s.devJumpTo('done')">Final</button>
      </div>
    </template>

    <LessonOverview v-if="kind === 'overview'" :key="stepKey" />
    <ProgressReveal v-else-if="kind === 'progress'" :key="stepKey" />
    <ReadStep v-else-if="kind === 'read'" :key="stepKey" />
    <WriteStep v-else-if="kind === 'copy' || kind === 'recall'" :key="stepKey" />
    <FinalReview v-else-if="kind === 'final'" :key="stepKey" />
    <QuizStep v-else-if="kind === 'quiz'" :key="stepKey" />
    <DoneScreen v-else-if="kind === 'done'" />
  </div>
</template>

<style scoped>
.top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.bar { height: 6px; background: var(--line); border-radius: 9px; overflow: hidden; margin-bottom: 18px; }
.bar i { display: block; height: 100%; background: var(--accent); transition: width 0.4s; }
.sync { font-size: 12.5px; color: var(--muted); }
.sync.ok::before { content: '● '; color: var(--ok); }
.sync.offline::before { content: '● '; color: var(--warn); }
</style>
