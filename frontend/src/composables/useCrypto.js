import { useMarketData } from './useMarketData.js'
import {
  liveCrypto,
  cryptoLivePriceHistoricQuery,
  cryptoMinutePriceHistoricQuery,
  cryptoHourPriceHistoricQuery,
  cryptoDayPriceHistoricQuery
} from '../queries/index.js'

export function useCrypto() {
  return useMarketData({
    liveQuery: liveCrypto,
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
}
