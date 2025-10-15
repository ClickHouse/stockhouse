
import perspective from "https://cdn.jsdelivr.net/npm/@finos/perspective@3.0.0/dist/cdn/perspective.js";
import { executeQuery } from "./clickhouse.js";
import { liveStock, stockCandlestick } from './queries.js';
import { prettyPrintSize, getConfig } from './utils.js';

const max_times_in_avg = 10;
let main_table; // Perspective table loaded in viewer
let candlestick_table;
let selectedSymbol;
let responseTimes = [];
let total_size = 0;
let refreshInterval = null;
let showCandlestick = false;

document.addEventListener('refreshChange', ({ detail }) => {
    if (detail.market !== 'stocks') return;
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
                updateCandlestick(candlestick_table, selectedSymbol, Date.now() - 1 * 60 * 60 * 1000);
            }
        }, detail.ms);
    }
});

// ---------- streaming loop ----------
async function updateMainTable(table, lower_bound) {
    console.log("update main stock table")
    let upper_bound = Date.now();
    const start = Date.now();
    const query = liveStock();
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

    document.getElementById('crypto-container').style.display = 'none';
    document.getElementById('stock-container').style.display = 'flex';
    let configs;
    // Fetch viewer layout presets
    try {
        configs = await getConfig();
    } catch (e) {
        console.warn("Failed to load config.json", e);
    }

    const worker = await perspective.worker();
    let now = Date.now();
    const query = liveStock();
    const { rows, has_rows } = await executeQuery(query);

    const viewer = document.getElementById("stock-table");

    viewer.addEventListener("perspective-click", (e) => {
        showCandlestick = true;
        selectedSymbol = e.detail.row.sym;
        displayCandlestick(selectedSymbol);
    });
    main_table = await worker.table(rows, { index: 'sym' });

    await viewer.load(main_table); viewer.restore({ theme: "Pro Dark", ...(configs['stock-trades'] || {}) });

    updateMainTable(main_table, now);
}

export function stopStock() {
    clearInterval(refreshInterval);
    refreshInterval = null;
}

async function displayCandlestick(symbol) {

    const configs = await getConfig();

    const viewer = document.getElementById("stock-spread");
    const closeBtn = document.getElementById("close-spread");
    const placeholder = document.getElementById("stock-spread-placeholder");

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
    const lower = now - 8 * 60 * 60 * 1000; // last 1h
    const query = stockCandlestick(symbol, lower, now, 60);
    const { rows, has_rows } = await executeQuery(query);
    const worker = await perspective.worker();
    candlestick_table = await worker.table(rows, { index: 'timestamp' });
    viewer.load(candlestick_table);
    viewer.restore({ theme: "Pro Dark", ...(configs['stock-price-spread'] || {}) });
    updateCandlestick(candlestick_table, symbol, now);
}

// run after DOM is parsed
window.addEventListener('DOMContentLoaded', async () => {
    // make sure the custom element is defined
    if (customElements.whenDefined) {
        await customElements.whenDefined('perspective-viewer');
    }

    const viewer = document.querySelector('perspective-viewer#stock-spread');
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
async function updateCandlestick(table, sym, lower_bound) {
    let upper_bound = Date.now();
    const prev_lower_bound = lower_bound - 60;
    const query = stockCandlestick(sym, prev_lower_bound, upper_bound, 60);
    const { rows, has_rows } = await executeQuery(query);

    if (has_rows) {
        table.update(rows);
    }
    lower_bound = upper_bound;
    upper_bound = Date.now();
}


