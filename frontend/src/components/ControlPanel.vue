<template>
  <div class="relative border border-[#eef400] rounded-lg p-6 mt-6 mb-6 bg-neutral-800/50 backdrop-blur-sm flex-1 lg:flex-initial lg:min-w-[600px]">
    <!-- Title -->
    <span class="absolute -top-3 left-[50%] border border-[#eef400] text-neutral-400 font-light rounded-full translate-x-[-50%] bg-[#1d1d1d] px-4 text-sm font-medium text-neutral-200 ">
      Controls
    </span>
    <div class="space-y-6 text-neutral-200 flex gap-8 flex-wrap lg:flex-nowrap">
      <!-- Refresh speed -->
      <div>
        <legend class="text-sm font-medium mb-2">Refresh speed</legend>

        <!-- Slider -->
        <input
          v-model.number="refreshValue"
          type="range"
          min="0"
          max="100"
          step="1"
          class="w-full cursor-pointer"
          aria-describedby="refreshHelp refreshCurrent"
          @input="handleRefreshChange"
        />

        <!-- Tick labels (visual hints only) -->
        <div class="mt-1 flex justify-between text-[11px] text-neutral-400">
          <span>No refresh</span>
          <span>1s</span>
          <span>500ms</span>
          <span>100ms</span>
          <span>50ms</span>
        </div>

        <!-- Live value -->
        <div id="refreshCurrent" class="mt-4 text-sm">
          Current: <span class="font-medium">{{ refreshLabel }}</span>
        </div>

        <p id="refreshHelp" class="mt-1 text-xs text-neutral-400">
          Left = paused. Otherwise 1,000 ms down to 10 ms.
        </p>
      </div>

      <!-- Market type switch -->
      <div>
        <legend class="text-sm font-medium mb-2">Dashboard</legend>

        <div class="inline-grid grid-cols-2 rounded-lg ring-1 ring-neutral-600 overflow-hidden">
          <input
            id="cryptos"
            v-model="selectedMarket"
            class="peer/cryptos sr-only"
            type="radio"
            name="market"
            value="cryptos"
            @change="handleMarketChange"
          />
          <label
            for="cryptos"
            class="px-4 py-2 text-sm text-center cursor-pointer bg-neutral-800 peer-checked/cryptos:bg-[#eef400] peer-checked/cryptos:text-neutral-900 peer-checked/cryptos:font-semibold transition-colors"
          >
            Cryptos
          </label>
          <input
            id="stocks"
            v-model="selectedMarket"
            class="peer/stocks sr-only"
            type="radio"
            name="market"
            value="stocks"
            @change="handleMarketChange"
          />
          <label
            for="stocks"
            class="px-4 py-2 text-sm text-center cursor-pointer bg-neutral-800 peer-checked/stocks:bg-[#eef400] peer-checked/stocks:text-neutral-900 peer-checked/stocks:font-semibold transition-colors"
          >
            Stocks
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Emit events to parent
const emit = defineEmits(['refreshChange', 'marketChange'])

// State
const refreshValue = ref(0)
const selectedMarket = ref('cryptos')

// v=0 => null (paused). v=1..100 maps linearly 1000ms -> 50ms
function valueToMs(v) {
  if (v === 0) return null
  // Linear map from 1000 to 50 over 99 steps
  return Math.round(1000 - (v - 1) * (950 / 99))
}

// Computed label
const refreshLabel = computed(() => {
  const ms = valueToMs(refreshValue.value)
  if (ms === null) {
    return 'No refresh'
  } else {
    return (ms >= 1000 ? '1,000' : ms) + ' ms'
  }
})

// Event handlers
const handleRefreshChange = () => {
  const ms = valueToMs(refreshValue.value)
  emit('refreshChange', {
    ms,
    paused: ms === null,
    sliderValue: refreshValue.value,
    market: selectedMarket.value
  })
}

const handleMarketChange = () => {
  emit('marketChange', {
    market: selectedMarket.value
  })
}

// Initialize with default values
handleRefreshChange()
</script>

<style scoped>
/* Custom slider styling */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  height: 6px;
}

/* Track styling */
input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: linear-gradient(to right, #404040 0%, #eef400 100%);
  border-radius: 3px;
}

input[type="range"]::-moz-range-track {
  width: 100%;
  height: 6px;
  background: linear-gradient(to right, #404040 0%, #eef400 100%);
  border-radius: 3px;
}

/* Thumb styling */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #eef400;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #1d1d1d;
  margin-top: -6px;
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #eef400;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #1d1d1d;
}

/* Hover effects */
input[type="range"]::-webkit-slider-thumb:hover {
  background: #fff44d;
  box-shadow: 0 0 8px rgba(238, 244, 0, 0.5);
}

input[type="range"]::-moz-range-thumb:hover {
  background: #fff44d;
  box-shadow: 0 0 8px rgba(238, 244, 0, 0.5);
}
</style>
