<template>
  <div id="app">
    <!-- Header -->
    <div id="header"
      class="bg-neutral-800 shadow-lg border-b-2 border-neutral-725 md:sticky md:top-0 z-20 opacity-[98%] backdrop-filter backdrop-blur-lg bg-opacity-90 h-[82px]">
      <nav class="mx-auto flex items-center justify-between md:px-4 lg:px-16 lg:w-full h-[82px]" aria-label="Global">
        <div class="items-center flex gap-8">
          <a href="/">
            <img class="w-38" src="/stockhouse.svg" alt="StockHouse" width="96" height="32" />
          </a>
        </div>
        <div class="flex items-center">
          <div class="flex width-20">
            <div class="grow width-20 ">
              <p class="text-md text-neutral-0 flex items-center gap-1">
                Powered by <img class="w-32 inline" src="/clickhouse-logo.svg" alt="ClickHouse" /> and <img
                  class="w-32 inline" src="/polygon-logo.svg" alt="Polygon.io" />
              </p>
            </div>
          </div>
        </div>
      </nav>
    </div>

    <!-- Control Panel and Statistics -->
    <div class="flex justify-between w-full md:px-4 lg:px-16">
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

    <!-- Crypto Main View -->
    <MarketView
      market-type="crypto"
      :visible="currentMarket === 'cryptos'"
      :show-spread="crypto.showCandlestick.value"
      :show-close-button="crypto.showCandlestick.value"
      :show-candlestick-interval="crypto.showCandlestick.value"
      :selected-interval="crypto.bucketInterval.value"
      @viewer-ready="handleCryptoViewerReady"
      @interval-change="crypto.changeInterval"
      @close-spread="crypto.closeSpread"
    />

    <!-- Stock Main View -->
    <MarketView
      market-type="stock"
      :visible="currentMarket === 'stocks'"
      :show-spread="stock.showCandlestick.value"
      :show-close-button="stock.showCandlestick.value"
      :show-candlestick-interval="stock.showCandlestick.value"
      :selected-interval="stock.bucketInterval.value"
      @viewer-ready="handleStockViewerReady"
      @interval-change="stock.changeInterval"
      @close-spread="stock.closeSpread"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import Statistics from './components/Statistics.vue'
import MarketView from './components/MarketView.vue'
import { useClickhouse } from './composables/useClickhouse.js'
import { useCrypto } from './composables/useCrypto.js'
import { useStock } from './composables/useStock.js'

// Composables
const { pingTime, startPing } = useClickhouse()
const crypto = useCrypto()
const stock = useStock()

// State
const currentMarket = ref('cryptos')
const currentRefreshMs = ref(null)
const cryptoViewersReady = ref(false)
const stockViewersReady = ref(false)
const stockViewers = ref(null)

// Handle events from ControlPanel
const handleRefreshChange = (detail) => {
  currentRefreshMs.value = detail.ms

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
  await crypto.init(viewers)
}

const handleStockViewerReady = async (viewers) => {
  stockViewersReady.value = true
  stockViewers.value = viewers
  // Don't init yet - we'll init when user switches to stocks
}

onMounted(async () => {
  // Start ping monitoring
  startPing()
})
</script>
