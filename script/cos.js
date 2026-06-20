// Variable "cos" (holding float32) — cosine wave, updated every 1 s.

const INTERVAL_MS = 1000;
const PHASE_STEP = Math.PI / 10;

let phase = 0;

modbus.setInterval(INTERVAL_MS, function () {
  map.write('cos', Math.cos(phase));
  phase += PHASE_STEP;
});
