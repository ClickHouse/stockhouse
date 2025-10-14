import perspective from "https://cdn.jsdelivr.net/npm/@finos/perspective@3.0.0/dist/cdn/perspective.js";
import { executeQuery } from "./clickhouse.js";
import { liveCrypto, sqlPairSpread} from './queries.js';
import { prettyPrintSize, getConfig } from './utils.js';
import { displayPriceSpread } from './candlestick.js';


const max_times_in_avg = 10;

let responseTimes = [];
let real_time = true;
let main_table; // Perspective table loaded in viewer
let total_size = 0;
let configs = {}; // viewer layout presets loaded from config.json


// ---------- data fetch ----------
async function get_rows(lower_bound, upper_bound) {

  const query = liveCrypto();
  return executeQuery(query);
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
  } catch (err) {
    console.error("crypto dashboard error", err);
  }
})();
