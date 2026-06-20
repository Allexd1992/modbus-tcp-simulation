(function () {
  "use strict";

  function normOrder(order) {
    return order === "LH" ? "LH" : "HL";
  }

  function word(v) {
    return Number(v) & 0xffff;
  }

  function combineU32(r0, r1, order) {
    var a = word(r0);
    var b = word(r1);
    return order === "LH" ? (b << 16) | a : (a << 16) | b;
  }

  function splitU32(u32, order) {
    var u = u32 >>> 0;
    var hi = (u >>> 16) & 0xffff;
    var lo = u & 0xffff;
    return order === "LH" ? [lo, hi] : [hi, lo];
  }

  function u32ToInt32(u) {
    return u | 0;
  }

  function int32ToU32(n) {
    return n >>> 0;
  }

  function u32ToFloat32(u) {
    u = u >>> 0;
    var sign = u >>> 31 ? -1 : 1;
    var exp = (u >>> 23) & 0xff;
    var frac = u & 0x7fffff;
    if (exp === 0) {
      if (frac === 0) return sign === -1 ? -0 : 0;
      return sign * (frac / 8388608) * Math.pow(2, -126);
    }
    if (exp === 255) return frac ? NaN : sign * Infinity;
    return sign * (1 + frac / 8388608) * Math.pow(2, exp - 127);
  }

  function float32ToU32(f) {
    if (f === 0) return Object.is(f, -0) ? 0x80000000 : 0;
    if (!Number.isFinite(f)) {
      if (Number.isNaN(f)) return 0x7fc00000;
      return f < 0 ? 0xff800000 : 0x7f800000;
    }
    var sign = f < 0 || Object.is(f, -0) ? 0x80000000 : 0;
    if (f < 0) f = -f;
    var exp = 0;
    var frac = 0;
    if (f >= 1) {
      while (f >= 2 && exp < 255) {
        f /= 2;
        exp += 1;
      }
      while (f < 1 && exp > 0) {
        f *= 2;
        exp -= 1;
      }
      frac = Math.round((f - 1) * 8388608);
      if (frac >= 8388608) {
        frac = 0;
        exp += 1;
      }
      exp += 127;
    } else {
      while (f < 1 && exp > -126) {
        f *= 2;
        exp -= 1;
      }
      frac = Math.round(f * 8388608);
      exp += 126;
    }
    if (exp >= 255) return sign | 0x7f800000;
    if (exp <= 0) return sign | (frac >>> (1 - exp));
    return (sign | ((exp & 0xff) << 23) | (frac & 0x7fffff)) >>> 0;
  }

  function regsToBytes8(r0, r1, r2, r3) {
    var regs = [word(r0), word(r1), word(r2), word(r3)];
    var out = [];
    for (var j = 0; j < 4; j++) {
      out.push((regs[j] >> 8) & 0xff);
      out.push(regs[j] & 0xff);
    }
    return out;
  }

  function bytes8ToRegs(bytes) {
    var regs = [];
    for (var j = 0; j < 4; j++) {
      regs.push((bytes[j * 2] << 8) | bytes[j * 2 + 1]);
    }
    return regs;
  }

  function bytesToFloat64(bytes) {
    var hi = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    var lo = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
    hi = hi >>> 0;
    lo = lo >>> 0;
    var sign = hi >>> 31 ? -1 : 1;
    var exp = (hi >>> 20) & 0x7ff;
    var hiFrac = hi & 0xfffff;
    var frac = hiFrac * 0x100000000 + lo;
    if (exp === 0) {
      if (frac === 0) return sign === -1 ? -0 : 0;
      return sign * frac * Math.pow(2, -1074);
    }
    if (exp === 0x7ff) return frac === 0 ? sign * Infinity : NaN;
    return sign * (1 + frac / Math.pow(2, 52)) * Math.pow(2, exp - 1023);
  }

  function float64ToBytes(f) {
    if (f === 0) {
      var neg = Object.is(f, -0);
      return neg
        ? [0x80, 0, 0, 0, 0, 0, 0, 0]
        : [0, 0, 0, 0, 0, 0, 0, 0];
    }
    if (!Number.isFinite(f)) {
      if (Number.isNaN(f)) return [0x7f, 0xf8, 0, 0, 0, 0, 0, 0];
      return f < 0
        ? [0xff, 0xf0, 0, 0, 0, 0, 0, 0]
        : [0x7f, 0xf0, 0, 0, 0, 0, 0, 0];
    }
    var sign = f < 0 ? 1 : 0;
    if (f < 0) f = -f;
    var exp = 0;
    var frac = 0;
    if (f >= 1) {
      while (f >= 2 && exp < 2047) {
        f /= 2;
        exp += 1;
      }
      frac = Math.round((f - 1) * Math.pow(2, 52));
      if (frac >= Math.pow(2, 52)) {
        frac = 0;
        exp += 1;
      }
      exp += 1023;
    } else {
      while (f < 1 && exp > -1022) {
        f *= 2;
        exp -= 1;
      }
      frac = Math.round(f * Math.pow(2, 52));
      exp += 1022;
    }
    if (exp >= 2047) {
      return sign
        ? [0xff, 0xf0, 0, 0, 0, 0, 0, 0]
        : [0x7f, 0xf0, 0, 0, 0, 0, 0, 0];
    }
    if (exp <= 0) {
      frac = Math.round(f * Math.pow(2, 52 + exp - 1));
      exp = 0;
    }
    var hi = (sign << 31) | ((exp & 0x7ff) << 20) | ((frac / 0x100000000) & 0xfffff);
    var lo = frac >>> 0;
    return [
      (hi >>> 24) & 0xff,
      (hi >>> 16) & 0xff,
      (hi >>> 8) & 0xff,
      hi & 0xff,
      (lo >>> 24) & 0xff,
      (lo >>> 16) & 0xff,
      (lo >>> 8) & 0xff,
      lo & 0xff,
    ];
  }

  function bytesToInt64Parts(bytes) {
    var hi =
      (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    var lo =
      (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
    return { hi: hi | 0, lo: lo >>> 0 };
  }

  function int64PartsToBytes(hi, lo) {
    hi = hi | 0;
    lo = lo >>> 0;
    return [
      (hi >>> 24) & 0xff,
      (hi >>> 16) & 0xff,
      (hi >>> 8) & 0xff,
      hi & 0xff,
      (lo >>> 24) & 0xff,
      (lo >>> 16) & 0xff,
      (lo >>> 8) & 0xff,
      lo & 0xff,
    ];
  }

  function int64PartsToNumber(hi, lo) {
    hi = hi | 0;
    lo = lo >>> 0;
    if (hi >= 0 && hi <= 0x1fffff) return hi * 0x100000000 + lo;
    var twos = (hi * 0x100000000 + lo) >>> 0;
    if (twos <= 0x7fffffff) return twos;
    return twos - 0x100000000;
  }

  function int64FromNumber(n) {
    if (!Number.isFinite(n)) throw new Error("int64: not a finite number");
    n = Math.trunc(n);
    if (n >= 0) {
      var lo = n % 0x100000000;
      var hi = Math.floor(n / 0x100000000);
      return { hi: hi | 0, lo: lo >>> 0 };
    }
    n = -n;
    var lo2 = n % 0x100000000;
    var hi2 = Math.floor(n / 0x100000000);
    var loInv = (~lo2 + 1) >>> 0;
    var hiInv = (~hi2 + (loInv === 0 ? 1 : 0)) | 0;
    return { hi: hiInv, lo: loInv };
  }

  function getBit(wordVal, bit) {
    var b = Number(bit);
    if (b < 0 || b > 15) throw new Error("bit index must be 0..15");
    return (word(wordVal) >>> b) & 1;
  }

  function testBit(wordVal, bit) {
    return getBit(wordVal, bit) !== 0;
  }

  function setBit(wordVal, bit, on) {
    var b = Number(bit);
    if (b < 0 || b > 15) throw new Error("bit index must be 0..15");
    var w = word(wordVal);
    var mask = 1 << b;
    if (on) return (w | mask) & 0xffff;
    return (w & ~mask) & 0xffff;
  }

  function getBits(wordVal, start, len) {
    var s = Number(start);
    var n = Number(len);
    if (s < 0 || s > 15 || n < 1 || n > 16 || s + n > 16) {
      throw new Error("getBits: start 0..15, len 1..16, start+len <= 16");
    }
    var mask = n === 16 ? 0xffff : (1 << n) - 1;
    return (word(wordVal) >>> s) & mask;
  }

  function setBits(wordVal, start, len, value) {
    var s = Number(start);
    var n = Number(len);
    if (s < 0 || s > 15 || n < 1 || n > 16 || s + n > 16) {
      throw new Error("setBits: start 0..15, len 1..16, start+len <= 16");
    }
    var mask = n === 16 ? 0xffff : (1 << n) - 1;
    var v = Number(value) & mask;
    var w = word(wordVal);
    var clear = ~(mask << s) & 0xffff;
    return (w & clear) | ((v << s) & 0xffff);
  }

  function readWord(readFn, addr) {
    return word(readFn(addr));
  }

  function readWords(readFn, addr, count) {
    var v = readFn(addr, count);
    if (Array.isArray(v)) {
      var out = [];
      for (var i = 0; i < v.length; i++) out.push(word(v[i]));
      return out;
    }
    return [word(v)];
  }

  function writeWords(writeFn, addr, words) {
    writeFn(addr, words);
  }

  function attachTyped(modbus, readFn, writeFn) {
    return {
      readInt32: function (addr, order) {
        var o = normOrder(order);
        var r0 = readWord(readFn, addr);
        var r1 = readWord(readFn, addr + 1);
        return u32ToInt32(combineU32(r0, r1, o));
      },
      writeInt32: function (addr, value, order) {
        var words = splitU32(int32ToU32(value | 0), normOrder(order));
        writeWords(writeFn, addr, words);
      },
      readFloat: function (addr, order) {
        var o = normOrder(order);
        var u = combineU32(readWord(readFn, addr), readWord(readFn, addr + 1), o);
        return u32ToFloat32(u);
      },
      writeFloat: function (addr, value, order) {
        var words = splitU32(float32ToU32(Number(value)), normOrder(order));
        writeWords(writeFn, addr, words);
      },
      readDouble: function (addr) {
        var regs = readWords(readFn, addr, 4);
        return bytesToFloat64(regsToBytes8(regs[0], regs[1], regs[2], regs[3]));
      },
      writeDouble: function (addr, value) {
        var bytes = float64ToBytes(Number(value));
        writeWords(writeFn, addr, bytes8ToRegs(bytes));
      },
      readInt64Parts: function (addr) {
        var regs = readWords(readFn, addr, 4);
        return bytesToInt64Parts(
          regsToBytes8(regs[0], regs[1], regs[2], regs[3])
        );
      },
      readInt64: function (addr) {
        var p = this.readInt64Parts(addr);
        return int64PartsToNumber(p.hi, p.lo);
      },
      writeInt64: function (addr, hi, lo) {
        var parts;
        if (typeof hi === "object" && hi !== null) {
          parts = { hi: hi.hi | 0, lo: hi.lo >>> 0 };
        } else if (arguments.length === 2 && typeof lo === "undefined") {
          parts = int64FromNumber(hi);
        } else {
          parts = { hi: hi | 0, lo: lo >>> 0 };
        }
        var bytes = int64PartsToBytes(parts.hi, parts.lo);
        writeWords(writeFn, addr, bytes8ToRegs(bytes));
      },
    };
  }

  var m = globalThis.modbus;
  if (!m) throw new Error("modbus API not installed");

  m.getBit = getBit;
  m.testBit = testBit;
  m.setBit = setBit;
  m.getBits = getBits;
  m.setBits = setBits;
  m.int64ToNumber = int64PartsToNumber;
  m.int64FromNumber = int64FromNumber;

  var holding = attachTyped(m, m.holdingRead, m.holdingWrite);
  m.holdingReadInt32 = holding.readInt32;
  m.holdingWriteInt32 = holding.writeInt32;
  m.holdingReadFloat = holding.readFloat;
  m.holdingWriteFloat = holding.writeFloat;
  m.holdingReadDouble = holding.readDouble;
  m.holdingWriteDouble = holding.writeDouble;
  m.holdingReadInt64 = holding.readInt64;
  m.holdingReadInt64Parts = holding.readInt64Parts;
  m.holdingWriteInt64 = holding.writeInt64;

  var input = attachTyped(m, m.inputRead, m.inputWrite);
  m.inputReadInt32 = input.readInt32;
  m.inputWriteInt32 = input.writeInt32;
  m.inputReadFloat = input.readFloat;
  m.inputWriteFloat = input.writeFloat;
  m.inputReadDouble = input.readDouble;
  m.inputWriteDouble = input.writeDouble;
  m.inputReadInt64 = input.readInt64;
  m.inputReadInt64Parts = input.readInt64Parts;
  m.inputWriteInt64 = input.writeInt64;
})();
