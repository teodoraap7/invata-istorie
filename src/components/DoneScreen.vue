<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { summarize } from '@/lib/summary'
import { formatDuration } from '@/lib/format'

const s = useSessionStore()
const router = useRouter()
const sum = computed(() => summarize(s.run))
</script>

<template>
  <h1>Gata, {{ s.run.learnerName }}! 🎉</h1>
  <p class="sub">Ai terminat „{{ s.lesson.title }}”.</p>
  <div class="card">
    <div class="stats">
      <div class="stat"><b>{{ formatDuration(sum.activeMs) }}</b><span>timp de lucru</span></div>
      <div class="stat"><b>{{ sum.firstTry }}/{{ sum.chunkCount }}</b><span>bucăți scrise din prima</span></div>
      <div class="stat"><b>{{ sum.quizCorrect }}/{{ sum.quizTotal }}</b><span>întrebări corecte</span></div>
      <div class="stat"><b>{{ sum.helps }}</b><span>ajutoare cerute</span></div>
    </div>
    <p v-if="sum.hardest.length">
      Merită recitite: {{ sum.hardest.map((i) => `bucata ${i + 1}`).join(', ') }}.
    </p>
    <p v-else>Toate bucățile au mers bine.</p>
    <div class="row">
      <button class="btn primary" @click="router.push('/')">Altă lecție / din nou</button>
    </div>
  </div>
</template>
