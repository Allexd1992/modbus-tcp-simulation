(function () {
  "use strict";

  globalThis.__mapChangeHandlers = globalThis.__mapChangeHandlers || {};
  globalThis.__mapChangeAllHandlers = globalThis.__mapChangeAllHandlers || [];

  function findDef(name) {
    var defs = globalThis.__varMapDefinitions || [];
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].name === name) return defs[i];
    }
    return null;
  }

  function readFn(kind) {
    if (kind === "holding") return modbus.holdingRead.bind(modbus);
    if (kind === "input") return modbus.inputRead.bind(modbus);
    if (kind === "coil") return modbus.coilRead.bind(modbus);
    if (kind === "dinput") return modbus.discreteInputRead.bind(modbus);
    throw new Error("unknown kind: " + kind);
  }

  function writeFn(kind) {
    if (kind === "holding") return modbus.holdingWrite.bind(modbus);
    if (kind === "input") return modbus.inputWrite.bind(modbus);
    if (kind === "coil") return modbus.coilWrite.bind(modbus);
    if (kind === "dinput") return modbus.discreteInputWrite.bind(modbus);
    throw new Error("unknown kind: " + kind);
  }

  function readTyped(def) {
    var k = def.kind;
    var t = def.type;
    var a = def.addr;
    var o = def.order || "HL";
    var b = def.bit != null ? Number(def.bit) : 0;
    if (t === "bool") return !!readFn(k)(a);
    if (t === "bit") {
      if (k !== "holding" && k !== "input") {
        throw new Error("bit type requires holding or input");
      }
      var word = Number(readFn(k)(a)) & 0xffff;
      return modbus.testBit(word, b);
    }
    if (k === "holding") {
      if (t === "uint16") return Number(modbus.holdingRead(a)) & 0xffff;
      if (t === "int16") return (Number(modbus.holdingRead(a)) << 16) >> 16;
      if (t === "int32") return modbus.holdingReadInt32(a, o);
      if (t === "float32") return modbus.holdingReadFloat(a, o);
      if (t === "float64") return modbus.holdingReadDouble(a);
      if (t === "int64") return modbus.holdingReadInt64(a);
    }
    if (k === "input") {
      if (t === "uint16") return Number(modbus.inputRead(a)) & 0xffff;
      if (t === "int16") return (Number(modbus.inputRead(a)) << 16) >> 16;
      if (t === "int32") return modbus.inputReadInt32(a, o);
      if (t === "float32") return modbus.inputReadFloat(a, o);
      if (t === "float64") return modbus.inputReadDouble(a);
      if (t === "int64") return modbus.inputReadInt64(a);
    }
    throw new Error("unsupported map entry: " + k + "/" + t);
  }

  function writeTyped(def, value) {
    var k = def.kind;
    var t = def.type;
    var a = def.addr;
    var o = def.order || "HL";
    var b = def.bit != null ? Number(def.bit) : 0;
    if (t === "bool") {
      writeFn(k)(a, !!value);
      return;
    }
    if (t === "bit") {
      if (k !== "holding" && k !== "input") {
        throw new Error("bit type requires holding or input");
      }
      var word = Number(readFn(k)(a)) & 0xffff;
      writeFn(k)(a, modbus.setBit(word, b, !!value));
      return;
    }
    if (k === "holding") {
      if (t === "uint16") modbus.holdingWrite(a, Number(value) & 0xffff);
      else if (t === "int16") modbus.holdingWrite(a, Number(value) & 0xffff);
      else if (t === "int32") modbus.holdingWriteInt32(a, value, o);
      else if (t === "float32") modbus.holdingWriteFloat(a, value, o);
      else if (t === "float64") modbus.holdingWriteDouble(a, value);
      else if (t === "int64") modbus.holdingWriteInt64(a, value);
      else throw new Error("unsupported type: " + t);
      return;
    }
    if (k === "input") {
      if (t === "uint16") modbus.inputWrite(a, Number(value) & 0xffff);
      else if (t === "int16") modbus.inputWrite(a, Number(value) & 0xffff);
      else if (t === "int32") modbus.inputWriteInt32(a, value, o);
      else if (t === "float32") modbus.inputWriteFloat(a, value, o);
      else if (t === "float64") modbus.inputWriteDouble(a, value);
      else if (t === "int64") modbus.inputWriteInt64(a, value);
      else throw new Error("unsupported type: " + t);
      return;
    }
    throw new Error("unsupported map entry: " + k + "/" + t);
  }

  function wordSpan(def) {
    var t = def.type;
    if (t === "int32" || t === "float32") return 2;
    if (t === "float64" || t === "int64") return 4;
    return 1;
  }

  function writeSpan(kind, values) {
    if (Array.isArray(values)) return values.length;
    return 1;
  }

  function mapKindFromWrite(kind) {
    if (kind === "discreteInput") return "dinput";
    return kind;
  }

  function overlaps(def, kind, addr, span) {
    if (def.kind !== mapKindFromWrite(kind)) return false;
    var defEnd = def.addr + wordSpan(def) - 1;
    var writeEnd = addr + span - 1;
    return def.addr <= writeEnd && addr <= defEnd;
  }

  function notifyMapChange(name, value) {
    var list = globalThis.__mapChangeHandlers[name] || [];
    for (var i = 0; i < list.length; i++) {
      list[i](value, name);
    }
    var all = globalThis.__mapChangeAllHandlers;
    for (var j = 0; j < all.length; j++) {
      all[j](name, value);
    }
  }

  function __dispatchMapChange(kind, addr, values) {
    var defs = globalThis.__varMapDefinitions || [];
    var span = writeSpan(kind, values);
    for (var i = 0; i < defs.length; i++) {
      var def = defs[i];
      if (!overlaps(def, kind, addr, span)) continue;
      try {
        notifyMapChange(def.name, readTyped(def));
      } catch (e) {
        /* ignore read errors during dispatch */
      }
    }
  }

  function installMapApi() {
    if (!globalThis.modbus) {
      throw new Error("modbus API not installed");
    }
    globalThis.map = {
      read: function (name) {
        var def = findDef(name);
        if (!def) throw new Error("map: unknown variable: " + name);
        return readTyped(def);
      },
      write: function (name, value) {
        var def = findDef(name);
        if (!def) throw new Error("map: unknown variable: " + name);
        writeTyped(def, value);
      },
      get: function (name) {
        return this.read(name);
      },
      set: function (name, value) {
        this.write(name, value);
      },
      has: function (name) {
        return !!findDef(name);
      },
      list: function () {
        var defs = globalThis.__varMapDefinitions || [];
        var out = [];
        for (var i = 0; i < defs.length; i++) out.push(defs[i].name);
        return out;
      },
      def: function (name) {
        var d = findDef(name);
        if (!d) return null;
        return {
          name: d.name,
          kind: d.kind,
          addr: d.addr,
          type: d.type,
          bit: d.bit != null ? d.bit : 0,
          order: d.order || "HL",
        };
      },
      onChange: function (nameOrFn, maybeFn) {
        if (typeof nameOrFn === "function") {
          globalThis.__mapChangeAllHandlers.push(nameOrFn);
          return;
        }
        var name = nameOrFn;
        var fn = maybeFn;
        if (typeof fn !== "function") {
          throw new Error("map.onChange requires a callback function");
        }
        if (!findDef(name)) {
          throw new Error("map: unknown variable: " + name);
        }
        if (!globalThis.__mapChangeHandlers[name]) {
          globalThis.__mapChangeHandlers[name] = [];
        }
        globalThis.__mapChangeHandlers[name].push(fn);
      },
    };
  }

  globalThis.__installMapApi = installMapApi;
  globalThis.__dispatchMapChange = __dispatchMapChange;
  installMapApi();
})();
