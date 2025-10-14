import perspective from "https://cdn.jsdelivr.net/npm/@finos/perspective@3.0.0/dist/cdn/perspective.js";
import { executeQuery } from "./clickhouse.js";
import { liveCrypto, sqlPairSpread } from './queries.js';
import { prettyPrintSize, getConfig } from './utils.js';
import { displayPriceSpread } from './candlestick.js';


const max_times_in_avg = 10;

let responseTimes = [];
let pingTimes = [];
let real_time = true;
let main_table; // Perspective table loaded in viewer
let total_size = 0;
let configs = {}; // viewer layout presets loaded from config.json
let refreshInterval = null;
let pingInterval = null;

document.addEventListener('refreshChange', ({ detail }) => {

  if (detail.paused) {
    // Handle pause state
    clearInterval(refreshInterval);
    refreshInterval = null;
  } else {
    // Handle active refresh with detail.ms milliseconds
    clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      updateMainTable(main_table, Date.now() - 3 * 24 * 60 * 60 * 1000);
    }, detail.ms);
  }
});


// ---------- data fetch ----------
async function get_rows(lower_bound, upper_bound) {

  const query = liveCrypto();

  return executeQuery(query);
}

// ---------- streaming loop ----------
async function updateMainTable(table, lower_bound) {

  let upper_bound = Date.now();
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

// ---------- ping function ----------
async function pingClickHouse() {
  try {
    const start = Date.now();
    await executeQuery('SELECT 1');
    const pingTime = Date.now() - start;
    
    pingTimes.push(pingTime);
    if (pingTimes.length > max_times_in_avg) pingTimes.shift();
    
    const avgPing = (pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length).toFixed(2);
    document.getElementById("ping_time").textContent = `Ping time: ${avgPing} ms (avg of ${pingTimes.length})`;
  } catch (err) {
    console.error("Ping error:", err);
    document.getElementById("ping_time").textContent = `Ping time: Error`;
  }
}

// ---------- bootstrap ----------
(async function () {
  try {
    // Fetch viewer layout presets
    try {
      configs = await getConfig();
    } catch (e) {
      console.warn("Failed to load config.json", e);
    }

    const worker = await perspective.worker();
    let now = Date.now();
    const query = liveCrypto();
    const { rows, has_rows } = await executeQuery(query);

    const viewer = document.getElementById("crypto-table");

    viewer.addEventListener("perspective-click", (e) => {
      displayPriceSpread(e.detail.row.pair);
    });
    main_table = await worker.table(rows, { index: 'pair' });

    viewer.load(main_table);
    viewer.restore({ theme: "Pro Dark", ...(configs['trades'] || {}) });

    updateMainTable(main_table, now);
    
    // Start automatic ping every 5 seconds
    pingClickHouse(); // Initial ping
    pingInterval = setInterval(pingClickHouse, 5000);
  } catch (err) {
    console.error("crypto dashboard error", err);
  }
})();
