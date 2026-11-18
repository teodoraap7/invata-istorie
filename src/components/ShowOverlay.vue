<script setup>
// Arată textul câteva secunde, cu o bară care scade, apoi îl ascunde singur.
import { ref, nextTick, onBeforeUnmount } from 'vue'

const emit = defineEmits(['closed'])
const visible = ref(false)
const text = ref('')
const title = ref('')
const width = ref('100%')
const duration = ref(0)
let timer = null

async function open(t, ms, heading = 'Privește atent — dispare în curând') {
  text.value = t
  title.value = heading
  duration.value = 0
  width.value = '100%'
  visible.value = true
  await nextTick()
  requestAnimationFrame(() => {
    duration.value = ms
    width.value = '0%'
  })
  clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
    emit('closed')
  }, ms)
}

onBeforeUnmount(() => clearTimeout(timer))
defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay">
      <div class="box">
        <span class="pill">{{ title }}</span>
        <div class="reading" style="margin-top: 12px">{{ text }}</div>
        <div class="count"><i :style="{ width, transition: `width ${duration}ms linear` }"></i></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(31, 27, 22, 0.55); display: flex; align-items: center; justify-content: center; z-index: 20; padding: 20px; }
.box { background: var(--card); border-radius: 16px; max-width: 720px; width: 100%; padding: 26px 28px; }
.count { height: 5px; background: var(--line); border-radius: 9px; overflow: hidden; margin-top: 14px; }
.count i { display: block; height: 100%; background: var(--accent); }
</style>
