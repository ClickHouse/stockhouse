<template>
  <div
    :id="`${marketType}-main`"
    v-show="visible"
    class="border-t border-neutral-700 md:px-4 lg:px-16 pb-2 flex flex-col flex-1 min-h-0 "
  >
    <div
     
      :id="`${marketType}-controls`"
      class="flex  w-full items-center h-[54px] py-4"
      :class="marketType === 'stock' ? 'justify-between' : 'justify-end'"
    >
      <div v-if="marketType === 'stock'" class="text-xs text-neutral-400 italic">
        Stock data is delayed by 15 minutes
      </div>

      <div v-show="showSpread" class="flex items-center gap-3">
        <div v-show="showCandlestickInterval" class="inline-flex rounded-lg ring-1 ring-neutral-600 overflow-hidden">
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
          class="bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          Close
        </button>
      </div>
    </div>

    <div :id="`${marketType}-container`" class="flex flex-1 overflow-hidden relative min-h-0">
      <div :id="`${marketType}-table-container`" class="flex flex-col flex-1 relative min-h-0">
        <perspective-viewer :ref="setTableRef" theme="Pro Dark"></perspective-viewer>
      </div>
      <div :id="`${marketType}-spread-container`" class="flex flex-col flex-1 relative min-h-0">
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

const setTableRef = (el) => {
  tableViewer.value = el
}

const setSpreadRef = (el) => {
  spreadViewer.value = el
}

const getButtonClass = (interval) => {
  const baseClass = 'px-4 py-2 text-sm min-w-[56px] transition-colors font-medium hover:cursor-pointer'
  const activeClass = 'bg-[#eef400] text-neutral-900'
  const inactiveClass = 'bg-neutral-800 text-white hover:bg-neutral-700'

  return `${baseClass} ${props.selectedInterval === interval ? activeClass : inactiveClass}`
}

onMounted(() => {
  emit('viewer-ready', {
    tableViewer: tableViewer.value,
    spreadViewer: spreadViewer.value
  })
})
</script>
