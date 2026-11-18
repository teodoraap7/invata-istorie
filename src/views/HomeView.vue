<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { loadLessons } from '@/lib/lessons'
import { wordCount } from '@/lib/compare'
// mod de test: doar cu npm run dev (în build-ul publicat codul e scos complet)
const DEV_TOOLS = import.meta.env.DEV

const router = useRouter()
const s = useSessionStore()
const lessons = ref([])
const loading = ref(true)
const selectedId = ref(null)
const name = ref(localStorage.getItem('memorez_name') || '')
const error = ref('')
const testRun = ref(true)

watch(name, (v) => localStorage.setItem('memorez_name', v))

const byChapter = computed(() => {
  const groups = {}
  for (const l of lessons.value) (groups[l.chapter || 'Fără capitol'] ||= []).push(l)
  return groups
})

onMounted(async () => {
  lessons.value = await loadLessons()
  selectedId.value = lessons.value[0]?.id ?? null
  loading.value = false
})

function start() {
  if (!name.value.trim()) {
    error.value = 'Scrie-ți numele mai întâi.'
    return
  }
  const lesson = lessons.value.find((l) => l.id === selectedId.value)
  if (!lesson) return
  s.start(lesson, name.value, { test: DEV_TOOLS && testRun.value })
  router.push('/learn')
}
</script>

<template>
  <h1>Învățăm lecția pe bucăți</h1>
  <p class="sub">Citești, scrii după text, apoi scrii din memorie. Treci mai departe doar când ai scris bucata.</p>

  <div class="card">
    <label for="name">Cum te cheamă?</label>
    <input id="name" v-model="name" type="text" placeholder="Numele tău" maxlength="60" />

    <label>Alege lecția</label>
    <p v-if="loading" class="tip">Se încarcă lecțiile…</p>
    <template v-for="(list, chapter) in byChapter" :key="chapter">
      <div class="chapter">{{ chapter }}</div>
      <div class="lessons">
        <button
          v-for="l in list"
          :key="l.id"
          class="lesson"
          :class="{ selected: l.id === selectedId }"
          @click="selectedId = l.id"
        >
          <b>{{ l.title }}</b>
          <small>
            {{ l.chunks.length }} bucăți ·
            {{ l.chunks.reduce((a, c) => a + wordCount(c), 0) }} cuvinte ·
            {{ (l.questions || []).length }} întrebări
          </small>
        </button>
      </div>
    </template>

    <label v-if="DEV_TOOLS" class="dev-check">
      <input v-model="testRun" type="checkbox" /> 🧪 Sesiune de test (marcată „TEST” în panou)
    </label>

    <div class="row" style="margin-top: 18px">
      <button class="btn primary" :disabled="!selectedId" @click="start">Începe lecția ➜</button>
      <span class="tip">{{ error }}</span>
    </div>
  </div>

  <div class="card">
    <h2>Cum funcționează</h2>
    <div class="steps">
      <div><b>1 · Citești</b>Bucata apare pe ecran și ți se citește cu voce tare.</div>
      <div><b>2 · Scrii după text</b>O transcrii având textul în față.</div>
      <div><b>3 · Din memorie</b>Textul dispare. Dacă te blochezi, ceri să-l vezi sau să-l asculți.</div>
      <div><b>4 · Recapitulare</b>La final scrii toată lecția, apoi răspunzi la întrebări.</div>
    </div>
    <p class="tip">Dacă îți merge bine, sari peste pasul 2. Bucățile grele le repeți înainte de recapitulare.</p>
  </div>
</template>

<style scoped>
.dev-check { font-weight: 500; display: flex; gap: 8px; align-items: center; margin-top: 14px; }
.chapter { margin: 10px 0 6px; font-weight: 600; color: var(--muted); font-size: 13px; }
.lessons { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.lesson { text-align: left; font: inherit; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; cursor: pointer; background: #fff; color: var(--ink); }
.lesson.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.lesson small { color: var(--muted); display: block; }
.steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
.steps div { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; }
.steps b { display: block; margin-bottom: 2px; }
</style>
