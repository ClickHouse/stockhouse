<template>
  <div class="flex w-full justify-start items-center gap-2 px-1">
    <div class="relative w-[250px]">
      <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        placeholder="Select tickers..."
        class="w-full px-4 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#eef400] focus:border-transparent"
        @input="onInput"
        @focus="showDropdown = true"
        @blur="onBlur"
      />

      <!-- Dropdown -->
      <Transition name="dropdown">
        <div
          v-show="showDropdown && filteredTickers.length > 0"
          class="absolute top-full z-50 w-full mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          <button
            v-for="ticker in filteredTickers"
            :key="ticker.sym"
            type="button"
            class="w-full px-4 py-2 text-left hover:bg-neutral-700 transition-colors flex items-center justify-between group"
            :class="isSelected(ticker.sym) ? 'bg-neutral-700' : ''"
            @mousedown.prevent="toggleTicker(ticker.sym)"
          >
            <div class="flex items-center gap-3">
              <span class="font-medium text-white">{{ ticker.sym }}</span>
            </div>
            <div
              v-if="isSelected(ticker.sym)"
              class="flex items-center gap-1 text-[#eef400] text-sm font-medium"
            >
              <i class="pi pi-check"></i>
              Selected
            </div>
          </button>
        </div>
      </Transition>
    </div>
    <button
      v-if="selectedTickers && selectedTickers.length > 0"
      type="button"
      class="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-neutral-400 hover:text-white hover:border-[#eef400] transition-colors cursor-pointer"
      title="Clear all selections"
      @click="emit('reset')"
    >
      <i class="pi pi-times"></i>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  availableTickers: {
    type: Array,
    default: () => []
  },
  selectedTickers: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-ticker', 'reset'])

const searchQuery = ref('')
const showDropdown = ref(false)
const inputRef = ref(null)

const filteredTickers = computed(() => {
  const query = searchQuery.value.trim().toUpperCase()
  
  if (!query) {
    // Show first 10 tickers when no search query
    return props.availableTickers.slice(0, 100)
  }
  
  // Filter by symbol containing the query
  const filtered = props.availableTickers.filter(ticker => 
    ticker.sym.toUpperCase().includes(query)
  )
  
  // Return max 100 results
  return filtered.slice(0, 100)
})

const isSelected = (symbol) => {
  return props.selectedTickers.includes(symbol)
}

const toggleTicker = (symbol) => {
  emit('toggle-ticker', symbol)
  // Keep the dropdown open after selection
  showDropdown.value = true
  // Refocus the input
  setTimeout(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  }, 0)
}

const onInput = () => {
  showDropdown.value = true
}

const onBlur = () => {
  // Delay hiding to allow click events to fire
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

const formatCount = (count) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Scrollbar styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #262626;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #525252;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #737373;
}
</style>
