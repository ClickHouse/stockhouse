<template>
  <div
    :id="`${marketType}-main`"
    v-show="visible"
    class="relative h-full border-t border-[#666]"
  >
    <div :id="`${marketType}-controls`" class="flex min-h-[36px] w-full justify-end">
      <div v-show="showCandlestickInterval" class="flex items-center">
        <button
          v-for="interval in intervals"
          :key="interval.value"
          @click="emit('interval-change', interval.value)"
          :class="getButtonClass(interval.value)"
        >
          {{ interval.label }}
        </button>
      </div>

      <button
        v-show="showCloseButton"
        @click="emit('close-spread')"
        class="bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1 m-1 rounded text-sm w-24"
      >
        Close
      </button>
    </div>

    <div :id="`${marketType}-container`" class="flex flex-auto overflow-hidden relative h-full min-h-[300px]">
      <div :id="`${marketType}-table-container`" class="flex flex-col flex-1 relative h-full min-h-[300px]">
        <perspective-viewer :ref="setTableRef" theme="Pro Dark"></perspective-viewer>
      </div>
      <div :id="`${marketType}-spread-container`" class="flex flex-col flex-1 relative h-full min-h-[300px]">
        <div
          v-show="!showSpread"
          class="flex items-center justify-center w-full h-full text-base text-[#888]"
        >
          Select a ticker to show details
        </div>
        <perspective-viewer
          :ref="setSpreadRef"
          v-show="showSpread"
          theme="Pro Dark"
        ></perspective-viewer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  marketType: {
    type: String,
    required: true,
    validator: (value) => ['crypto', 'stock'].includes(value)
  },
  visible: Boolean,
  showSpread: Boolean,
  showCloseButton: Boolean,
  showCandlestickInterval: Boolean,
  selectedInterval: String
})

const emit = defineEmits(['interval-change', 'close-spread', 'viewer-ready'])

const intervals = [
  { value: '5min', label: '5M' },
  { value: '30min', label: '30M' },
  { value: '1hour', label: '1H' },
  { value: '1day', label: '1D' }
]

const tableViewer = ref(null)
const spreadViewer = ref(null)

// Template refs handlers
const setTableRef = (el) => {
  tableViewer.value = el
}

const setSpreadRef = (el) => {
  spreadViewer.value = el
}

const getButtonClass = (interval) => {
  const baseClass = 'text-white px-3 py-1 m-1 rounded text-sm w-14'
  const activeClass = 'bg-neutral-600'
  const inactiveClass = 'bg-neutral-700 hover:bg-neutral-600'

  return `${baseClass} ${props.selectedInterval === interval ? activeClass : inactiveClass}`
}

onMounted(() => {
  emit('viewer-ready', {
    tableViewer: tableViewer.value,
    spreadViewer: spreadViewer.value
  })
})
</script>
