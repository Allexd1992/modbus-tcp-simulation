

modbus.setInterval(1000, function () {
  let v = (Number(modbus.holdingRead(5)) + 1) & 0xffff;
  modbus.holdingWrite(5, v);
});
