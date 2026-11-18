<script setup>
// O întrebare. La răspuns greșit arătăm răspunsul corect și bucata de recitit.
import { ref, onMounted } from 'vue'
import { useSessionStore } from '@/stores/session'
// mod de test: doar cu npm run dev (în build-ul publicat codul e scos complet)
const DEV_TOOLS = import.meta.env.DEV

const s = useSessionStore()
const q = s.currentQuestion
const answer = ref('')
const feedback = ref(null)
const input = ref(null)
const nextBtn = ref(null)

function submit() {
  if (feedback.value || !answer.value.trim()) return
  feedback.value = s.answerQuestion(answer.value)
  setTimeout(() => nextBtn.value?.focus())
}

onMounted(() => input.value?.focus())
</script>

<template>
  <div class="card">
    <span class="pill" :class="{ warn: q.type === 'cloze' }">
      {{ q.type === 'cloze' ? 'Completează spațiul liber' : 'Întrebare' }}
    </span>
    <div class="question">{{ q.q }}</div>
    <input
      ref="input"
      v-model="answer"
      type="text"
      placeholder="Răspunsul tău"
      autocomplete="off"
      :disabled="!!feedback"
      @keydown.enter="submit"
      @paste.prevent="s.recordPaste()"
    />
    <div class="row" style="margin-top: 12px">
      <button class="btn primary" :disabled="!!feedback" @click="submit">Răspunde</button>
      <template v-if="DEV_TOOLS && !feedback">
        <span class="tip">🧪</span>
        <button class="btn small" @click="answer = q.a">Răspuns corect</button>
        <button class="btn small" @click="answer = 'nu știu'">Răspuns greșit</button>
      </template>
    </div>
    <div v-if="feedback" class="feedback" :class="feedback.correct ? 'ok' : 'bad'">
      <b v-if="feedback.correct">Corect!</b>
      <template v-else>
        <b>Nu chiar.</b> Răspunsul: <b>{{ feedback.correctAnswer }}</b>
        <p class="tip">Recitește bucata {{ feedback.relatedChunk + 1 }}: <i>{{ s.lesson.chunks[feedback.relatedChunk] }}</i></p>
      </template>
      <div class="row" style="margin-top: 10px">
        <button ref="nextBtn" class="btn primary" @click="s.nextQuestion()">
          {{ s.quizIndex + 1 < s.quiz.length ? 'Următoarea ➜' : 'Vezi rezultatul ➜' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.question { font-family: var(--serif); font-size: 19px; margin: 8px 0 14px; }
</style>
