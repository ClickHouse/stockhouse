<template>
  <div class="relative border border-[#eef400] rounded-md p-6 mt-6 mb-6 bg-neutral-800/50 backdrop-blur-sm w-full lg:min-w-[380px] lg:h-[180px] max-w-[600px] lg:max-w-[380px]">
    <span class="absolute -top-3 left-[50%] translate-x-[-50%] border border-[#eef400] text-neutral-400 font-light rounded-full bg-[#1d1d1d] px-4 text-sm font-medium text-neutral-200">
      Statistics
    </span>
    <div class="space-y-2 text-sm text-neutral-200">
      <div class="flex justify-between gap-4">
        <span class="text-neutral-400 flex-shrink-0">Last updated:</span>
        <span class="font-medium text-right">{{ formattedLastUpdated }}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span class="text-neutral-400 flex-shrink-0">Avg response:</span>
        <span class="font-medium text-right">{{ avgResponseTime || '-' }}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span class="text-neutral-400 flex-shrink-0">Downloaded:</span>
        <span class="font-medium text-right">{{ totalDownload || '-' }}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span class="text-neutral-400 flex-shrink-0">Server region:</span>
        <span class="font-medium text-right">{{ serverRegion }}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span class="text-neutral-400 flex-shrink-0">Ping time:</span>
        <span class="font-medium text-right">{{ pingTime || '-' }}</span>
      </div>
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

// Format the datetime with millisecond precision for high-frequency data
const formattedLastUpdated = computed(() => {
  if (!props.lastUpdated || props.lastUpdated === '-') return '-'

  try {
    const date = new Date(props.lastUpdated)
    // Format as: "Nov 4, 15:30:45.123"
    const options = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
    const baseTime = date.toLocaleString('en-US', options)
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0')
    return `${baseTime}.${milliseconds}`
  } catch (e) {
    return props.lastUpdated
  }
})
</script>
