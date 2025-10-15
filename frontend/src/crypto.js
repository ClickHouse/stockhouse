
import perspective from "https://cdn.jsdelivr.net/npm/@finos/perspective@3.0.0/dist/cdn/perspective.js";
import { executeQuery } from "./clickhouse.js";
import { liveCrypto, cryptoPairSpread } from './queries.js';
import { prettyPrintSize, getConfig } from './utils.js';

const max_times_in_avg = 10;
let main_table; // Perspective table loaded in viewer
let candlestick_table;
let selectedPair;
let responseTimes = [];
let total_size = 0;
let refreshInterval = null;
let showCandlestick = false;

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
            if (showCandlestick) {
                updateCandlestick(candlestick_table, selectedPair, Date.now() - 1 * 60 * 60 * 1000);
            }
        }, detail.ms);
    }
});

// ---------- streaming loop ----------
async function updateMainTable(table, lower_bound) {
    let upper_bound = Date.now();
    const start = Date.now();
    const query = liveCrypto();
    const { rows, has_rows } = await executeQuery(query);
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

export async function init() {

    document.getElementById('crypto-container').style.display = 'flex';
    document.getElementById('stock-container').style.display = 'none';
    let configs;
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
        showCandlestick = true;
        selectedPair = e.detail.row.pair;
        displayCandlestick(selectedPair);
    });
    main_table = await worker.table(rows, { index: 'pair' });

    viewer.load(main_table);
    viewer.restore({ theme: "Pro Dark", ...(configs['crypto-trades'] || {}) });

    updateMainTable(main_table, now);
}



async function displayCandlestick(pair) {

    const configs = await getConfig();

    const viewer = document.getElementById("crypto-spread");
    const closeBtn = document.getElementById("close-spread");
    const placeholder = document.getElementById("crypto-spread-placeholder");

    // Ensure viewer & close button are visible, hide placeholder
    viewer.style.display = "flex";
    closeBtn.style.display = "block";
    placeholder.style.display = "none";


    // Close handler
    closeBtn.onclick = () => {
        viewer.style.display = "none";
        closeBtn.style.display = "none";
        placeholder.style.display = "flex";
    };

    const now = Date.now();
    const lower = now - 1 * 60 * 60 * 1000; // last 1h
    const query = cryptoPairSpread(pair, lower, now, 60);
    const { rows, has_rows } = await executeQuery(query);
    const worker = await perspective.worker();
    candlestick_table = await worker.table(rows, { index: 'timestamp' });
    viewer.load(candlestick_table);
    viewer.restore({ theme: "Pro Dark", ...(configs['pair-price-spread'] || {}) });
    updateCandlestick(candlestick_table, pair, now);
}

// run after DOM is parsed
window.addEventListener('DOMContentLoaded', async () => {
    // make sure the custom element is defined
    if (customElements.whenDefined) {
        await customElements.whenDefined('perspective-viewer');
    }

    const viewer = document.querySelector('perspective-viewer#crypto-spread');
    if (!viewer) return;

    // helper that tries to grab the inner candlestick
    const getCandlestick = () =>
        document.querySelector('perspective-viewer-d3fc-candlestick');

    // if it's already there, use it; otherwise watch until it appears
    const candlestick = getCandlestick();
    if (candlestick) {
        patchCandlestick(candlestick);
    } else {
        const mo = new MutationObserver(() => {
            const el = getCandlestick();
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


// ---------- streaming loop ----------
async function updateCandlestick(table, pair, lower_bound) {
    console.log('updateCandlestick', pair, lower_bound);
    let upper_bound = Date.now();
    const prev_lower_bound = lower_bound - 60;
    const query = cryptoPairSpread(pair, prev_lower_bound, upper_bound, 60);
    const { rows, has_rows } = await executeQuery(query);

    if (has_rows) {
        table.update(rows);
    }
    lower_bound = upper_bound;
    upper_bound = Date.now();
}
