import { ref, watch } from 'vue'
import { useMarketData } from './useMarketData.js'
import {
  liveStock,
  stockLivePriceHistoricQuery,
  stockMinutePriceHistoricQuery,
  stockHourPriceHistoricQuery,
  stockDayPriceHistoricQuery,
  getAvailableTickers
} from '../queries/index.js'
import { executeQuery } from '../api/clickhouse.js'

const STORAGE_KEY = 'stockhouse_selected_tickers'

export function useStock() {
  // Default tickers
  const defaultTickers = ['AAPL','MSFT','NVDA','AMZN','GOOGL','GOOG','META','BRK.B','TSM','AVGO','V','MA','UNH','JNJ','XOM','JPMC','WMT','PG','DIS','KO','PFE','VZ','NFLX','ORCL','INTC','ABNB','CRM','ASML','BABA','COST','CVX']
  
  // Load selected tickers from localStorage or use defaults
  const loadSelectedTickers = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultTickers
      }
    } catch (err) {
      console.warn('Failed to load selected tickers from localStorage:', err)
    }
    return [...defaultTickers]
  }
  
  // Ticker selection state
  const selectedTickers = ref(loadSelectedTickers())
  const availableTickers = ref([])
  const loadingTickers = ref(false)
  
  // Save to localStorage whenever selectedTickers changes
  watch(selectedTickers, (newTickers) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTickers))
    } catch (err) {
      console.warn('Failed to save selected tickers to localStorage:', err)
    }
  }, { deep: true })
  
  const marketData = useMarketData({
    liveQuery: () => liveStock(selectedTickers.value),
    intervalQueries: {
      '5min': stockLivePriceHistoricQuery,
      '30min': stockMinutePriceHistoricQuery,
      '1hour': stockHourPriceHistoricQuery,
      '1day': stockDayPriceHistoricQuery
    },
    indexField: 'sym',
    identifierField: 'sym',
    mainConfigKey: 'stock-trades',
    spreadConfigKey: 'stock-price-spread'
  })
  
  async function fetchAvailableTickers() {
    try {
      loadingTickers.value = true
      const query = getAvailableTickers()
      const { data } = await executeQuery(query, 'json')
      
      const rows = data.data.map(row => ({
        sym: row[0],
        c: Number(row[1])
      }))
      
      availableTickers.value = rows
    } catch (err) {
      console.error('Failed to fetch available tickers:', err)
      availableTickers.value = []
    } finally {
      loadingTickers.value = false
    }
  }
  
  function toggleTicker(symbol) {
    const index = selectedTickers.value.indexOf(symbol)
    if (index > -1) {
      selectedTickers.value = selectedTickers.value.filter(s => s !== symbol)
    } else {
      selectedTickers.value = [...selectedTickers.value, symbol]
    }
  }
  
  function resetTickers() {
    selectedTickers.value = [...defaultTickers]
  }
  
  return {
    ...marketData,
    selectedTickers,
    availableTickers,
    loadingTickers,
    fetchAvailableTickers,
    toggleTicker,
    resetTickers
  }
}
