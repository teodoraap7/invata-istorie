<script setup>
// Panoul tău: cere parola, apoi arată elevii, sesiunile și detaliile. Se actualizează singur.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { adminRuns, adminRun } from '@/lib/api'
import RunDetail from '@/components/RunDetail.vue'

const REFRESH_MS = 20000

const key = ref(sessionStorage.getItem('memorez_admin') || '')
const loggedIn = ref(false)
const loading = ref(false)
const error = ref('')
const runs = ref([])
const selectedLearner = ref(null)
const selectedRunId = ref(null)
const events = ref(null)
let timer = null

const learners = computed(() => {
  const map = new Map()
  for (const r of runs.value) {
    const name = r.learnerName || 'Fără nume'
    if (!map.has(name)) map.set(name, { name, runs: [], last: 0 })
    const l = map.get(name)
    l.runs.push(r)
    l.last = Math.max(l.last, r.updatedAt || r.startedAt)
  }
  return [...map.values()].sort((a, b) => b.last - a.last)
})
const learnerRuns = computed(() => learners.value.find((l) => l.name === selectedLearner.value)?.runs || [])
const selectedRun = computed(() => runs.value.find((r) => r.id === selectedRunId.value))

async function load() {
  loading.value = true
  error.value = ''
  try {
    runs.value = await adminRuns(key.value)
    loggedIn.value = true
    sessionStorage.setItem('memorez_admin', key.value)
    if (!selectedLearner.value && learners.value[0]) selectLearner(learners.value[0].name)
    else if (selectedRunId.value) loadEvents()
  } catch (e) {
    if (String(e.message).includes('wrong_password')) {
      error.value = 'Parolă greșită.'
      loggedIn.value = false
      sessionStorage.removeItem('memorez_admin')
    } else error.value = 'Nu pot lua datele acum. Verifică internetul.'
  } finally {
    loading.value = false
  }
}

function selectLearner(name) {
  selectedLearner.value = name
  selectRun(learnerRuns.value[0]?.id ?? null)
}

async function selectRun(id) {
  selectedRunId.value = id
  events.value = null
  if (id) loadEvents()
}

async function loadEvents() {
  const id = selectedRunId.value
  try {
    const full = await adminRun(key.value, id)
    if (selectedRunId.value === id) events.value = full.events || []
  } catch {
    events.value = []
  }
}

function logout() {
  sessionStorage.removeItem('memorez_admin')
  key.value = ''
  loggedIn.value = false
  runs.value = []
}

const date = (t) => new Date(t).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

onMounted(() => {
  if (key.value) load()
  timer = setInterval(() => loggedIn.value && !loading.value && load(), REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div v-if="!loggedIn" class="card login">
    <h1>Panou date</h1>
    <p class="sub">Introdu parola (ADMIN_KEY din Apps Script).</p>
    <form @submit.prevent="load">
      <input v-model="key" type="password" placeholder="Parola" autocomplete="current-password" />
      <div class="row" style="margin-top: 12px">
        <button class="btn primary" :disabled="!key || loading">{{ loading ? 'Se verifică…' : 'Intră' }}</button>
        <span class="tip">{{ error }}</span>
      </div>
    </form>
  </div>

  <template v-else>
    <div class="top">
      <div>
        <h1>Panou date</h1>
        <p class="sub">Se actualizează singur la 20 s. {{ error }}</p>
      </div>
      <div class="row">
        <button class="btn small" :disabled="loading" @click="load">{{ loading ? '…' : '↻ Actualizează' }}</button>
        <button class="btn small ghost" @click="logout">Ieși</button>
      </div>
    </div>

    <p v-if="!runs.length" class="card tip">Încă nu a învățat nimeni.</p>
    <div v-else class="grid">
      <aside>
        <h3>Elevi</h3>
        <button v-for="l in learners" :key="l.name" class="item" :class="{ on: l.name === selectedLearner }" @click="selectLearner(l.name)">
          <b>{{ l.name }}</b><small>{{ l.runs.length }} sesiuni · {{ date(l.last) }}</small>
        </button>
        <h3>Sesiuni</h3>
        <button v-for="r in learnerRuns" :key="r.id" class="item" :class="{ on: r.id === selectedRunId }" @click="selectRun(r.id)">
          <span v-if="r.test" class="pill bad" style="margin-right: 6px">TEST</span>{{ r.lessonTitle }}<small>{{ date(r.startedAt) }} · {{ { done: 'terminată', abandoned: 'întreruptă', in_progress: 'în desfășurare' }[r.status] }}</small>
        </button>
      </aside>
      <section>
        <RunDetail v-if="selectedRun" :run="selectedRun" :events="events" />
      </section>
    </div>
  </template>
</template>

<style scoped>
.login { max-width: 420px; margin: 40px auto; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: 240px 1fr; gap: 16px; }
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
h3 { font-size: 14px; margin: 0 0 8px; }
aside h3:not(:first-child) { margin-top: 16px; }
.item { display: block; width: 100%; text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; font: inherit; cursor: pointer; color: var(--ink); }
.item.on { border-color: var(--accent); background: var(--accent-soft); }
.item small { display: block; color: var(--muted); font-size: 12px; }
input[type='password'] { width: 100%; font: inherit; padding: 11px 13px; border: 1px solid var(--line); border-radius: 10px; }
</style>
