import perspective from "https://cdn.jsdelivr.net/npm/@finos/perspective@3.0.0/dist/cdn/perspective.js";

// Dashboard type is injected by each HTML file via `window.dashboardType`
const DASHBOARD = window.dashboardType || "spread";

// ClickHouse connection (read-only credentials)
const chUser = import.meta.env.VITE_CH_USER;
const chPassword = import.meta.env.VITE_CH_PASSWORD;
const clickhouse_url = import.meta.env.VITE_CH_URL;
const credentials = btoa(`${chUser}:${chPassword}`);
const authHeader = `Basic ${credentials}`;
if (!clickhouse_url || !chUser || !chPassword) {
  console.error("Missing Vite env vars: VITE_CH_URL, VITE_CH_USER, VITE_CH_PASSWORD");
}

const prev_window = 10 * 60 * 1000; // 10-minute back-fill for change calculations
const max_times_in_avg = 10;

let responseTimes = [];
let real_time = true;
let main_table; // Perspective table loaded in viewer
let total_size = 0;
let configs = {}; // viewer layout presets loaded from config.json

// ---------- SQL builders for every dashboard ----------
function sqlSpread(lb, ub) {
  return `SELECT pair, t AS ts, bp AS bid, ap AS ask, ap - bp AS spread
          FROM polygon.crypto_quotes
          WHERE t > ${lb} AND t <= ${ub}
          ORDER BY ts ASC FORMAT Arrow`;
}

function liveCrypto() {
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

function sqlPairSpread(pair, lb, ub, bucket_sec) {
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


// ---------- helpers ----------
function prettyPrintSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(2)} ${sizes[i]}`;
}

// ---------- data fetch ----------
async function get_rows(lower_bound, upper_bound) {
  const prev_lower_bound = lower_bound - prev_window;
  // const query = buildQuery(prev_lower_bound, upper_bound);
  const query = liveCrypto();
  const response = await fetch(clickhouse_url, {
    method: "POST",
    body: query,
    headers: { Authorization: authHeader }
  });
  const rows = await response.arrayBuffer();
  return { rows, has_rows: rows.byteLength > 842 };
}

// ---------- streaming loop ----------
async function updateMainTable(table, lower_bound) {

  let upper_bound = Date.now();
  while (real_time) {

    const start = Date.now();
    const { rows, has_rows } = await get_rows(lower_bound, upper_bound);
    if (has_rows) {
      table.update(rows);
    }
    // UI stats
    const execTime = Date.now() - start;
    responseTimes.push(execTime);
    if (responseTimes.length > max_times_in_avg) responseTimes.shift();
    const avgMs = (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2);
    document.getElementById("avg_response_time").textContent = `Avg response time: ${avgMs} ms`;
    document.getElementById("last_updated").textContent = `Last updated: ${new Date(upper_bound).toISOString()}`;
    total_size += rows.byteLength;
    document.getElementById("total_download").textContent = `Total Downloaded: ${prettyPrintSize(total_size)}`;

    lower_bound = upper_bound;
    upper_bound = Date.now();
  }
}


// ---------- streaming loop ----------
async function updatePairSpread(table, pair, lower_bound) {

  let upper_bound = Date.now();
  while (real_time) {
    const prev_lower_bound = lower_bound - 60;
    const query = sqlPairSpread(pair, prev_lower_bound, upper_bound, 60);
    const response = await fetch(clickhouse_url, {
      method: "POST",
      body: query,
      headers: { Authorization: authHeader }
    });

    const rows = await response.arrayBuffer();

    const has_rows = rows.byteLength > 842
    if (has_rows) {
      table.update(rows);
    }
    lower_bound = upper_bound;
    upper_bound = Date.now();
    // wait 1 second
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// ---------- mode toggle ----------
export function setMode() {
  real_time = !real_time;
  const viewer = document.querySelector("perspective-viewer");
  if (real_time) {
    const lower = Date.now() - 3 * 24 * 60 * 60 * 1000;
    update(main_table, lower);
  } else {
    // Stop streaming loop; fetch full dataset once
    real_time = false;
    viewer.restore({ theme: "Pro Dark", ...(configs[DASHBOARD] || {}) });
  }
}

async function displayPriceSpread(pair) {
  // Fetch viewer layout presets
  try {
    const cfgResponse = await fetch("/config.json");
    if (cfgResponse.ok) configs = await cfgResponse.json();
  } catch (e) {
    console.warn("Failed to load config.json", e);
  }
  const viewer = document.getElementById("pair-price-spread");
  const closeBtn = document.getElementById("close-spread");
  const container = document.getElementById("spread-container");

  // Ensure viewer & close button are visible
  container.style.display = "flex";


  // Close handler
  closeBtn.onclick = () => {
    container.style.display = "none";
  };

  const now = Date.now();
  const lower = now - 1 * 60 * 60 * 1000; // last 1h
  const query = sqlPairSpread(pair, lower, now, 60);

  const response = await fetch(clickhouse_url, {
    method: "POST",
    body: query,
    headers: { Authorization: authHeader }
  });

  const rows = await response.arrayBuffer();

  const worker = await perspective.worker();
  const table = await worker.table(rows, { index: 'timestamp' });

  viewer.load(table);
  viewer.restore({ theme: "Pro Dark", ...(configs['pair-price-spread'] || {}) });
  updatePairSpread(table, pair, now);
}

// run after DOM is parsed
window.addEventListener('DOMContentLoaded', async () => {
  console.log("DOMContentLoaded");
  // make sure the custom element is defined
  if (customElements.whenDefined) {
    await customElements.whenDefined('perspective-viewer');
  }

  const viewer = document.querySelector('perspective-viewer#pair-price-spread');
  if (!viewer) return;

  console.log(viewer);
  // helper that tries to grab the inner candlestick
  const getCandlestick = () =>
    document.querySelector('perspective-viewer-d3fc-candlestick');

  // if it's already there, use it; otherwise watch until it appears
  const candlestick = getCandlestick();
  console.log(candlestick);
  if (candlestick) {
    patchCandlestick(candlestick);
  } else {
    const mo = new MutationObserver(() => {
      console.log("MutationObserver");
      const el = getCandlestick();
      console.log(el);
      if (el) {
        mo.disconnect();
        patchCandlestick(el);
      }
    });
    mo.observe(viewer, { childList: true, subtree: true });
  }
});

function patchCandlestick(el) {
  // el is <perspective-viewer-d3fc-candlestick>
  const sr = el.shadowRoot;
  if (!sr) return;

  // inject/override styles inside its shadow root
  if (!sr.querySelector('#custom-candlestick-style')) {
    const style = document.createElement('style');
    style.id = 'custom-candlestick-style';
    style.textContent = `
      .zoom-controls button#one-year { display: none !important; }
      .zoom-controls button#six-months { display: none !important; }
      .zoom-controls button#one-month { display: none !important; }
      /* any other overrides... */
    `;
    sr.appendChild(style);
  }
}


// ---------- bootstrap ----------
(async function () {
  try {
    // Fetch viewer layout presets
    try {
      const cfgResponse = await fetch("/config.json");
      if (cfgResponse.ok) configs = await cfgResponse.json();
    } catch (e) {
      console.warn("Failed to load config.json", e);
    }


    

    const worker = await perspective.worker();
    let now = Date.now();
    const query = liveCrypto();

    const response = await fetch(clickhouse_url, {
      method: "POST",
      body: query,
      headers: { Authorization: authHeader }
    });
    const rows = await response.arrayBuffer();
    const viewer = document.getElementById("main-table");

    viewer.addEventListener("perspective-click", (e) => {
      displayPriceSpread(e.detail.row.pair);
    });
    main_table = await worker.table(rows, { index: 'pair' });
    
    viewer.load(main_table);
    viewer.restore({ theme: "Pro Dark", ...(configs['trades'] || {}) });

    updateMainTable(main_table, now);
  } catch (err) {
    console.error("crypto dashboard error", err);
  }
})();
