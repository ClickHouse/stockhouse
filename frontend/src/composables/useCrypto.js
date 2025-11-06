import { ref, watch } from 'vue'
import { useMarketData } from './useMarketData.js'
import {
  liveCrypto,
  cryptoLivePriceHistoricQuery,
  cryptoMinutePriceHistoricQuery,
  cryptoHourPriceHistoricQuery,
  cryptoDayPriceHistoricQuery,
  getAvailableCryptoPairs
} from '../queries/index.js'
import { executeQuery } from '../api/clickhouse.js'

const STORAGE_KEY = 'stockhouse_selected_crypto_pairs'

export function useCrypto() {
  const defaultPairs = ['BTC-USD','ETH-USD','XRP-USD','ZEC-USD','ALEO-USD','SOL-USD','DASH-USD','SUI-USD','ICP-USD','NEAR-USD','TAO-USD','DOGE-USD','HBAR-USD','LINK-USD','ZK-USD','LTC-USD','XLM-USD','ADA-USD','ZEN-USD','ALCX-USD','APT-USD','USDT-USD','SEI-USD','SYRUP-USD','ONDO-USD','AERO-USD','DOT-USD','USDC-USD','XTZ-USD','MINA-USD']
  
  const loadSelectedPairs = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return Array.isArray(parsed) ? parsed : null
      }
    } catch (err) {
      console.warn('Failed to load selected crypto pairs from localStorage:', err)
    }
    return null
  }
  
  const selectedPairs = ref(loadSelectedPairs())
  const availablePairs = ref([])
  const loadingPairs = ref(false)
  
  // Save to localStorage whenever selectedPairs changes
  watch(selectedPairs, (newPairs) => {
    try {
      if (newPairs && newPairs.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPairs))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (err) {
      console.warn('Failed to save selected crypto pairs to localStorage:', err)
    }
  }, { deep: true })
  
  const marketData = useMarketData({
    liveQuery: () => liveCrypto(selectedPairs.value),
    intervalQueries: {
      '5min': cryptoLivePriceHistoricQuery,
      '30min': cryptoMinutePriceHistoricQuery,
      '1hour': cryptoHourPriceHistoricQuery,
      '1day': cryptoDayPriceHistoricQuery
    },
    indexField: 'pair',
    identifierField: 'pair',
    mainConfigKey: 'crypto-trades',
    spreadConfigKey: 'pair-price-spread'
  })
  
  // Fetch available pairs from database
  async function fetchAvailablePairs() {
    try {
      loadingPairs.value = true
      const query = getAvailableCryptoPairs()
      const { data } = await executeQuery(query, 'json')
      
      const rows = data.data.map(row => ({
        pair: row[0],
        c: Number(row[1])
      }))
      
      availablePairs.value = rows
    } catch (err) {
      console.error('Failed to fetch available crypto pairs:', err)
      availablePairs.value = []
    } finally {
      loadingPairs.value = false
    }
  }
  
  function togglePair(pair) {
    if (!selectedPairs.value) {
      selectedPairs.value = [pair]
    } else {
      const index = selectedPairs.value.indexOf(pair)
      if (index > -1) {
        const newPairs = selectedPairs.value.filter(p => p !== pair)
        selectedPairs.value = newPairs.length > 0 ? newPairs : null
      } else {
        selectedPairs.value = [...selectedPairs.value, pair]
      }
    }
  }
  
  function resetPairs() {
    selectedPairs.value = [...defaultPairs]
  }
  
  return {
    ...marketData,
    selectedPairs,
    availablePairs,
    loadingPairs,
    fetchAvailablePairs,
    togglePair,
    resetPairs
  }
}
