<script setup>
// Arată ce a scris elevul: verde = corect, roșu tăiat = greșit / în plus,
// „lipsesc N” = locul unde lipsesc cuvinte (fără să-i spunem care).
import { computed } from 'vue'

const props = defineProps({ ops: { type: Array, required: true } })

const parts = computed(() => {
  const out = []
  for (const op of props.ops) {
    const last = out.at(-1)
    if (op.type === 'missing') {
      if (last?.type === 'missing') last.count++
      else out.push({ type: 'missing', count: 1 })
    } else out.push(op)
  }
  return out
})
</script>

<template>
  <div class="diff">
    <template v-for="(p, i) in parts" :key="i">
      <span v-if="p.type === 'missing'" class="missing">lipsesc {{ p.count }}</span>
      <span v-else :class="p.type">{{ p.word }}</span>{{ ' ' }}
    </template>
  </div>
</template>

<style scoped>
.diff { font-family: var(--serif); font-size: 17px; line-height: 1.9; margin-top: 8px; }
.ok { color: var(--ok); }
.extra { color: var(--bad); text-decoration: line-through; text-decoration-thickness: 2px; }
.missing { display: inline-block; background: #fff; border: 1px solid var(--bad); color: var(--bad); border-radius: 5px; padding: 0 6px; font: 13px Inter, sans-serif; }
</style>
