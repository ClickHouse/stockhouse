import perspective from "https://cdn.jsdelivr.net/npm/@finos/perspective@3.0.0/dist/cdn/perspective.js";
import { executeQuery } from "./clickhouse.js";
import { liveStock, stockLivePriceHistoricQuery, stockMinutePriceHistoricQuery, stockHourPriceHistoricQuery, stockDayPriceHistoricQuery } from './queries.js';
import { prettyPrintSize, getConfig } from './utils.js';

const max_times_in_avg = 10;
let main_table; // Perspective table loaded in viewer
let candlestick_table;
let selectedSymbol;
let responseTimes = [];
let total_size = 0;
let refreshInterval = null;
let showCandlestick = false;
let bucketInterval = "5min";

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

    document.getElementById('crypto-main').style.display = 'none';
    document.getElementById('stock-main').style.display = 'block';
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
    const closeBtn = document.getElementById("close-stock-spread");
    const candlestickInterval = document.getElementById("candlestick-stock-interval");
    const placeholder = document.getElementById("stock-spread-placeholder");

    const intervalBtn5min = document.getElementById("stock-5min");
    const intervalBtn30min = document.getElementById("stock-30min");
    const intervalBtn1hour = document.getElementById("stock-1hour");
    const intervalBtn1day = document.getElementById("stock-1day");

    // Ensure viewer & close button are visible, hide placeholder
    viewer.style.display = "flex";
    closeBtn.style.display = "block";
    placeholder.style.display = "none";
    candlestickInterval.style.display = "flex";

    // Close handler
    closeBtn.onclick = () => {
        viewer.style.display = "none";
        closeBtn.style.display = "none";
        placeholder.style.display = "flex";
        candlestickInterval.style.display = "none";
    };

    intervalBtn5min.onclick = () => {
        bucketInterval = "5min";
        updateCandlestick(true);
    };
    intervalBtn30min.onclick = () => {
        bucketInterval = "30min";
        updateCandlestick(true);
    };
    intervalBtn1hour.onclick = () => {
        bucketInterval = "1hour";
        updateCandlestick(true);
    };
    intervalBtn1day.onclick = () => {
        bucketInterval = "1day";
        updateCandlestick(true);
    };



    let query = stockLivePriceHistoricQuery(symbol);
    let { rows, has_rows } = await executeQuery(query);
    const worker = await perspective.worker();
    if (has_rows) {
        candlestick_table = await worker.table(rows, { index: 'timestamp' });
    } else {
        query = stockDayPriceHistoricQuery(symbol);
        let { rows, has_rows } = await executeQuery(query);
        if (has_rows) {
            bucketInterval = "1day";
            candlestick_table = await worker.table(rows, { index: 'timestamp' });
        }
    }
    viewer.load(candlestick_table);
    viewer.restore({ theme: "Pro Dark", ...(configs['stock-price-spread'] || {}) });
    updateCandlestick();
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


function getQuery(interval) {
    switch (interval) {
        case "5min":
            return stockLivePriceHistoricQuery(selectedSymbol);
        case "30min":
            return stockMinutePriceHistoricQuery(selectedSymbol);
        case "1hour":
            return stockHourPriceHistoricQuery(selectedSymbol);
        case "1day":
            return stockDayPriceHistoricQuery(selectedSymbol);
    }
}

// ---------- streaming loop ----------
async function updateCandlestick(replace = false) {

    const query = getQuery(bucketInterval);
    const { rows, has_rows } = await executeQuery(query);

    if (has_rows) {
        if (replace) {
            candlestick_table.replace(rows);
        } else {
            candlestick_table.update(rows);
        }
    }

}

