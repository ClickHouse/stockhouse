import perspective from "https://cdn.jsdelivr.net/npm/@finos/perspective@3.0.0/dist/cdn/perspective.js";
import {executeQuery} from './clickhouse.js';
import {sqlPairSpread} from './queries.js';
import { getConfig } from './utils.js';

export async function displayPriceSpread(pair) {

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
  const query = sqlPairSpread(pair, lower, now, 60);
  const { rows, has_rows } = await executeQuery(query);
  const worker = await perspective.worker();
  const table = await worker.table(rows, { index: 'timestamp' });
  viewer.load(table);
  viewer.restore({ theme: "Pro Dark", ...(configs['pair-price-spread'] || {}) });
  updatePairSpread(table, pair, now);
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
async function updatePairSpread(table, pair, lower_bound) {

  let upper_bound = Date.now();
  while (real_time) {
    const prev_lower_bound = lower_bound - 60;
    const query = sqlPairSpread(pair, prev_lower_bound, upper_bound, 60);
    const { rows, has_rows } = await executeQuery(query);

    if (has_rows) {
      table.update(rows);
    }
    lower_bound = upper_bound;
    upper_bound = Date.now();
    // wait 1 second
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
