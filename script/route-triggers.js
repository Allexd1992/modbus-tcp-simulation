// Cycle routeTrigger01..05: pulse one trigger to 1 every 5 s (others reset to 0).

const INTERVAL_MS = 60000;
const TRIGGERS = [
  "routeTrigger01",
  "routeTrigger02",
  "routeTrigger03",
  "routeTrigger04",
  "routeTrigger05",
];

let index = 0;

modbus.setInterval(INTERVAL_MS, function () {
  for (var i = 0; i < TRIGGERS.length; i++) {
    map.write(TRIGGERS[i], 0);
  }
  map.write(TRIGGERS[index], 1);
  index = (index + 1) % TRIGGERS.length;
});
