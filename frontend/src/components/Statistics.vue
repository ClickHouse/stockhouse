<template>
  <div class="relative border-2 border-dotted border-neutral-400 rounded-md p-4 mt-6 mb-6">
    <span class="absolute -top-3 left-4 bg-neutral-800 px-2 text-sm text-neutral-200">
      Statistics
    </span>
    <div>
      <label>Last updated: {{ lastUpdated || '-' }}</label>
    </div>
    <div>
      <label>Average response time: {{ avgResponseTime || '-' }}</label>
    </div>
    <div>
      <label>Total Downloaded: {{ totalDownload || '-' }}</label>
    </div>
    <div>
      <label>Server region: {{ serverRegion }}</label>
    </div>
    <div>
      <label>Ping time: {{ pingTime || '-' }}</label>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  lastUpdated: String,
  avgResponseTime: String,
  totalDownload: String,
  serverRegion: {
    type: String,
    default: 'us-central1'
  },
  pingTime: String
})
</script>
