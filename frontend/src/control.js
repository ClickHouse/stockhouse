// --- Refresh slider mapping ---
const range = document.getElementById('refreshRange');
const label = document.getElementById('refreshLabel');

// v=0 => null (paused). v=1..100 maps linearly 1000ms -> 10ms
function valueToMs(v) {
  if (v === 0) return null;
  // Linear map from 1000 to 10 over 99 steps
  return Math.round(1000 - (v - 1) * (990 / 99));
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
      detail: { ms, paused: ms === null, sliderValue: v }
    })
  );
}

range.addEventListener('input', updateRefreshLabel);
updateRefreshLabel();

// --- Market switch events ---
const marketForm = document.getElementById('marketForm');
marketForm.addEventListener('change', (e) => {
    console.log(e.target.value)
  if (e.target.name === 'market') {
    if (e.target.value === 'cryptos') {
      document.getElementById('crypto-container').style.display = 'flex';
      document.getElementById('stock-container').style.display = 'none';
    } else {
      document.getElementById('crypto-container').style.display = 'none';
      document.getElementById('stock-container').style.display = 'flex';
    }
  }
});
