import { useMarketData } from './useMarketData.js'
import {
  liveStock,
  stockLivePriceHistoricQuery,
  stockMinutePriceHistoricQuery,
  stockHourPriceHistoricQuery,
  stockDayPriceHistoricQuery
} from '../queries/index.js'

export function useStock() {
  return useMarketData({
    liveQuery: liveStock,
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
}
