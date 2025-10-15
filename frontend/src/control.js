// --- Refresh slider mapping ---
const range = document.getElementById('refreshRange');
const label = document.getElementById('refreshLabel');

let selectedMarket = 'cryptos';

// v=0 => null (paused). v=1..100 maps linearly 1000ms -> 50ms
function valueToMs(v) {
    if (v === 0) return null;
    // Linear map from 1000 to 50 over 99 steps
    return Math.round(1000 - (v - 1) * (950 / 99));
}

function updateRefreshLabel() {
    const v = Number(range.value);
    const ms = valueToMs(v);

    if (ms === null) {
        label.textContent = 'No refresh';
    } else {
        label.textContent = (ms >= 1000 ? '1,000' : ms) + ' ms';
    }

    // Emit a CustomEvent you can listen to in your app
    document.dispatchEvent(
        new CustomEvent('refreshChange', {
            detail: { ms, paused: ms === null, sliderValue: v, market: selectedMarket }
        })
    );
}

range.addEventListener('input', updateRefreshLabel);
updateRefreshLabel();

// --- Market switch events ---
const marketForm = document.getElementById('marketForm');
marketForm.addEventListener('change', (e) => {
    if (e.target.name === 'market') {
        selectedMarket = e.target.value;
        document.dispatchEvent(
            new CustomEvent('marketChange', {
                detail: { market: e.target.value }
            })
        );

    }
});
