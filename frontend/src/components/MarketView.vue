<template>
  <div
    :id="`${marketType}-main`"
    v-show="visible"
    class="px-4 lg:px-16 pb-2 flex flex-col lg:flex-row flex-1 min-h-0 gap-2"
  >
    <!-- Table Section with Controls -->
    <div :id="`${marketType}-table-section`" class="flex flex-col h-[400px] lg:h-auto lg:min-h-0 w-full lg:w-[600px] overflow-x-auto">
      <div class="flex items-center py-4 gap-4 flex-shrink-0">
        <div v-if="marketType === 'stock'" class="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-4 w-full">
          
          <div class="w-full lg:flex-1">
            <TickerAutocomplete
              :available-tickers="availableTickers"
              :selected-tickers="selectedTickers"
              :loading="loadingTickers"
              @toggle-ticker="emit('toggle-ticker', $event)"
              @reset="emit('reset-tickers')"
            />
          </div>
        </div>

        <div v-if="marketType === 'crypto' && showPairSelector" class="flex items-center gap-4 w-full">
          <PairAutocomplete
            :available-pairs="availablePairs"
            :selected-pairs="selectedPairs"
            :loading="loadingPairs"
            @toggle-pair="emit('toggle-pair', $event)"
            @reset="emit('reset-pairs')"
          />
        </div>
      </div>
      
      <div :id="`${marketType}-table-container`" class="flex flex-col relative flex-1 min-h-0">
        <perspective-viewer :ref="setTableRef" theme="Monokai"></perspective-viewer>
        <div class="text-xs text-neutral-400 italic pt-2">
            Due to legal (not technical) requirements, stock data is delayed by 15 minutes. Crypto data is real-time.
          </div>
      </div>
    </div>

    <!-- Candlestick Section with Controls -->
    <div :id="`${marketType}-spread-section`" class="flex flex-col h-[500px] lg:h-auto lg:flex-1 lg:min-h-0 overflow-x-auto">
      <div class="flex items-center justify-end py-4 gap-3 flex-shrink-0 min-h-[74px]">
        <template v-if="showSpread">
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
        </template>
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
          theme="Monokai"
        ></perspective-viewer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TickerAutocomplete from './TickerAutocomplete.vue'
import PairAutocomplete from './PairAutocomplete.vue'

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
  selectedInterval: String,
  showPairSelector: {
    type: Boolean,
    default: false
  },
  availableTickers: {
    type: Array,
    default: () => []
  },
  selectedTickers: {
    type: Array,
    default: () => []
  },
  loadingTickers: {
    type: Boolean,
    default: false
  },
  availablePairs: {
    type: Array,
    default: () => []
  },
  selectedPairs: {
    type: Array,
    default: () => []
  },
  loadingPairs: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['interval-change', 'close-spread', 'viewer-ready', 'toggle-ticker', 'toggle-pair', 'reset-tickers', 'reset-pairs'])

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
