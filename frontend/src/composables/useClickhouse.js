import { ref, onUnmounted } from 'vue'
import { executeQuery } from '../api/clickhouse.js'

const MAX_TIMES_IN_AVG = 10

export function useClickhouse() {
  const pingTimes = ref([])
  const pingTime = ref('-')
  const pingInterval = ref(null)
  const error = ref(null)

  async function pingClickHouse() {
    try {
      const start = Date.now()
      await executeQuery('SELECT 1')
      const time = Date.now() - start

      pingTimes.value.push(time)
      if (pingTimes.value.length > MAX_TIMES_IN_AVG) {
        pingTimes.value.shift()
      }

      const avgPing = (
        pingTimes.value.reduce((a, b) => a + b, 0) / pingTimes.value.length
      ).toFixed(2)

      pingTime.value = `${avgPing} ms (avg of ${pingTimes.value.length})`
      error.value = null
    } catch (err) {
      console.error('Ping error:', err)
      pingTime.value = 'Error'
      error.value = 'Failed to ping ClickHouse server'
    }
  }

  function startPing() {
    try {
      pingClickHouse() // Initial ping
      if (pingInterval.value) {
        clearInterval(pingInterval.value)
      }
      pingInterval.value = setInterval(pingClickHouse, 5000)
    } catch (err) {
      console.error('Failed to start ping monitoring:', err)
      error.value = 'Failed to start ping monitoring'
    }
  }

  function stopPing() {
    if (pingInterval.value) {
      clearInterval(pingInterval.value)
      pingInterval.value = null
    }
  }

  onUnmounted(() => {
    stopPing()
  })

  return {
    pingTime,
    error,
    startPing,
    stopPing,
    pingClickHouse
  }
}
