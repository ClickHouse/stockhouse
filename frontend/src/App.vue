<template>
  <div class="flex flex-col h-full">
    <!-- Cookie Banner -->
    <CookieBanner @consent-change="handleConsentChange" @banner-closed="handleBannerClosed" />
    <!-- Header -->
    <header
      class="bg-neutral-800 shadow-lg border-b border-neutral-700 md:sticky md:top-0 z-20 opacity-[98%] backdrop-filter backdrop-blur-lg bg-opacity-90 h-[68px] flex-shrink-0">
      <nav class="mx-auto flex items-center justify-between md:px-4 lg:px-16 lg:w-full h-[68px]" aria-label="Global">
        <div class="items-center flex gap-8">
          <a href="/">
            <img class="w-38" src="/stockhouse.svg" alt="StockHouse" width="96" height="32" />
          </a>
        </div>
        <div class="flex items-center">
          <p class="text-sm text-neutral-0">Powered by</p>
          <div class="flex items-center">
            <a href="https://clickhouse.com" target="_blank" rel="noopener noreferrer">
              <img class="w-32 h-auto" src="/clickhouse-logo.svg" alt="ClickHouse" />
            </a>
            <span class="text-sm text-neutral-0">and</span>
            <a href="https://massive.com" target="_blank" rel="noopener noreferrer">
              <img class="w-32 h-auto" src="/massive-logo-white.svg" alt="Massive" />
            </a>
          </div>
          <div class="h-8 w-px bg-neutral-600 ml-4"></div>
          <a href="https://github.com/ClickHouse/stockhouse" target="_blank" rel="noopener noreferrer" class="hover:opacity-80 transition-opacity">
            <img class="w-6 h-6" src="/github.svg" alt="GitHub Repository" />
          </a>
        </div>
      </nav>
    </header>

    <!-- Control Panel and Statistics -->
    <div class="w-full md:px-4 lg:px-16 flex-shrink-0">
      <!-- Toggle Button and Collapsed Summary -->
      <div class="flex items-center justify-between">
        <button
          @click="isPanelOpen = !isPanelOpen"
          class="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors py-2 cursor-pointer"
          aria-label="Toggle control panel"
        >
          <i class="pi pi-angle-down" :class="{ 'pi-angle-up': !isPanelOpen }"></i>
          <span>{{ isPanelOpen ? 'Hide' : 'Show' }} Controls</span>
        </button>

        <!-- Collapsed Summary -->
        <Transition name="fade">
          <div v-show="!isPanelOpen" class="flex items-center gap-6 text-sm text-neutral-300">
            <div class="flex items-center gap-2">
              <span class="text-neutral-400">Refresh interval:</span>
              <span class="font-medium">{{ currentRefreshLabel }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-neutral-400">Avg response:</span>
              <span class="font-medium">{{ currentMarket === 'cryptos' ? crypto.avgResponseTime.value : stock.avgResponseTime.value }}</span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Collapsible Content -->
      <Transition
        name="panel"
        @enter="onEnter"
        @after-enter="onAfterEnter"
        @leave="onLeave"
      >
        <div
          v-show="isPanelOpen"
          class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full overflow-hidden"
        >
          <ControlPanel
            @refresh-change="handleRefreshChange"
            @market-change="handleMarketChange"
          />

          <Statistics
            :last-updated="currentMarket === 'cryptos' ? crypto.lastUpdated.value : stock.lastUpdated.value"
            :avg-response-time="currentMarket === 'cryptos' ? crypto.avgResponseTime.value : stock.avgResponseTime.value"
            :total-download="currentMarket === 'cryptos' ? crypto.totalDownload.value : stock.totalDownload.value"
            :ping-time="pingTime"
            server-region="us-central1"
          />
        </div>
      </Transition>
    </div>

    <!-- Crypto Main View -->
    <MarketView
      v-if="isBannerClosed"
      market-type="crypto"
      :visible="currentMarket === 'cryptos'"
      :show-spread="crypto.showCandlestick.value"
      :show-close-button="crypto.showCandlestick.value"
      :show-candlestick-interval="crypto.showCandlestick.value"
      :selected-interval="crypto.bucketInterval.value"
      :show-pair-selector="true"
      :available-pairs="crypto.availablePairs.value"
      :selected-pairs="crypto.selectedPairs.value"
      :loading-pairs="crypto.loadingPairs.value"
      @viewer-ready="handleCryptoViewerReady"
      @interval-change="crypto.changeInterval"
      @close-spread="crypto.closeSpread"
      @toggle-pair="handleTogglePair"
      @reset-pairs="handleResetPairs"
    />

    <!-- Stock Main View -->
    <MarketView
      v-if="isBannerClosed"
      market-type="stock"
      :visible="currentMarket === 'stocks'"
      :show-spread="stock.showCandlestick.value"
      :show-close-button="stock.showCandlestick.value"
      :show-candlestick-interval="stock.showCandlestick.value"
      :selected-interval="stock.bucketInterval.value"
      :available-tickers="stock.availableTickers.value"
      :selected-tickers="stock.selectedTickers.value"
      :loading-tickers="stock.loadingTickers.value"
      @viewer-ready="handleStockViewerReady"
      @interval-change="stock.changeInterval"
      @close-spread="stock.closeSpread"
      @toggle-ticker="handleToggleTicker"
      @reset-tickers="handleResetTickers"
    />

    <!-- Footer -->
    <footer class="w-full md:px-4 lg:px-16 py-4 mt-auto border-t border-neutral-700 bg-neutral-800">
      <Footer />
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import Statistics from './components/Statistics.vue'
import MarketView from './components/MarketView.vue'
import CookieBanner from './components/CookieBanner.vue'
import Footer from './components/Footer.vue'
import { useClickhouse } from './composables/useClickhouse.js'
import { useCrypto } from './composables/useCrypto.js'
import { useStock } from './composables/useStock.js'
import { useGoogleAnalytics } from './composables/useGoogleAnalytics.js'

// Composables
const { pingTime, startPing } = useClickhouse()
const crypto = useCrypto()
const stock = useStock()
const { setConsent } = useGoogleAnalytics('G-KF1LLRTQ5Q')

// State
const currentMarket = ref('cryptos')
const currentRefreshMs = ref(null)
const cryptoViewersReady = ref(false)
const stockViewersReady = ref(false)
const stockViewers = ref(null)
const isBannerClosed = ref(false)
const isPanelOpen = ref(true)
const currentRefreshLabel = ref('No refresh')

// Handle events from ControlPanel
const handleRefreshChange = (detail) => {
  currentRefreshMs.value = detail.ms
  
  // Update the refresh label for collapsed view
  if (detail.ms === null) {
    currentRefreshLabel.value = 'No refresh'
  } else {
    currentRefreshLabel.value = (detail.ms >= 1000 ? '1,000' : detail.ms) + ' ms'
  }

  if (detail.paused) {
    if (currentMarket.value === 'cryptos') {
      crypto.stopRefresh()
    } else {
      stock.stopRefresh()
    }
  } else {
    if (currentMarket.value === 'cryptos') {
      crypto.startRefresh(detail.ms)
    } else {
      stock.startRefresh(detail.ms)
    }
  }
}

const handleMarketChange = async (detail) => {
  currentMarket.value = detail.market

  // Stop refresh for both markets
  crypto.stopRefresh()
  stock.stopRefresh()

  // Initialize and start refresh for the active market
  if (detail.market === 'cryptos' && cryptoViewersReady.value) {
    if (currentRefreshMs.value) {
      crypto.startRefresh(currentRefreshMs.value)
    }
  } else if (detail.market === 'stocks' && stockViewersReady.value) {
    // Initialize stock if not already initialized
    if (stock.lastUpdated.value === '-' && stockViewers.value) {
      await stock.init(stockViewers.value)
    }
    if (currentRefreshMs.value) {
      stock.startRefresh(currentRefreshMs.value)
    }
  }
}

const handleCryptoViewerReady = async (viewers) => {
  cryptoViewersReady.value = true
  // Fetch available pairs when crypto view is ready
  await crypto.fetchAvailablePairs()
  await crypto.init(viewers)
}

const handleTogglePair = async (pair) => {
  crypto.togglePair(pair)
  // Reinitialize the table with new pair selection
  if (cryptoViewersReady.value) {
    const viewers = {
      tableViewer: document.querySelector('#crypto-table-container perspective-viewer'),
      spreadViewer: document.querySelector('#crypto-spread-container perspective-viewer')
    }
    await crypto.init(viewers)
    // Restart refresh if it was running
    if (currentRefreshMs.value && currentMarket.value === 'cryptos') {
      crypto.stopRefresh()
      crypto.startRefresh(currentRefreshMs.value)
    }
  }
}

const handleStockViewerReady = async (viewers) => {
  stockViewersReady.value = true
  stockViewers.value = viewers
  // Fetch available tickers when stock view is ready
  await stock.fetchAvailableTickers()
  // Don't init yet - we'll init when user switches to stocks
}

const handleToggleTicker = async (symbol) => {
  stock.toggleTicker(symbol)
  // Reinitialize the table with new ticker selection
  if (stockViewersReady.value && stockViewers.value) {
    await stock.init(stockViewers.value)
    // Restart refresh if it was running
    if (currentRefreshMs.value && currentMarket.value === 'stocks') {
      stock.stopRefresh()
      stock.startRefresh(currentRefreshMs.value)
    }
  }
}

const handleResetTickers = async () => {
  stock.resetTickers()
  // Reinitialize the table with reset ticker selection
  if (stockViewersReady.value && stockViewers.value) {
    await stock.init(stockViewers.value)
    // Restart refresh if it was running
    if (currentRefreshMs.value && currentMarket.value === 'stocks') {
      stock.stopRefresh()
      stock.startRefresh(currentRefreshMs.value)
    }
  }
}

const handleResetPairs = async () => {
  crypto.resetPairs()
  // Reinitialize the table with reset pair selection
  if (cryptoViewersReady.value) {
    const viewers = {
      tableViewer: document.querySelector('#crypto-table-container perspective-viewer'),
      spreadViewer: document.querySelector('#crypto-spread-container perspective-viewer')
    }
    await crypto.init(viewers)
    // Restart refresh if it was running
    if (currentRefreshMs.value && currentMarket.value === 'cryptos') {
      crypto.stopRefresh()
      crypto.startRefresh(currentRefreshMs.value)
    }
  }
}

const handleConsentChange = (consent) => {
  setConsent(consent)
}

const handleBannerClosed = () => {
  isBannerClosed.value = true
}

// Transition handlers for smooth collapse/expand
const onEnter = (el) => {
  el.style.height = '0'
  el.style.opacity = '0'
}

const onAfterEnter = (el) => {
  el.style.height = 'auto'
  el.style.opacity = '1'
}

const onLeave = (el) => {
  el.style.height = el.scrollHeight + 'px'
  el.offsetHeight // trigger reflow
  el.style.height = '0'
  el.style.opacity = '0'
}

onMounted(async () => {
  // Start ping monitoring
  startPing()
})
</script>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.2s ease;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
