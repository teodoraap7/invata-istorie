<script setup>
// Detaliile unei sesiuni, în panoul tău.
import { computed } from 'vue'
import { summarize } from '@/lib/summary'
import { formatDuration } from '@/lib/format'
import { EVENT_LABELS, eventDetail, clock } from '@/lib/eventLabels'

const props = defineProps({
  run: { type: Object, required: true },
  events: { type: Array, default: null }, // null = încă se încarcă
})

const sum = computed(() => summarize(props.run))
const hints = computed(() => props.run.final?.hints || {})

const insights = computed(() => {
  const r = props.run
  const s = sum.value
  const out = []
  if (s.hardest.length) out.push(`Cele mai grele: ${s.hardest.slice(0, 3).map((i) => `bucata ${i + 1}`).join(', ')}.`)
  out.push(`${s.firstTry} din ${s.chunkCount} bucăți scrise din prima, fără ajutor.`)
  if (s.wordsPerMinute) out.push(`Viteză de citire: ~${s.wordsPerMinute} cuvinte/minut.`)
  const thinks = r.chunks.filter((c) => c.thinkMs != null)
  if (thinks.length) {
    const avg = thinks.reduce((a, c) => a + c.thinkMs, 0) / thinks.length
    out.push(`Stă în medie ${formatDuration(avg)} până începe să scrie din memorie.`)
  }
  if (s.helps) out.push(`A cerut ajutor de ${s.helps} ori (${s.shows}× să vadă, ${s.listens}× să asculte).`)
  if (s.againRounds) out.push(`A rescris ${s.againRounds} bucăți după ce a cerut ajutor.`)
  if (r.awayCount) out.push(`A ieșit din aplicație de ${r.awayCount} ori (${formatDuration(r.awayMs)}).`)
  if (s.pastes) out.push(`A încercat de ${s.pastes} ori să lipească text.`)
  if (s.copySkipped) out.push(`${s.copySkipped} bucăți au sărit peste copiere (îi mergea bine).`)
  return out
})

const STATUS = { done: ['terminată', 'ok'], abandoned: ['întreruptă', 'bad'], in_progress: ['în desfășurare', 'warn'] }
const status = computed(() => {
  const live = props.run.status === 'in_progress' && Date.now() - (props.run.updatedAt || 0) < 3 * 60000
  const [text, cls] = STATUS[props.run.status] || [props.run.status, '']
  return { text: live ? '● live' : text, cls }
})
const date = (t) => (t ? new Date(t).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
</script>

<template>
  <div class="card">
    <div class="head">
      <div>
        <h2>{{ run.learnerName }} — {{ run.lessonTitle }}</h2>
        <span class="tip">{{ run.chapter }} · început {{ date(run.startedAt) }}</span>
      </div>
      <div class="row">
        <span v-if="run.test" class="pill bad">TEST</span>
        <span class="pill" :class="status.cls">{{ status.text }}</span>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><b>{{ formatDuration(sum.activeMs) }}</b><span>timp activ (total {{ formatDuration(sum.totalMs) }})</span></div>
      <div class="stat"><b>{{ formatDuration(sum.overviewMs) }}</b><span>lecția completă, la început{{ sum.overviewListens ? ` (ascultată ${sum.overviewListens}×)` : '' }}</span></div>
      <div class="stat"><b>{{ formatDuration(sum.readMs) }}</b><span>citire pe bucăți</span></div>
      <div class="stat"><b>{{ formatDuration(sum.copyMs + sum.recallMs) }}</b><span>scris pe bucăți</span></div>
      <div class="stat"><b>{{ formatDuration(sum.finalMs) }}</b><span>recapitulare</span></div>
      <div class="stat"><b>{{ sum.shows }}</b><span>a cerut să vadă ({{ formatDuration(sum.showMs) }})</span></div>
      <div class="stat"><b>{{ sum.listens + sum.readListens }}</b><span>ascultări ({{ sum.readListens }} la citire)</span></div>
      <div class="stat"><b>{{ sum.attempts }}</b><span>verificări</span></div>
      <div class="stat"><b>{{ sum.quizTotal ? `${sum.quizCorrect}/${sum.quizTotal}` : '—' }}</b><span>întrebări corecte</span></div>
    </div>

    <h3>Pe scurt</h3>
    <ul>
      <li v-for="(line, i) in insights" :key="i">{{ line }}</li>
    </ul>

    <h3>Pe bucăți</h3>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>#</th><th class="num">Citire</th><th class="num">Ascultat</th><th class="num">Copiere</th>
            <th class="num">Până scrie</th><th class="num">Din memorie</th><th class="num">Vede / Ascultă</th>
            <th>Din prima</th><th>Încă o dată</th><th>Repetare</th><th class="num">Recapit.</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in run.chunks" :key="c.i">
            <td><b>{{ c.i + 1 }}</b></td>
            <td class="num">{{ c.readMs ? formatDuration(c.readMs) : '—' }}</td>
            <td class="num">{{ c.readListens }}×</td>
            <td class="num">{{ c.copySkipped ? 'sărit' : c.copyAttempts ? `${c.copyAttempts}× · ${formatDuration(c.copyMs)}` : '—' }}</td>
            <td class="num">{{ c.thinkMs != null ? formatDuration(c.thinkMs) : '—' }}</td>
            <td class="num">
              <template v-if="c.recallAttempts">
                {{ c.recallAttempts }}× · {{ formatDuration(c.recallMs) }}
                <div class="tip">{{ c.accuracy.join('% → ') }}%</div>
              </template>
              <template v-else>—</template>
            </td>
            <td class="num">{{ c.shows }} / {{ c.listens }}</td>
            <td>{{ c.firstTry ? '✅' : c.firstTry === false ? '—' : '' }}</td>
            <td>{{ (c.again || []).length ? `${c.again.length} rundă(e)` : '' }}</td>
            <td>{{ c.repeat ? `${c.repeat.attempts}× · ${formatDuration(c.repeat.ms)}` : '' }}</td>
            <td class="num">{{ hints[c.i] ? `${hints[c.i]} ajutor` : '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3>Recapitularea întregii lecții</h3>
    <p v-if="run.final">
      {{ formatDuration(run.final.ms) }} · {{ run.final.attempts }} verificări ({{ run.final.accuracy.join('% → ') }}%) ·
      {{ run.final.shows }}× a văzut, {{ run.final.listens }}× a ascultat
    </p>
    <p v-else class="tip">Încă nu a ajuns la recapitulare.</p>

    <h3>Întrebări</h3>
    <table v-if="run.quiz?.length">
      <thead><tr><th>Întrebare</th><th>Răspunsul elevului</th><th>Corect</th><th class="num">Timp</th></tr></thead>
      <tbody>
        <tr v-for="(q, i) in run.quiz" :key="i">
          <td>{{ q.q }}</td>
          <td>{{ q.answer }}<div v-if="!q.correct" class="tip">corect: {{ q.a }}</div></td>
          <td>{{ q.correct ? '✅' : '❌' }}</td>
          <td class="num">{{ formatDuration(q.ms) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="tip">Încă nu a răspuns la întrebări.</p>

    <details>
      <summary><b>Cronologie completă</b></summary>
      <p v-if="events === null" class="tip">Se încarcă…</p>
      <div v-else class="timeline">
        <div v-for="(e, i) in events" :key="i">
          <code>{{ clock(e.t) }}</code> {{ EVENT_LABELS[e.type] || e.type }}
          <span class="tip">{{ eventDetail(e) }}</span>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
h2 { margin: 0; }
h3 { font-size: 15px; margin: 18px 0 8px; }
ul { margin: 0; padding-left: 20px; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; background: #fff; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { background: #f1ece4; font-size: 12.5px; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
details { margin-top: 16px; }
.timeline { max-height: 380px; overflow: auto; font-size: 13px; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; margin-top: 8px; }
.timeline div { padding: 3px 0; border-bottom: 1px dashed var(--line); }
.timeline code { color: var(--muted); margin-right: 8px; }
</style>
