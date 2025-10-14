
export function liveCrypto() {
  return `with 
    toDate(now('UTC')) as curr_day,
    trades_info as (
        select
            pair as sym,
            argMax(p, t) as last_price,
            round(((last_price - (argMinIf(p, t, fromUnixTimestamp64Milli(t, 'UTC') >= curr_day))) / (argMinIf(p, t, fromUnixTimestamp64Milli(t, 'UTC') >= curr_day))) * 100, 2) as change_pct,
            sum(s) as total_volume,
            max(t) as latest_t
        from
            polygon.crypto_trades
        where
            toDate(fromUnixTimestamp64Milli(t, 'UTC')) = curr_day
           
        group by
            pair
        order by
            pair asc
    ),
    quotes_info as (
        select
            pair as sym,
            argMax(bp, t) as bid,
            argMax(ap, t) as ask,
            max(t) as latest_t
        from
            polygon.crypto_quotes
        where
            toDate(fromUnixTimestamp64Milli(t, 'UTC')) = curr_day
           
        group by
            pair
        order by
            pair asc
    )
    select
        t.sym as pair,
        t.last_price as last,
        q.bid as bid,
        q.ask as ask,
        t.change_pct as change,
        t.total_volume as volume,
        toUnixTimestamp64Milli(now64()) - greatest(t.latest_t, q.latest_t) as last_update
    from
        trades_info as t
        left join quotes_info as q on t.sym = q.sym
    WHERE q.bid > 5 AND endsWith(pair, 'USD')
    FORMAT Arrow
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
