(function () {
  const API = "/api/v1";

  function t(key, params) {
    return window.APCS_I18N ? window.APCS_I18N.t(key, params) : key;
  }

  const kind = document.getElementById("kind");
  const displayMode = document.getElementById("displayMode");
  const wordOrder32 = document.getElementById("wordOrder32");
  const regDisplayOpts = document.getElementById("regDisplayOpts");
  const addrEl = document.getElementById("addr");
  const cntEl = document.getElementById("cnt");
  const btnRead = document.getElementById("btnRead");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const areaHint = document.getElementById("areaHint");
  const tbody = document.getElementById("gridBody");
  const theadRow = document.getElementById("matrixHeaderRow");
  const msg = document.getElementById("msg");
  const pollEnabledEl = document.getElementById("pollEnabled");
  const pollIntervalSecEl = document.getElementById("pollIntervalSec");

  const POLL_ENABLED_KEY = "apcs-poll-enabled";
  const POLL_INTERVAL_SEC_KEY = "apcs-poll-interval-sec";
  const DEFAULT_POLL_SEC = 1;
  const MIN_POLL_SEC = 1;
  const MAX_POLL_SEC = 300;

  let lastRead = { kind: "holding", addr: 0, values: [], bools: [] };
  let pollTimer = null;
  let readInFlight = false;
  /** Подсказка в статусе: таблица обрезана по числу строк */
  let matrixRowsHint = "";
  const MAX_MATRIX_ROWS = 10;
  const MAX_READ_CNT = 256;

  function pollIntervalMs() {
    if (!pollIntervalSecEl) return DEFAULT_POLL_SEC * 1000;
    let s = Number(pollIntervalSecEl.value);
    if (!Number.isFinite(s)) s = DEFAULT_POLL_SEC;
    s = Math.min(MAX_POLL_SEC, Math.max(MIN_POLL_SEC, Math.round(s)));
    return s * 1000;
  }

  function isPollEnabled() {
    return pollEnabledEl ? pollEnabledEl.checked : true;
  }

  function clampPollIntervalInput() {
    if (!pollIntervalSecEl) return DEFAULT_POLL_SEC;
    let s = Number(pollIntervalSecEl.value);
    if (!Number.isFinite(s)) s = DEFAULT_POLL_SEC;
    s = Math.min(MAX_POLL_SEC, Math.max(MIN_POLL_SEC, Math.round(s)));
    pollIntervalSecEl.value = String(s);
    return s;
  }

  function syncPollIntervalDisabled() {
    if (pollIntervalSecEl && pollEnabledEl) {
      pollIntervalSecEl.disabled = !pollEnabledEl.checked;
    }
  }

  function loadPollSettings() {
    if (!pollEnabledEl && !pollIntervalSecEl) return;
    try {
      const en = localStorage.getItem(POLL_ENABLED_KEY);
      if (pollEnabledEl) {
        if (en === "0" || en === "false") pollEnabledEl.checked = false;
        else if (en === "1" || en === "true") pollEnabledEl.checked = true;
      }
      const sec = localStorage.getItem(POLL_INTERVAL_SEC_KEY);
      if (pollIntervalSecEl && sec != null) {
        const n = Number(sec);
        if (Number.isFinite(n) && n >= MIN_POLL_SEC && n <= MAX_POLL_SEC) {
          pollIntervalSecEl.value = String(n);
        }
      }
    } catch (e) {
      /* ignore */
    }
    syncPollIntervalDisabled();
  }

  function setMsg(text, type) {
    msg.textContent = text || "";
    msg.className = "status-msg" + (type ? " " + type : "");
  }

  /** Modicon-style reference numbers (1-based documentation addressing) */
  function docAddrLabel(k, abs) {
    switch (k) {
      case "holding":
        return String(40001 + abs);
      case "input":
        return String(30001 + abs);
      case "coil":
        return String(1 + abs).padStart(5, "0");
      case "dinput":
        return String(10001 + abs);
      default:
        return "—";
    }
  }

  function readPath(k, addr, cnt) {
    switch (k) {
      case "holding":
        return `${API}/holding-registers/${addr}/${cnt}`;
      case "input":
        return `${API}/input-registers/${addr}/${cnt}`;
      case "coil":
        return `${API}/discrete-coils/${addr}/${cnt}`;
      case "dinput":
        return `${API}/discrete-inputs/${addr}/${cnt}`;
      default:
        throw new Error("kind");
    }
  }

  function writeOnePath(k, addr, val) {
    if (k === "holding") return `${API}/holding-register/${addr}/${val}`;
    if (k === "input") return `${API}/input-register/${addr}/${val}`;
    if (k === "coil") return `${API}/discrete-coil/${addr}/${val}`;
    if (k === "dinput") return `${API}/discrete-input/${addr}/${val}`;
    throw new Error("kind");
  }

  function batchPath(k, addr) {
    if (k === "holding") return `${API}/holding-registers/${addr}`;
    if (k === "input") return `${API}/input-registers/${addr}`;
    if (k === "coil") return `${API}/discrete-coils/${addr}`;
    if (k === "dinput") return `${API}/discrete-inputs/${addr}`;
    throw new Error("kind");
  }

  function isBoolKind(k) {
    return k === "coil" || k === "dinput";
  }

  function isRegisterKind(k) {
    return k === "holding" || k === "input";
  }

  function combineU32(r0, r1, order) {
    const a = r0 & 0xffff;
    const b = r1 & 0xffff;
    return order === "HL" ? (a << 16) | b : (b << 16) | a;
  }

  function u32ToInt32(u) {
    return (u | 0) >> 0;
  }

  function u32ToFloat32(u) {
    const buf = new ArrayBuffer(4);
    const dv = new DataView(buf);
    dv.setUint32(0, u >>> 0, false);
    return dv.getFloat32(0, false);
  }

  function regsToFloat64(regs, i) {
    const buf = new ArrayBuffer(8);
    const u8 = new Uint8Array(buf);
    for (let j = 0; j < 4; j++) {
      const v = regs[i + j] & 0xffff;
      u8[j * 2] = (v >> 8) & 0xff;
      u8[j * 2 + 1] = v & 0xff;
    }
    return new DataView(buf).getFloat64(0, false);
  }

  /** u32 (битовое представление) → два слова Modbus с порядком HL/LH */
  function u32ToRegs(u32, order) {
    const u = u32 >>> 0;
    const hi = (u >>> 16) & 0xffff;
    const lo = u & 0xffff;
    return order === "HL" ? [hi, lo] : [lo, hi];
  }

  function float32ToRegs(f, order) {
    const buf = new ArrayBuffer(4);
    const dv = new DataView(buf);
    dv.setFloat32(0, f, false);
    return u32ToRegs(dv.getUint32(0, false) >>> 0, order);
  }

  function float64ToRegs(f) {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setFloat64(0, f, false);
    const u8 = new Uint8Array(buf);
    const regs = [];
    for (let j = 0; j < 4; j++) {
      regs.push((u8[j * 2] << 8) | u8[j * 2 + 1]);
    }
    return regs;
  }

  function fmtHexU16(v) {
    return (v & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  }

  /** Текстовое поле float: запятая как десятичный разделитель */
  function parseFloatLocale(s) {
    const t = String(s).trim().replace(/\s/g, "").replace(",", ".");
    if (t === "" || t === "-" || t === "+" || t === ".") return NaN;
    return Number(t);
  }

  function formatFloatCell(f) {
    return Number.isFinite(f) ? String(f) : "";
  }

  function updateAreaHint() {
    const a = Number(addrEl.value) || 0;
    const c = Number(cntEl.value) || 0;
    const end = a + Math.max(0, c - 1);
    const unit = isBoolKind(kind.value) ? t("unit.bit") : t("unit.word");
    let base =
      c > 0
        ? t("area.window", {
            a,
            end,
            c,
            unit,
            docS: docAddrLabel(kind.value, a),
            docE: docAddrLabel(kind.value, end),
          })
        : "";
    if (matrixRowsHint) base += " · " + matrixRowsHint;
    areaHint.textContent = base;
  }

  function finishMatrixRowsHint(totalRowCount) {
    matrixRowsHint =
      totalRowCount > MAX_MATRIX_ROWS
        ? t("area.tableTrunc", {
            shown: MAX_MATRIX_ROWS,
            total: totalRowCount,
          })
        : "";
    updateAreaHint();
  }

  function shiftArea(delta) {
    const step = Number(cntEl.value) || MAX_READ_CNT;
    let a = Number(addrEl.value) || 0;
    a = Math.max(0, Math.min(65534, a + delta * step));
    addrEl.value = String(a);
    updateAreaHint();
    doRead();
  }

  function matrixCols(mode, k) {
    if (isBoolKind(k)) return 16;
    if (!isRegisterKind(k)) return 10;
    if (mode === "bitmask") return 16;
    if (mode === "uint16" || mode === "int16") return 10;
    if (mode === "int32" || mode === "float32") return 5;
    if (mode === "float64") return 2;
    return 10;
  }

  function syncCntLimits() {
    cntEl.max = String(MAX_READ_CNT);
    cntEl.title = t("cnt.title", {
      maxRead: MAX_READ_CNT,
      maxRows: MAX_MATRIX_ROWS,
    });
    let v = Number(cntEl.value);
    if (!Number.isFinite(v) || v < 1) v = 1;
    if (v > MAX_READ_CNT) cntEl.value = String(MAX_READ_CNT);
  }

  function renderMatrixHeader(mode, k) {
    const cols = matrixCols(mode, k);
    theadRow.innerHTML = "";
    const corner = document.createElement("th");
    corner.className = "corner";
    corner.textContent = " ";
    corner.title =
      mode === "bitmask" ? t("th.corner.bitmask") : t("th.corner.row");
    theadRow.appendChild(corner);
    for (let c = 0; c < cols; c++) {
      const th = document.createElement("th");
      th.className = "col-off";
      if (mode === "bitmask") {
        th.textContent = "b" + c;
        th.title = t("th.bitTitle", { n: c });
      } else {
        th.textContent = "+" + c;
        th.title = t("th.offsetTitle");
      }
      theadRow.appendChild(th);
    }
  }

  function syncWordOrderVisibility() {
    const wrap = document.getElementById("wordOrderWrap");
    if (!wrap) return;
    const m = displayMode.value;
    const needWo = m === "int32" || m === "float32";
    wrap.style.display = needWo ? "inline-flex" : "none";
    wrap.style.alignItems = "center";
    wrap.style.gap = "4px";
  }

  function syncRegOptionsVisibility() {
    const reg = isRegisterKind(kind.value);
    regDisplayOpts.style.display = reg ? "flex" : "none";
    renderMatrixHeader(displayMode.value, kind.value);
    syncWordOrderVisibility();
  }

  function thRowLabel(k, rowStart) {
    const th = document.createElement("th");
    th.className = "row-label";
    th.scope = "row";
    th.textContent = String(rowStart);
    th.title = t("row.doc", { doc: docAddrLabel(k, rowStart) });
    return th;
  }

  function tdMatrixEmpty() {
    const td = document.createElement("td");
    td.className = "matrix-cell matrix-cell-empty";
    return td;
  }

  /** Сохранение после правки: change (в т.ч. при blur) и Enter */
  function bindAutoSaveNumber(inp, fn) {
    inp.addEventListener("change", fn);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        inp.blur();
      }
    });
  }

  function syncTabsFromSelect() {
    const v = kind.value;
    document.querySelectorAll(".mfc-tab").forEach((tab) => {
      const on = tab.dataset.kind === v;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  /** Автообновление не трогает ячейку, в которой сейчас ввод (фокус в #grid). */
  function isGridInputFocused() {
    const a = document.activeElement;
    if (!a || typeof a.closest !== "function") return false;
    const grid = document.getElementById("grid");
    if (!grid || !grid.contains(a)) return false;
    if (a.isContentEditable) return true;
    const t = a.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
  }

  async function doRead(silent) {
    if (silent && isGridInputFocused()) {
      return;
    }
    const k = kind.value;
    const addr = Number(addrEl.value);
    const cnt = Number(cntEl.value);
    if (!Number.isFinite(addr) || addr < 0) {
      setMsg(t("msg.badAddress"), "err");
      return;
    }
    if (!Number.isFinite(cnt) || cnt < 1 || cnt > MAX_READ_CNT) {
      setMsg(t("msg.badCount", { max: MAX_READ_CNT }), "err");
      return;
    }
    const mode = displayMode.value;
    const wo = wordOrder32.value;
    if (isRegisterKind(k) && mode === "int32" && cnt % 2 !== 0) {
      setMsg(t("msg.int32even"), "err");
      return;
    }
    if (isRegisterKind(k) && mode === "float32" && cnt % 2 !== 0) {
      setMsg(t("msg.floatEven"), "err");
      return;
    }
    if (isRegisterKind(k) && mode === "float64" && cnt % 4 !== 0) {
      setMsg(t("msg.doubleMul4"), "err");
      return;
    }

    if (!silent) setMsg(t("msg.requesting"));
    try {
      const r = await fetch(readPath(k, addr, cnt));
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      const data = await r.json();
      if (!Array.isArray(data)) {
        setMsg(t("msg.apiNotArray"), "err");
        tbody.innerHTML = "";
        matrixRowsHint = "";
        updateAreaHint();
        return;
      }
      lastRead = {
        kind: k,
        addr,
        values: data.map((x) => Number(x) & 0xffff),
        bools: [],
      };
      if (isBoolKind(k)) {
        lastRead.bools = data.map(Boolean);
      }
      renderTable(mode, wo);
      const unit = isBoolKind(k) ? t("unit.bit") : t("unit.word");
      if (silent) {
        const sec = Math.round(pollIntervalMs() / 1000);
        setMsg(
          t("msg.auto", { sec, n: data.length, unit }),
          "ok"
        );
      } else {
        setMsg(t("msg.done", { n: data.length, unit }), "ok");
      }
    } catch (e) {
      setMsg(String(e.message || e), "err");
      tbody.innerHTML = "";
      matrixRowsHint = "";
      updateAreaHint();
    }
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPolling() {
    stopPolling();
    if (!isPollEnabled()) return;
    pollTimer = setInterval(pollTick, pollIntervalMs());
  }

  async function pollTick() {
    if (readInFlight || document.hidden) return;
    readInFlight = true;
    try {
      await doRead(true);
    } finally {
      readInFlight = false;
    }
  }

  function renderTable(mode, wo) {
    const k = lastRead.kind;
    const start = lastRead.addr;
    tbody.innerHTML = "";
    renderMatrixHeader(mode, k);

    if (isBoolKind(k)) {
      const bools = lastRead.bools;
      const COLS = matrixCols(mode, k);
      const rows = Math.max(1, Math.ceil(bools.length / COLS));
      const rowLimit = Math.min(rows, MAX_MATRIX_ROWS);
      for (let r = 0; r < rowLimit; r++) {
        const tr = document.createElement("tr");
        const rowStart = start + r * COLS;
        tr.appendChild(thRowLabel(k, rowStart));
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          if (i >= bools.length) {
            tr.appendChild(tdMatrixEmpty());
            continue;
          }
          const abs = start + i;
          const td = document.createElement("td");
          td.className = "matrix-cell";
          td.title = docAddrLabel(k, abs) + " · " + abs;
          const wrap = document.createElement("div");
          wrap.className = "cell-stack";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = Boolean(bools[i]);
          cb.addEventListener("change", () =>
            writeOneRow(k, abs, cb, true)
          );
          wrap.appendChild(cb);
          td.appendChild(wrap);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      finishMatrixRowsHint(rows);
      return;
    }

    const regs = lastRead.values;
    const COLS = matrixCols(mode, k);

    if (mode === "uint16") {
      const n = regs.length;
      const rows = Math.max(1, Math.ceil(n / COLS));
      const rowLimit = Math.min(rows, MAX_MATRIX_ROWS);
      for (let r = 0; r < rowLimit; r++) {
        const tr = document.createElement("tr");
        const rowStart = start + r * COLS;
        tr.appendChild(thRowLabel(k, rowStart));
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          if (i >= n) {
            tr.appendChild(tdMatrixEmpty());
            continue;
          }
          const abs = start + i;
          const v = regs[i];
          const td = document.createElement("td");
          td.className = "matrix-cell";
          td.title = docAddrLabel(k, abs) + " · 0x" + fmtHexU16(v);
          const wrap = document.createElement("div");
          wrap.className = "cell-stack";
          const inp = document.createElement("input");
          inp.type = "number";
          inp.min = "0";
          inp.max = "65535";
          inp.value = String(v);
          inp.className = "cell-inp";
          inp.title = "UInt16";
          bindAutoSaveNumber(inp, () =>
            writeOneRow(k, abs, inp, false)
          );
          wrap.appendChild(inp);
          td.appendChild(wrap);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      finishMatrixRowsHint(rows);
      return;
    }

    if (mode === "int16") {
      const n = regs.length;
      const rows = Math.max(1, Math.ceil(n / COLS));
      const rowLimit = Math.min(rows, MAX_MATRIX_ROWS);
      for (let r = 0; r < rowLimit; r++) {
        const tr = document.createElement("tr");
        const rowStart = start + r * COLS;
        tr.appendChild(thRowLabel(k, rowStart));
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          if (i >= n) {
            tr.appendChild(tdMatrixEmpty());
            continue;
          }
          const abs = start + i;
          const v = regs[i];
          const u = v & 0xffff;
          const s = u > 32767 ? u - 65536 : u;
          const td = document.createElement("td");
          td.className = "matrix-cell";
          td.title = docAddrLabel(k, abs) + " · 0x" + fmtHexU16(v);
          const wrap = document.createElement("div");
          wrap.className = "cell-stack";
          const inp = document.createElement("input");
          inp.type = "number";
          inp.min = "-32768";
          inp.max = "32767";
          inp.value = String(s);
          inp.className = "cell-inp";
          inp.title = "Int16";
          bindAutoSaveNumber(inp, () =>
            writeOneRow(k, abs, inp, false, true)
          );
          wrap.appendChild(inp);
          td.appendChild(wrap);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      finishMatrixRowsHint(rows);
      return;
    }

    if (mode === "bitmask") {
      const n = regs.length;
      const rowLimit = Math.min(n, MAX_MATRIX_ROWS);
      for (let r = 0; r < rowLimit; r++) {
        const abs = start + r;
        const word = regs[r] & 0xffff;
        const tr = document.createElement("tr");
        const th = thRowLabel(k, abs);
        th.title =
          docAddrLabel(k, abs) + " · 0x" + fmtHexU16(word) + " · " + word;
        tr.appendChild(th);
        for (let b = 0; b < 16; b++) {
          const td = document.createElement("td");
          td.className = "matrix-cell matrix-bit";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.className = "bit-cb";
          cb.dataset.bit = String(b);
          cb.checked = ((word >> b) & 1) !== 0;
          cb.title = t("cell.bit", {
            doc: docAddrLabel(k, abs),
            b,
          });
          cb.addEventListener("change", () => writeBitmaskRow(k, abs, tr));
          td.appendChild(cb);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      finishMatrixRowsHint(n);
      return;
    }

    if (mode === "int32") {
      if (regs.length % 2 !== 0) {
        errMatrixRow(mode, k, t("msg.matrixOdd"));
        return;
      }
      const nPairs = regs.length / 2;
      const rows = Math.max(1, Math.ceil(nPairs / COLS));
      const rowLimit = Math.min(rows, MAX_MATRIX_ROWS);
      let pairIndex = 0;
      for (let r = 0; r < rowLimit; r++) {
        const tr = document.createElement("tr");
        const rowStart = start + r * COLS * 2;
        tr.appendChild(thRowLabel(k, rowStart));
        for (let c = 0; c < COLS; c++) {
          if (pairIndex >= nPairs) {
            tr.appendChild(tdMatrixEmpty());
            continue;
          }
          const i = pairIndex * 2;
          const abs = start + i;
          const u32 = combineU32(regs[i], regs[i + 1], wo) >>> 0;
          const i32 = u32ToInt32(u32);
          const td = document.createElement("td");
          td.className = "matrix-cell matrix-cell-decoded";
          td.title =
            docAddrLabel(k, abs) +
            "…" +
            docAddrLabel(k, abs + 1) +
            " · 0x" +
            u32.toString(16).toUpperCase().padStart(8, "0");
          const wrap = document.createElement("div");
          wrap.className = "cell-stack cell-stack-decoded";
          const inp = document.createElement("input");
          inp.type = "number";
          inp.step = "1";
          inp.value = String(i32);
          inp.className = "cell-inp cell-inp-wide";
          inp.title = "Int32";
          bindAutoSaveNumber(inp, () =>
            writeDecodedMulti(k, abs, "int32", wo, inp)
          );
          const sub = document.createElement("div");
          sub.className = "cell-ro-sub";
          sub.textContent = abs + "–" + (abs + 1);
          wrap.appendChild(inp);
          td.appendChild(wrap);
          td.appendChild(sub);
          tr.appendChild(td);
          pairIndex++;
        }
        tbody.appendChild(tr);
      }
      finishMatrixRowsHint(rows);
      return;
    }

    if (mode === "float32") {
      if (regs.length % 2 !== 0) {
        errMatrixRow(mode, k, t("msg.matrixFloatOdd"));
        return;
      }
      const nPairs = regs.length / 2;
      const rows = Math.max(1, Math.ceil(nPairs / COLS));
      const rowLimit = Math.min(rows, MAX_MATRIX_ROWS);
      let pairIndex = 0;
      for (let r = 0; r < rowLimit; r++) {
        const tr = document.createElement("tr");
        const rowStart = start + r * COLS * 2;
        tr.appendChild(thRowLabel(k, rowStart));
        for (let c = 0; c < COLS; c++) {
          if (pairIndex >= nPairs) {
            tr.appendChild(tdMatrixEmpty());
            continue;
          }
          const i = pairIndex * 2;
          const abs = start + i;
          const u32 = combineU32(regs[i], regs[i + 1], wo) >>> 0;
          const f = u32ToFloat32(u32);
          const td = document.createElement("td");
          td.className = "matrix-cell matrix-cell-decoded";
          td.title =
            docAddrLabel(k, abs) +
            "…" +
            docAddrLabel(k, abs + 1) +
            " · 0x" +
            u32.toString(16).toUpperCase().padStart(8, "0");
          const wrap = document.createElement("div");
          wrap.className = "cell-stack cell-stack-decoded";
          const inp = document.createElement("input");
          inp.type = "text";
          inp.inputMode = "decimal";
          inp.autocomplete = "off";
          inp.spellcheck = false;
          inp.value = formatFloatCell(f);
          inp.className = "cell-inp cell-inp-wide cell-inp-float";
          inp.title = t("inp.float32Title");
          bindAutoSaveNumber(inp, () =>
            writeDecodedMulti(k, abs, "float32", wo, inp)
          );
          const sub = document.createElement("div");
          sub.className = "cell-ro-sub";
          sub.textContent = abs + "–" + (abs + 1);
          wrap.appendChild(inp);
          td.appendChild(wrap);
          td.appendChild(sub);
          tr.appendChild(td);
          pairIndex++;
        }
        tbody.appendChild(tr);
      }
      finishMatrixRowsHint(rows);
      return;
    }

    if (mode === "float64") {
      if (regs.length % 4 !== 0) {
        errMatrixRow(mode, k, t("msg.matrixDoubleMul4"));
        return;
      }
      const nQuads = regs.length / 4;
      const rows = Math.max(1, Math.ceil(nQuads / COLS));
      const rowLimit = Math.min(rows, MAX_MATRIX_ROWS);
      let quadIndex = 0;
      for (let r = 0; r < rowLimit; r++) {
        const tr = document.createElement("tr");
        const rowStart = start + r * COLS * 4;
        tr.appendChild(thRowLabel(k, rowStart));
        for (let c = 0; c < COLS; c++) {
          if (quadIndex >= nQuads) {
            tr.appendChild(tdMatrixEmpty());
            continue;
          }
          const i = quadIndex * 4;
          const abs = start + i;
          const f = regsToFloat64(regs, i);
          const td = document.createElement("td");
          td.className = "matrix-cell matrix-cell-decoded";
          td.title =
            docAddrLabel(k, abs) +
            "…" +
            docAddrLabel(k, abs + 3) +
            " · " +
            regs.slice(i, i + 4).map(fmtHexU16).join(" ");
          const wrap = document.createElement("div");
          wrap.className = "cell-stack cell-stack-decoded";
          const inp = document.createElement("input");
          inp.type = "text";
          inp.inputMode = "decimal";
          inp.autocomplete = "off";
          inp.spellcheck = false;
          inp.value = formatFloatCell(f);
          inp.className = "cell-inp cell-inp-float64 cell-inp-float";
          inp.title = t("inp.float64Title");
          bindAutoSaveNumber(inp, () =>
            writeDecodedMulti(k, abs, "float64", wo, inp)
          );
          const sub = document.createElement("div");
          sub.className = "cell-ro-sub";
          sub.textContent = abs + "–" + (abs + 3);
          wrap.appendChild(inp);
          td.appendChild(wrap);
          td.appendChild(sub);
          tr.appendChild(td);
          quadIndex++;
        }
        tbody.appendChild(tr);
      }
      finishMatrixRowsHint(rows);
    }
  }

  function errMatrixRow(mode, k, text) {
    matrixRowsHint = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = matrixCols(mode, k) + 1;
    td.className = "status-msg err matrix-err";
    td.textContent = text;
    tr.appendChild(td);
    tbody.appendChild(tr);
    updateAreaHint();
  }

  async function writeBitmaskRow(k, abs, tr) {
    let v = 0;
    tr.querySelectorAll("input.bit-cb[type=checkbox]").forEach((cb) => {
      const b = Number(cb.dataset.bit);
      if (!Number.isFinite(b) || b < 0 || b > 15) return;
      if (cb.checked) v |= 1 << b;
    });
    v &= 0xffff;
    setMsg(t("msg.writing"));
    try {
      const r = await fetch(writeOnePath(k, abs, v), { method: "POST" });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      setMsg(
        t("msg.written", {
          addr: docAddrLabel(k, abs),
          hex: fmtHexU16(v),
        }),
        "ok"
      );
      await doRead();
    } catch (e) {
      setMsg(String(e.message || e), "err");
    }
  }

  async function writeDecodedMulti(k, abs, mode, wo, inputEl) {
    const raw = String(inputEl.value).trim();
    let words;
    if (mode === "int32") {
      const n = Number(raw);
      if (
        !Number.isFinite(n) ||
        !Number.isInteger(n) ||
        n < -2147483648 ||
        n > 2147483647
      ) {
        setMsg(t("msg.int32Range"), "err");
        return;
      }
      const u32 = n >>> 0;
      words = u32ToRegs(u32, wo);
    } else if (mode === "float32") {
      const n = parseFloatLocale(raw);
      if (!Number.isFinite(n)) {
        setMsg(t("msg.badFloat"), "err");
        return;
      }
      words = float32ToRegs(n, wo);
    } else if (mode === "float64") {
      const n = parseFloatLocale(raw);
      if (!Number.isFinite(n)) {
        setMsg(t("msg.badDouble"), "err");
        return;
      }
      words = float64ToRegs(n);
    } else {
      return;
    }
    setMsg(t("msg.writing"));
    try {
      const r = await fetch(batchPath(k, abs), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: words }),
      });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      const span =
        words.length === 2
          ? docAddrLabel(k, abs) + "…" + docAddrLabel(k, abs + 1)
          : docAddrLabel(k, abs) + "…" + docAddrLabel(k, abs + 3);
      setMsg(t("msg.writtenSpan", { span }), "ok");
      await doRead();
    } catch (e) {
      setMsg(String(e.message || e), "err");
    }
  }

  async function writeOneRow(k, abs, inputEl, isBool, int16Mode) {
    let val;
    if (isBool) {
      val = inputEl.checked;
    } else {
      let n = Number(inputEl.value);
      if (!Number.isFinite(n)) {
        setMsg(t("msg.badNumber"), "err");
        return;
      }
      if (int16Mode) {
        if (n < -32768 || n > 32767) {
          setMsg(t("msg.int16Range"), "err");
          return;
        }
        val = n < 0 ? n + 65536 : n;
      } else {
        if (n < 0 || n > 65535 || !Number.isInteger(n)) {
          setMsg(t("msg.uint16Range"), "err");
          return;
        }
        val = n;
      }
    }
    setMsg(t("msg.writing"));
    try {
      const r = await fetch(writeOnePath(k, abs, val), { method: "POST" });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      setMsg(t("msg.writtenAddr", { addr: docAddrLabel(k, abs) }), "ok");
      await doRead();
    } catch (e) {
      setMsg(String(e.message || e), "err");
    }
  }

  document.querySelectorAll(".mfc-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      kind.value = tab.dataset.kind;
      syncTabsFromSelect();
      kind.dispatchEvent(new Event("change"));
    });
  });

  btnRead.addEventListener("click", doRead);
  btnPrev.addEventListener("click", () => shiftArea(-1));
  btnNext.addEventListener("click", () => shiftArea(1));

  addrEl.addEventListener("input", updateAreaHint);
  cntEl.addEventListener("input", () => {
    syncCntLimits();
    updateAreaHint();
  });

  kind.addEventListener("change", () => {
    tbody.innerHTML = "";
    setMsg("");
    syncCntLimits();
    syncTabsFromSelect();
    syncRegOptionsVisibility();
    doRead();
  });

  displayMode.addEventListener("change", () => {
    syncWordOrderVisibility();
    if (!isRegisterKind(kind.value)) return;
    if (lastRead.values.length) {
      renderTable(displayMode.value, wordOrder32.value);
    } else {
      matrixRowsHint = "";
      renderMatrixHeader(displayMode.value, kind.value);
      tbody.innerHTML = "";
      updateAreaHint();
    }
  });

  wordOrder32.addEventListener("change", () => {
    if (isRegisterKind(kind.value) && lastRead.values.length) {
      renderTable(displayMode.value, wordOrder32.value);
    }
  });

  syncTabsFromSelect();
  syncCntLimits();
  syncRegOptionsVisibility();
  syncWordOrderVisibility();
  loadPollSettings();
  updateAreaHint();
  doRead(false).then(() => {
    if (isPollEnabled()) startPolling();
  });

  if (pollEnabledEl) {
    pollEnabledEl.addEventListener("change", () => {
      try {
        localStorage.setItem(POLL_ENABLED_KEY, pollEnabledEl.checked ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
      syncPollIntervalDisabled();
      if (pollEnabledEl.checked) {
        doRead(true).then(() => startPolling());
      } else {
        stopPolling();
      }
    });
  }

  if (pollIntervalSecEl) {
    pollIntervalSecEl.addEventListener("change", () => {
      clampPollIntervalInput();
      try {
        localStorage.setItem(POLL_INTERVAL_SEC_KEY, pollIntervalSecEl.value);
      } catch (e) {
        /* ignore */
      }
      if (isPollEnabled()) startPolling();
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopPolling();
    } else if (isPollEnabled()) {
      doRead(true).then(() => startPolling());
    }
  });

  window.addEventListener("beforeunload", stopPolling);

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    const THEME_KEY = "apcs-ui-theme";
    themeToggle.addEventListener("click", () => {
      const cur =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "dark"
          : "light";
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* ignore */
      }
    });
  }

  /** Порт MCP на стороне браузера: ?mcpPort=8081 или по умолчанию 18081 (Docker 18081:8081). */
  function getMcpPublicPort() {
    try {
      const q = new URLSearchParams(window.location.search).get("mcpPort");
      if (q !== null && /^\d{1,5}$/.test(q)) {
        const n = Number(q);
        if (n >= 0 && n <= 65535) return String(n);
      }
    } catch (e) {
      /* ignore */
    }
    return "18081";
  }

  function getMcpPublicHost() {
    const h = window.location.hostname;
    return h && h.length > 0 ? h : "127.0.0.1";
  }

  function getMcpUrlForConfig() {
    return (
      "http://" + getMcpPublicHost() + ":" + getMcpPublicPort() + "/mcp"
    );
  }

  function formatMcpJsonExample() {
    return JSON.stringify(
      { mcpServers: { "modbus-tcp-sim": { url: getMcpUrlForConfig() } } },
      null,
      2
    );
  }

  function refreshMcpCursorConfigPreview() {
    const el = document.getElementById("mcpCursorConfigCode");
    if (el) {
      el.textContent = formatMcpJsonExample();
    }
  }

  function updateMcpUrlLine() {
    const el = document.getElementById("mcpAiUrlLine");
    if (!el) return;
    const u = getMcpUrlForConfig();
    const p = getMcpPublicPort();
    const safe = u.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    el.innerHTML = t("mcp.urlLine", {
      url: safe,
      host: getMcpPublicHost().replace(/</g, "&lt;"),
      port: p,
    });
  }

  const mcpAiBtn = document.getElementById("mcpAiBtn");
  const mcpAiPanel = document.getElementById("mcpAiPanel");
  const mcpAiClose = document.getElementById("mcpAiClose");
  const mcpConfigDownload = document.getElementById("mcpConfigDownload");
  const mcpCursorConfigCode = document.getElementById("mcpCursorConfigCode");
  const mcpAiWrap = mcpAiBtn ? mcpAiBtn.closest(".mcp-ai-wrap") : null;

  let mcpPanelPosRaf = null;

  /* Вынести панель из .mfc-window: иначе backdrop-filter у предка ломает position:fixed (обрезка). */
  if (mcpAiPanel && mcpAiPanel.parentNode) {
    document.body.appendChild(mcpAiPanel);
  }

  function viewportHeight() {
    if (window.visualViewport && window.visualViewport.height) {
      return window.visualViewport.height;
    }
    return window.innerHeight;
  }

  /** fixed относительно окна просмотра; координаты от кнопки AI */
  function syncMcpPanelPosition() {
    if (!mcpAiPanel || !mcpAiBtn || mcpAiPanel.hidden) return;
    const br = mcpAiBtn.getBoundingClientRect();
    const gap = 8;
    const pad = 12;
    mcpAiPanel.style.position = "fixed";
    mcpAiPanel.style.left = "auto";
    mcpAiPanel.style.right =
      Math.max(pad, document.documentElement.clientWidth - br.right) + "px";
    const top = br.bottom + gap;
    mcpAiPanel.style.top = top + "px";
    const vh = viewportHeight();
    const available = vh - top - pad;
    mcpAiPanel.style.maxHeight = Math.max(240, available) + "px";
  }

  function scheduleMcpPanelPosition() {
    if (!mcpAiPanel || mcpAiPanel.hidden) return;
    if (mcpPanelPosRaf !== null) {
      cancelAnimationFrame(mcpPanelPosRaf);
    }
    mcpPanelPosRaf = requestAnimationFrame(() => {
      mcpPanelPosRaf = null;
      syncMcpPanelPosition();
    });
  }

  refreshMcpCursorConfigPreview();
  updateMcpUrlLine();

  function setMcpPanelOpen(open) {
    if (!mcpAiPanel || !mcpAiBtn) return;
    mcpAiPanel.hidden = !open;
    mcpAiBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      refreshMcpCursorConfigPreview();
      updateMcpUrlLine();
      requestAnimationFrame(() => {
        syncMcpPanelPosition();
        requestAnimationFrame(syncMcpPanelPosition);
      });
    }
  }

  function closeMcpPanel() {
    setMcpPanelOpen(false);
  }

  if (mcpAiBtn && mcpAiPanel && mcpAiWrap) {
    mcpAiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setMcpPanelOpen(mcpAiPanel.hidden);
    });
    if (mcpAiClose) {
      mcpAiClose.addEventListener("click", () => closeMcpPanel());
    }
    if (mcpConfigDownload && mcpCursorConfigCode) {
      mcpConfigDownload.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = mcpCursorConfigCode.textContent || "";
        const blob = new Blob([text], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mcp.json";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !mcpAiPanel.hidden) {
        closeMcpPanel();
      }
    });
    document.addEventListener("click", (e) => {
      if (mcpAiPanel.hidden) return;
      const t = e.target;
      if (mcpAiWrap.contains(t) || mcpAiPanel.contains(t)) return;
      closeMcpPanel();
    });
    window.addEventListener("resize", scheduleMcpPanelPosition);
    window.addEventListener("scroll", scheduleMcpPanelPosition, true);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleMcpPanelPosition);
      window.visualViewport.addEventListener("scroll", scheduleMcpPanelPosition);
    }
  }

  window.addEventListener("apcs-lang-change", function () {
    document.title = t("app.title");
    syncCntLimits();
    if (addrEl) addrEl.title = t("addr.title");
    if (pollIntervalSecEl) {
      pollIntervalSecEl.title = t("pollInterval.title");
      pollIntervalSecEl.setAttribute("aria-label", t("pollInterval.aria"));
    }
    updateAreaHint();
    updateMcpUrlLine();
    const k = kind.value;
    if (lastRead.values && lastRead.values.length) {
      renderTable(displayMode.value, wordOrder32.value);
    } else {
      renderMatrixHeader(displayMode.value, k);
      syncWordOrderVisibility();
    }
  });
})();
