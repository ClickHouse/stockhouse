
export function liveCrypto(pairs = ['BTC-USD','ETH-USD','XRP-USD','ZEC-USD','ALEO-USD','SOL-USD','DASH-USD','SUI-USD','ICP-USD','NEAR-USD','TAO-USD','DOGE-USD','HBAR-USD','LINK-USD','ZK-USD','LTC-USD','XLM-USD','ADA-USD','ZEN-USD','ALCX-USD','APT-USD','USDT-USD','SEI-USD','SYRUP-USD','ONDO-USD','AERO-USD','DOT-USD','USDC-USD','XTZ-USD','MINA-USD']) {

    const pairArray = pairs.length > 0 ? pairs : ['BTC-USD']; // Fallback to at least one symbol
    const pairsStr = pairArray.map(s => `'${s}'`).join(',');
    
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
    FROM stockhouse.agg_crypto_trades_daily AS t
    LEFT JOIN stockhouse.agg_crypto_quotes_daily AS q
        USING (event_date, pair)
    WHERE event_date = curr_day
    AND pair in (${pairsStr})
    GROUP BY pair
    ORDER BY pair ASC
  `
}


export function cryptoLivePriceHistoricQuery(pair) {
    return `
    WITH
    toDateTime64(t / 1000., 3)                                 AS ts,
    toStartOfInterval(ts, INTERVAL 15 SECOND)                  AS bucket_end
    SELECT
    argMin(p, ts) AS open,
    argMax(p, ts) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(bucket_end, 3) AS timestamp
    FROM stockhouse.crypto_trades
    WHERE
    pair = '${pair}'
    AND ts >= now64(3) - INTERVAL 10 MINUTE
    AND ts  < now64(3)
    GROUP BY bucket_end
    ORDER BY bucket_end ASC
`;
}


export function cryptoMinutePriceHistoricQuery(pair) {


    return `
        WITH
    toDateTime64(t / 1000., 3)                                 AS ts,
    toStartOfInterval(ts, INTERVAL 1 MINUTE)                  AS bucket_end
    SELECT
    argMin(p, ts) AS open,
    argMax(p, ts) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(bucket_end, 3) AS timestamp
    FROM stockhouse.crypto_trades
    WHERE
    pair = '${pair}'
    AND ts >= now64(3) - INTERVAL 30 MINUTE
    AND ts  < now64(3)
    GROUP BY bucket_end
    ORDER BY bucket_end ASC

`;
}


export function cryptoHourPriceHistoricQuery(pair) {
    return `
        WITH
    toDateTime64(t / 1000., 3)                                 AS ts,
    toStartOfInterval(ts, INTERVAL 2 MINUTE)                  AS bucket_end
    SELECT
    argMin(p, ts) AS open,
    argMax(p, ts) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(bucket_end, 3) AS timestamp
    FROM stockhouse.crypto_trades
    WHERE
    pair = '${pair}'
    AND ts >= now64(3) - INTERVAL 1 HOUR
    AND ts  < now64(3)
    GROUP BY bucket_end
    ORDER BY bucket_end ASC
`;
}

export function cryptoDayPriceHistoricQuery(pair) {
    return `
        WITH
    toDateTime64(t / 1000., 3)                                 AS ts,
    toStartOfInterval(ts, INTERVAL 30 MINUTE)                  AS bucket_end
    SELECT
    argMin(p, ts) AS open,
    argMax(p, ts) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(bucket_end, 3) AS timestamp
    FROM stockhouse.crypto_trades
    WHERE
    pair = '${pair}'
    AND ts >= now64(3) - INTERVAL 1 day
    AND ts  < now64(3)
    GROUP BY bucket_end
    ORDER BY bucket_end ASC
`;
}

export function cryptoPairSpread(pair, lb, bucket_sec) {
    return `
    WITH
        toIntervalSecond(${bucket_sec}) AS bucket_int
    SELECT
        argMin(p, t) AS open,
        argMax(p, t) AS close,
        max(p)       AS high,
        min(p)       AS low,
        toDateTime64(toStartOfInterval(toDateTime64(t / 1000.0, 3), bucket_int), 3) AS timestamp
    FROM stockhouse.crypto_trades
    WHERE pair = '${pair}'
    AND t >= ${lb}
    AND t <  ${ub}
    GROUP BY timestamp
    ORDER BY timestamp
`;
}

export function liveStock(symbols = ['AAPL','MSFT','NVDA','AMZN','GOOGL','GOOG','META','BRK.B','TSM','AVGO','V','MA','UNH','JNJ','XOM','JPMC','WMT','PG','DIS','KO','PFE','VZ','NFLX','ORCL','INTC','ABNB','CRM','ASML','BABA','COST','CVX']) {
    const symbolsArray = symbols.length > 0 ? symbols : ['AAPL']; // Fallback to at least one symbol
    const symbolsStr = symbolsArray.map(s => `'${s}'`).join(',');
    
    return `WITH
    [${symbolsStr}] as symbols,
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
        FROM stockhouse.trades
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
        FROM stockhouse.quotes
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
FROM stockhouse.trades
WHERE sym = '${sym}'
  AND t >= ${lb}
  AND t <  ${ub}
GROUP BY timestamp
ORDER BY timestamp
`;
}



export function stockLivePriceHistoricQuery(sym) {
    return `
    WITH
    toDateTime64(t / 1000., 3)                                 AS ts,
    toStartOfInterval(ts, INTERVAL 15 SECOND)                  AS bucket_end, 
    toDateTime64( (SELECT max(t) FROM stockhouse.quotes WHERE sym = '${sym}') / 1000., 3 ) AS max_ts
    SELECT
    argMin(p, ts) AS open,
    argMax(p, ts) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(bucket_end, 3) AS timestamp
    FROM stockhouse.trades
    WHERE
    sym = '${sym}'
    AND ts >= max_ts - INTERVAL 10 MINUTE
    AND ts  <= max_ts
    GROUP BY bucket_end
    ORDER BY bucket_end ASC
`;
}


export function stockMinutePriceHistoricQuery(sym) {


    return `
        WITH
    toDateTime64(t / 1000., 3)                                 AS ts,
    toStartOfInterval(ts, INTERVAL 1 MINUTE)                  AS bucket_end,
    toDateTime64( (SELECT max(t) FROM stockhouse.quotes WHERE sym = '${sym}') / 1000., 3 ) AS max_ts
    SELECT
    argMin(p, ts) AS open,
    argMax(p, ts) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(bucket_end, 3) AS timestamp
    FROM stockhouse.trades
    WHERE
    sym = '${sym}'
    AND ts >= max_ts - INTERVAL 30 MINUTE
    AND ts  <= max_ts
    GROUP BY bucket_end
    ORDER BY bucket_end ASC

`;
}


export function stockHourPriceHistoricQuery(sym) {
    return `
        WITH
    toDateTime64(t / 1000., 3)                                 AS ts,
    toStartOfInterval(ts, INTERVAL 2 MINUTE)                  AS bucket_end,
    toDateTime64( (SELECT max(t) FROM stockhouse.quotes WHERE sym = '${sym}') / 1000., 3 ) AS max_ts
    SELECT
    argMin(p, ts) AS open,
    argMax(p, ts) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(bucket_end, 3) AS timestamp
    FROM stockhouse.trades
    WHERE
    sym = '${sym}'
    AND ts >= max_ts - INTERVAL 1 HOUR
    AND ts  <= max_ts
    GROUP BY bucket_end
    ORDER BY bucket_end ASC
`;
}

export function stockDayPriceHistoricQuery(sym) {
    return `
        WITH
    toDateTime64(t / 1000., 3)                                 AS ts,
    toStartOfInterval(ts, INTERVAL 10 MINUTE)                  AS bucket_end,
    toDateTime64( (SELECT max(t) FROM stockhouse.quotes WHERE sym = '${sym}') / 1000., 3 ) AS max_ts
    SELECT
    argMin(p, ts) AS open,
    argMax(p, ts) AS close,
    max(p)       AS high,
    min(p)       AS low,
    toDateTime64(bucket_end, 3) AS timestamp
    FROM stockhouse.trades
    WHERE
    sym = '${sym}'
    AND ts >= max_ts - INTERVAL 1 day
    AND ts  <= max_ts
    GROUP BY bucket_end
    ORDER BY bucket_end ASC
`;
}

export function getAvailableTickers() {
    return `
    SELECT sym, count() as c
    FROM stockhouse.trades
    WHERE toDate(fromUnixTimestamp64Milli(t, 'America/New_York')) = toDate(now('America/New_York'))
    GROUP BY sym 
    ORDER BY c DESC
`;
}

export function getAvailableCryptoPairs() {
    return `
    SELECT pair, count() as c
    FROM stockhouse.crypto_trades
    WHERE toDate(fromUnixTimestamp64Milli(t, 'America/New_York')) = toDate(now('America/New_York'))
    AND endsWith(pair, 'USD')
    GROUP BY pair 
    ORDER BY c DESC
`;
}
