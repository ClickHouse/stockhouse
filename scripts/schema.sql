CREATE TABLE quotes
(
    `sym` LowCardinality(String),
    `bx` UInt8,
    `bp` Float64,
    `bs` UInt64,
    `ax` UInt8,
    `ap` Float64,
    `as` UInt64,
    `c` UInt8,
    `i` Array(UInt8),
    `t` UInt64,
    `q` UInt64,
    `z` Enum8('NYSE' = 1, 'AMEX' = 2, 'Nasdaq' = 3),
    `inserted_at` UInt64 DEFAULT toUnixTimestamp64Milli(now64())
)
ORDER BY (sym, t - (t % 60000));

CREATE TABLE trades
(
    `sym` LowCardinality(String),
    `i` String,
    `x` UInt8,
    `p` Float64,
    `s` UInt64,
    `c` Array(UInt8),
    `t` UInt64,
    `q` UInt64,
    `z` Enum8('NYSE' = 1, 'AMEX' = 2, 'Nasdaq' = 3),
    `trfi` UInt64,
    `trft` UInt64,
    `inserted_at` UInt64 DEFAULT toUnixTimestamp64Milli(now64())
)
ORDER BY (sym, t - (t % 60000));

CREATE TABLE crypto_quotes
(
    `pair` String,
    `bp` Float64,
    `bs` Float64,
    `ap` Float64,
    `as` Float64,
    `t` UInt64,
    `x` UInt8,
    `r` UInt64,
    `inserted_at` UInt64 DEFAULT toUnixTimestamp64Milli(now64())
)
ORDER BY (pair, t - (t % 60000));

CREATE TABLE crypto_trades
(
    `pair` String,
    `p` Float64,
    `t` UInt64,
    `s` Float64,
    `c` Array(UInt8),
    `i` String,
    `x` UInt8,
    `r` UInt64,
    `inserted_at` UInt64 DEFAULT toUnixTimestamp64Milli(now64())
)
ORDER BY (pair, t - (t % 60000), i);

CREATE TABLE  stock_fmv
(
    `sym` String,
    `fmv` Float64,
    `t` UInt64,
    `inserted_at` UInt64 DEFAULT toUnixTimestamp64Milli(now64())
)
ORDER BY (sym, t - (t % 60000));


CREATE TABLE agg_crypto_quotes_daily
(
    `event_date` Date,
    `pair` LowCardinality(String),
    `bid_state` AggregateFunction(argMax, Float64, UInt64),
    `ask_state` AggregateFunction(argMax, Float64, UInt64),
    `latest_t_state` AggregateFunction(max, UInt64)
)
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, pair);

CREATE TABLE agg_crypto_trades_daily
(
    `event_date` Date,
    `pair` LowCardinality(String),
    `open_price_state` AggregateFunction(argMin, Float64, UInt64),
    `last_price_state` AggregateFunction(argMax, Float64, UInt64),
    `volume_state` AggregateFunction(sum, Float64),
    `latest_t_state` AggregateFunction(max, UInt64)
)
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, pair);

CREATE MATERIALIZED VIEW mv_crypto_trades_daily TO agg_crypto_trades_daily
(
    `event_date` Date,
    `pair` String,
    `open_price_state` AggregateFunction(argMin, Float64, UInt64),
    `last_price_state` AggregateFunction(argMax, Float64, UInt64),
    `volume_state` AggregateFunction(sum, Float64),
    `latest_t_state` AggregateFunction(max, UInt64)
)
AS SELECT
    toDate(fromUnixTimestamp64Milli(t, 'UTC')) AS event_date,
    pair,
    argMinState(p, t) AS open_price_state,
    argMaxState(p, t) AS last_price_state,
    sumState(s) AS volume_state,
    maxState(t) AS latest_t_state
FROM crypto_trades
GROUP BY
    event_date,
    pair;

CREATE MATERIALIZED VIEW mv_crypto_quotes_daily TO agg_crypto_quotes_daily
(
    `event_date` Date,
    `pair` String,
    `bid_state` AggregateFunction(argMax, Float64, UInt64),
    `ask_state` AggregateFunction(argMax, Float64, UInt64),
    `latest_t_state` AggregateFunction(max, UInt64)
)
AS SELECT
    toDate(fromUnixTimestamp64Milli(t, 'UTC')) AS event_date,
    pair,
    argMaxState(bp, t) AS bid_state,
    argMaxState(ap, t) AS ask_state,
    maxState(t) AS latest_t_state
FROM crypto_quotes
GROUP BY
    event_date,
    pair;

CREATE TABLE agg_stock_quotes_daily
(
    `event_date` Date,
    `sym` LowCardinality(String),
    `bid_state` AggregateFunction(argMax, Float64, UInt64),
    `ask_state` AggregateFunction(argMax, Float64, UInt64),
    `latest_t_state` AggregateFunction(max, UInt64)
)
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, sym);

CREATE TABLE agg_stock_trades_daily
(
    `event_date` Date,
    `sym` LowCardinality(String),
    `open_price_state` AggregateFunction(argMin, Float64, UInt64),
    `last_price_state` AggregateFunction(argMax, Float64, UInt64),
    `volume_state` AggregateFunction(sum, UInt64),
    `latest_t_state` AggregateFunction(max, UInt64)
)
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, sym);


CREATE MATERIALIZED VIEW mv_stock_quotes_daily TO agg_stock_quotes_daily
(
    `event_date` Date,
    `sym` String,
    `bid_state` AggregateFunction(argMax, Float64, UInt64),
    `ask_state` AggregateFunction(argMax, Float64, UInt64),
    `latest_t_state` AggregateFunction(max, UInt64)
)
AS SELECT
    toDate(fromUnixTimestamp64Milli(t, 'UTC')) AS event_date,
    sym,
    argMaxState(bp, t) AS bid_state,
    argMaxState(ap, t) AS ask_state,
    maxState(t) AS latest_t_state
FROM quotes
GROUP BY
    event_date,
    sym;

CREATE MATERIALIZED VIEW mv_stock_trades_daily TO agg_stock_trades_daily
(
    `event_date` Date,
    `sym` String,
    `open_price_state` AggregateFunction(argMin, Float64, UInt64),
    `last_price_state` AggregateFunction(argMax, Float64, UInt64),
    `volume_state` AggregateFunction(sum, UInt64),
    `latest_t_state` AggregateFunction(max, UInt64)
)
AS SELECT
    toDate(fromUnixTimestamp64Milli(t, 'UTC')) AS event_date,
    sym,
    argMinState(p, t) AS open_price_state,
    argMaxState(p, t) AS last_price_state,
    sumState(s) AS volume_state,
    maxState(t) AS latest_t_state
FROM trades
GROUP BY
    event_date,
    sym;
