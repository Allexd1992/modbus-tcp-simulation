// Variable "sin" (holding float32) — sinusoid, updated every 1 s.

const INTERVAL_MS = 1000;
const PHASE_STEP = Math.PI / 10; // 0 → 1 → 0 → −1 each second (full wave in 4 s)

let  phase = 0;

modbus.setInterval(INTERVAL_MS, function () {
  map.write('sin', Math.sin(phase));
  phase += PHASE_STEP;
});
