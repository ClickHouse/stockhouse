
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

export function cryptoPairSpread(pair, lb, ub, bucket_sec) {
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
`;
}


export function liveStock() { 
    return `WITH
    ['AAPL','MSFT','NVDA','AMZN','GOOGL','GOOG','META','BRK.B','TSM','AVGO','V','MA','UNH','JNJ','XOM','JPMC','WMT','PG','DIS','KO','PFE','VZ','NFLX','ORCL','INTC','ABNB','CRM','ASML','BABA','COST','CVX'] as symbols,
    toDate(now('America/New_York')) AS curr_day,
    trades_info AS
    (
        SELECT
            sym,
            argMax(p, t) AS last_price,
            round(((last_price - argMinIf(p, t, fromUnixTimestamp64Milli(t, 'America/New_York') >= curr_day)) / argMinIf(p, t, fromUnixTimestamp64Milli(t, 'America/New_York') >= curr_day)) * 100, 2) AS change_pct,
            sum(s) AS total_volume,
            max(t) AS latest_t,
            toUnixTimestamp64Milli(now64()) - latest_t AS last_update
        FROM polygon.trades
        WHERE (toDate(fromUnixTimestamp64Milli(t, 'America/New_York')) = curr_day) AND (sym IN (symbols))
        GROUP BY sym
        ORDER BY sym ASC
    ),
    quotes_info AS
    (
        SELECT
            sym,
            argMax(bp, t) AS bid,
            argMax(ap, t) AS ask,
            max(t) AS latest_t
        FROM polygon.quotes
        WHERE (toDate(fromUnixTimestamp64Milli(t, 'America/New_York')) = curr_day) AND (sym IN (symbols))
        GROUP BY sym
        ORDER BY sym ASC
    )
SELECT
    t.sym AS sym,
    t.last_price AS last,
    q.bid AS bid,
    q.ask AS ask,
    t.change_pct AS change,
    t.total_volume AS volume,
    t.last_update AS last_update
FROM trades_info AS t
LEFT JOIN quotes_info AS q ON t.sym = q.sym`
}

// export function liveStock() {
//     return `WITH toDate(now('UTC')) AS curr_day
//     SELECT
//         t.sym AS sym,
//         argMaxMerge(t.last_price_state) AS last,
//         argMinMerge(t.open_price_state) AS open,
//         argMaxMerge(q.bid_state)        AS bid,
//         argMaxMerge(q.ask_state)        AS ask,
//         round(((last - open) / open) * 100, 2) AS change,
//         sumMerge(t.volume_state)                AS volume,
//         toUnixTimestamp64Milli(now64()) -
//         greatest(maxMerge(t.latest_t_state), maxMerge(q.latest_t_state)) AS last_update
//     FROM polygon.agg_stock_trades_daily AS t
//     LEFT JOIN polygon.agg_stock_quotes_daily AS q
//         USING (event_date, sym)
//     WHERE event_date = curr_day AND sym in ('AAPL','MSFT','NVDA','AMZN','GOOGL','GOOG','META','BRK.B','TSM','AVGO','V','MA','UNH','JNJ','XOM','JPMC','WMT','PG','DIS','KO','PFE','VZ','NFLX','ORCL','INTC','ABNB','CRM','ASML','BABA','COST','CVX')
//     GROUP BY sym
//     ORDER BY sym ASC
//   `
// }

export function stockCandlestick(sym, lb, ub, bucket_sec) {
    return `
WITH
    toIntervalSecond(${bucket_sec}) AS bucket_int
SELECT
    argMin(p, t) AS open,
    argMax(p, t) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(toStartOfInterval(toDateTime64(t / 1000.0, 3), bucket_int), 3) AS timestamp
FROM polygon.trades
WHERE sym = '${sym}'
  AND t >= ${lb}
  AND t <  ${ub}
GROUP BY timestamp
ORDER BY timestamp
`;
}
