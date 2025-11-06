import { ref, onUnmounted } from 'vue'
import perspective from 'https://cdn.jsdelivr.net/npm/@finos/perspective@3.0.0/dist/cdn/perspective.js'
import { executeQuery } from '../api/clickhouse.js'
import { prettyPrintSize, getConfig } from '../utils/index.js'

const MAX_TIMES_IN_AVG = 10

/**
 * Generic composable for managing market data (crypto or stock)
 * @param {Object} config - Configuration object
 * @param {Function} config.liveQuery - Function that returns the live data query
 * @param {Object} config.intervalQueries - Map of interval to query function
 * @param {string} config.indexField - Field to use as index ('pair' or 'sym')
 * @param {string} config.identifierField - Field name for the selected item
 * @param {string} config.mainConfigKey - Config key for main table
 * @param {string} config.spreadConfigKey - Config key for spread/candlestick
 */
export function useMarketData(config) {
  const {
    liveQuery,
    intervalQueries,
    indexField,
    identifierField,
    mainConfigKey,
    spreadConfigKey
  } = config

  // State
  const mainTable = ref(null)
  const candlestickTable = ref(null)
  const selectedIdentifier = ref(null)
  const responseTimes = ref([])
  const totalSize = ref(0)
  const refreshInterval = ref(null)
  const showCandlestick = ref(false)
  const bucketInterval = ref('5min')

  // Statistics
  const lastUpdated = ref('-')
  const avgResponseTime = ref('-')
  const totalDownload = ref('-')
  const error = ref(null)

  // Viewers
  const tableViewer = ref(null)
  const spreadViewer = ref(null)

  // Cached resources
  let cachedConfig = null
  let cachedWorker = null
  let clickListener = null

  // Get or create perspective worker
  async function getWorker() {
    if (!cachedWorker) {
      try {
        cachedWorker = await perspective.worker()
      } catch (err) {
        console.error('Failed to create perspective worker:', err)
        error.value = 'Failed to initialize data visualization'
        throw err
      }
    }
    return cachedWorker
  }

  // Load and cache config
  async function loadConfig() {
    if (!cachedConfig) {
      try {
        cachedConfig = await getConfig()
      } catch (e) {
        console.warn('Failed to load config.json', e)
        cachedConfig = {}
      }
    }
    return cachedConfig
  }

  // Update main table with live data
  async function updateMainTable() {
    try {
      const upperBound = Date.now()
      const start = Date.now()
      const query = liveQuery()
      const { rows, has_rows } = await executeQuery(query)

      if (has_rows && mainTable.value) {
        mainTable.value.update(rows)
      }

      // Update statistics
      const execTime = Date.now() - start
      responseTimes.value.push(execTime)
      if (responseTimes.value.length > MAX_TIMES_IN_AVG) {
        responseTimes.value.shift()
      }

      const avgMs = (
        responseTimes.value.reduce((a, b) => a + b, 0) / responseTimes.value.length
      ).toFixed(2)

      avgResponseTime.value = `${avgMs} ms`
      lastUpdated.value = new Date(upperBound).toISOString()
      totalSize.value += rows.byteLength
      totalDownload.value = prettyPrintSize(totalSize.value)
      error.value = null
    } catch (err) {
      console.error('Failed to update main table:', err)
      error.value = 'Failed to update market data'
    }
  }

  // Initialize the market data view
  async function init(viewers) {
    try {
      tableViewer.value = viewers.tableViewer
      spreadViewer.value = viewers.spreadViewer

      const configs = await loadConfig()
      const worker = await getWorker()
      const query = liveQuery()
      const { rows } = await executeQuery(query)

      if (!tableViewer.value) {
        throw new Error('Table viewer not available')
      }

      // Remove old listener if exists
      if (clickListener && tableViewer.value) {
        tableViewer.value.removeEventListener('perspective-click', clickListener)
      }

      // Create and attach click listener
      clickListener = (e) => {
        showCandlestick.value = true
        selectedIdentifier.value = e.detail.row[identifierField]
        displayCandlestick(e.detail.row[identifierField])
      }
      tableViewer.value.addEventListener('perspective-click', clickListener)

      mainTable.value = await worker.table(rows, { index: indexField })
      await tableViewer.value.load(mainTable.value)
      tableViewer.value.restore({ theme: 'Monokai', ...(configs?.[mainConfigKey] || {}) })

      await updateMainTable()
      error.value = null
    } catch (err) {
      console.error('Failed to initialize market data:', err)
      error.value = 'Failed to initialize market view'
      throw err
    }
  }

  // Display candlestick chart for selected item
  async function displayCandlestick(identifier) {
    try {
      const configs = await loadConfig()
      const query = intervalQueries['5min'](identifier)
      const { rows } = await executeQuery(query)

      if (!spreadViewer.value) {
        throw new Error('Spread viewer not available')
      }

      const worker = await getWorker()
      candlestickTable.value = await worker.table(rows, { index: 'timestamp' })
      await spreadViewer.value.load(candlestickTable.value)
      spreadViewer.value.restore({
        theme: 'Monokai',
        ...(configs?.[spreadConfigKey] || {})
      })

      await updateCandlestick()
      error.value = null
    } catch (err) {
      console.error('Failed to display candlestick:', err)
      error.value = 'Failed to load chart data'
    }
  }

  // Get query based on selected interval
  function getQuery(interval) {
    const queryFn = intervalQueries[interval]
    if (!queryFn) {
      console.warn(`No query function found for interval: ${interval}`)
      return null
    }
    return queryFn(selectedIdentifier.value)
  }

  // Update candlestick data
  async function updateCandlestick(replace = false) {
    try {
      const query = getQuery(bucketInterval.value)
      if (!query) return

      const { rows, has_rows } = await executeQuery(query)

      if (has_rows && candlestickTable.value) {
        if (replace) {
          candlestickTable.value.replace(rows)
        } else {
          candlestickTable.value.update(rows)
        }
      }
      error.value = null
    } catch (err) {
      console.error('Failed to update candlestick:', err)
      error.value = 'Failed to update chart'
    }
  }

  // Start automatic refresh
  function startRefresh(ms) {
    try {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
      }
      refreshInterval.value = setInterval(() => {
        updateMainTable()
        if (showCandlestick.value) {
          updateCandlestick()
        }
      }, ms)
    } catch (err) {
      console.error('Failed to start refresh:', err)
      error.value = 'Failed to start automatic updates'
    }
  }

  // Stop automatic refresh
  function stopRefresh() {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
    }
  }

  // Close the spread/candlestick view
  function closeSpread() {
    showCandlestick.value = false
  }

  // Change the candlestick interval
  function changeInterval(interval) {
    bucketInterval.value = interval
    updateCandlestick(true)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (clickListener && tableViewer.value) {
      tableViewer.value.removeEventListener('perspective-click', clickListener)
    }
    stopRefresh()
  })

  return {
    init,
    startRefresh,
    stopRefresh,
    closeSpread,
    changeInterval,
    showCandlestick,
    bucketInterval,
    lastUpdated,
    avgResponseTime,
    totalDownload,
    error
  }
}
