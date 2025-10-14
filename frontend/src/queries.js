
export function liveCrypto() {
    return `WITH toDate(now('UTC')) AS curr_day
    SELECT
        t.pair AS pair,
        argMaxMerge(t.last_price_state) AS last,
        argMinMerge(t.open_price_state) AS open,
        argMaxMerge(q.bid_state)        AS bid,
        argMaxMerge(q.ask_state)        AS ask,
        round(((last - open) / open) * 100, 2) AS change,
        sumMerge(t.volume_state)                AS volume,
        toUnixTimestamp64Milli(now64()) -
        greatest(maxMerge(t.latest_t_state), maxMerge(q.latest_t_state)) AS last_update
    FROM polygon.agg_crypto_trades_daily AS t
    LEFT JOIN polygon.agg_crypto_quotes_daily AS q
        USING (event_date, pair)
    WHERE event_date = curr_day
    AND endsWith(pair, 'USD')
    GROUP BY pair
    HAVING bid > 5
    ORDER BY pair ASC
  `
}

export function sqlPairSpread(pair, lb, ub, bucket_sec) {
    return `
WITH
    toIntervalSecond(${bucket_sec}) AS bucket_int
SELECT
    
    argMin(p, t) AS open,
    argMax(p, t) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(toStartOfInterval(toDateTime64(t / 1000.0, 3), bucket_int), 3) AS timestamp
FROM polygon.crypto_trades
WHERE pair = '${pair}'
  AND t >= ${lb}
  AND t <  ${ub}
GROUP BY timestamp
ORDER BY timestamp
FORMAT ARROW`;
}
