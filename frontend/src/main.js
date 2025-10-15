
import { executeQuery } from "./clickhouse.js";
import { liveCrypto } from './queries.js';
import { prettyPrintSize, getConfig } from './utils.js';
import { init as initCrypto, stopCrypto } from './crypto.js';
import { init as initStocks, stopStock } from './stock.js';


const max_times_in_avg = 10;

let responseTimes = [];
let pingTimes = [];
let real_time = true;
let main_table; // Perspective table loaded in viewer
let total_size = 0;
let configs = {}; // viewer layout presets loaded from config.json
let refreshInterval = null;
let pingInterval = null;



document.addEventListener('marketChange', ({ detail }) => {
  if (detail.market === 'cryptos') {
    stopStock();
    initCrypto();

  } else {
    stopCrypto();
    initStocks();
  }
});


// ---------- data fetch ----------
async function get_rows(lower_bound, upper_bound) {

  const query = liveCrypto();

  return executeQuery(query);
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

    initCrypto();
    
    // Start automatic ping every 5 seconds
    pingClickHouse(); // Initial ping
    pingInterval = setInterval(pingClickHouse, 5000);
  } catch (err) {
    console.error("crypto dashboard error", err);
  }
})();
