<script setup>
// Toată lecția. Bucățile terminate (index < doneCount) sunt negre, restul estompate.
// `revealing`: bucata care tocmai a fost terminată — se „înnegrește” animat.
// `speaking`: bucata citită acum cu voce tare (evidențiată).
defineProps({
  lesson: { type: Object, required: true },
  doneCount: { type: Number, default: null }, // null = toate la fel (fără progres)
  revealing: { type: Number, default: -1 },
  speaking: { type: Number, default: -1 },
})
</script>

<template>
  <div class="lesson-text">
    <div
      v-for="(chunk, i) in lesson.chunks"
      :id="`chunk-${i}`"
      :key="i"
      class="chunk"
      :class="{
        done: doneCount === null || i < doneCount,
        todo: doneCount !== null && i >= doneCount && i !== revealing,
        revealing: i === revealing,
        speaking: i === speaking,
      }"
    >
      <div v-if="lesson.cues?.[i]" class="cue">Î: {{ lesson.cues[i] }}</div>
      <p>{{ chunk }}</p>
    </div>
  </div>
</template>

<style scoped>
.lesson-text { font-family: var(--serif); font-size: 18px; line-height: 1.65; }
.chunk { padding: 8px 12px; margin: 0 -12px 6px; border-radius: 10px; transition: opacity 0.6s, color 0.6s, background 0.3s; }
.chunk p { margin: 0; }
.chunk .cue { font-family: Inter, sans-serif; font-size: 14px; margin-bottom: 2px; }
.chunk.done { color: var(--ink); opacity: 1; }
.chunk.todo { opacity: 0.28; }
.chunk.speaking { background: var(--highlight); }
.chunk.revealing { animation: reveal 1.6s ease-out forwards; }
@keyframes reveal {
  0% { opacity: 0.28; background: transparent; }
  40% { opacity: 1; background: var(--ok-soft); }
  100% { opacity: 1; background: transparent; }
}
</style>
