/**
 * Address map panel: named Modbus points with live values.
 */
(function () {
  const STORAGE_KEY = "apcs-variable-map";
  const POLL_ENABLED_KEY = "apcs-varmap-poll-enabled";
  const VAR_MAP_API = "/api/v1/var-map";

  let ctx = null;
  let variables = [];
  let pollTimer = null;
  let refreshInFlight = false;
  let refreshPending = null;
  let saveTimer = null;
  let saveInFlight = false;
  let writeInFlight = new Set();

  function app() {
    return window.APCS_APP || {};
  }

  function t(key, params) {
    return ctx && ctx.t ? ctx.t(key, params) : key;
  }

  function nextId() {
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function typeWordCount(type) {
    if (type === "int32" || type === "float32") return 2;
    if (type === "float64" || type === "int64") return 4;
    return 1;
  }

  function needsWordOrder(type) {
    return type === "int32" || type === "float32";
  }

  function needsBitIndex(type) {
    return type === "bit";
  }

  function defaultVariable() {
    return {
      id: nextId(),
      name: "",
      kind: "holding",
      addr: 0,
      type: "uint16",
      bit: 0,
      order: "HL",
    };
  }

  function normalizeRow(row) {
    return {
      id: row.id || nextId(),
      name: String(row.name || ""),
      kind: row.kind || "holding",
      addr: Math.max(0, Math.min(65535, Number(row.addr) || 0)),
      type: row.type || "uint16",
      bit: Math.max(0, Math.min(15, Number(row.bit) || 0)),
      order: row.order === "LH" ? "LH" : "HL",
    };
  }

  function loadVariablesFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizeRow)
        .filter(function (row) {
          return (
            row.kind === "holding" ||
            row.kind === "input" ||
            row.kind === "coil" ||
            row.kind === "dinput"
          );
        });
    } catch (e) {
      return [];
    }
  }

  async function loadVariablesFromServer() {
    const r = await fetch(VAR_MAP_API);
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    const list = Array.isArray(data.variables) ? data.variables : [];
    return list
      .map(normalizeRow)
      .filter(function (row) {
        return (
          row.kind === "holding" ||
          row.kind === "input" ||
          row.kind === "coil" ||
          row.kind === "dinput"
        );
      });
  }

  async function loadVariables() {
    try {
      const fromServer = await loadVariablesFromServer();
      if (fromServer.length > 0) return fromServer;
      const legacy = loadVariablesFromLocalStorage();
      if (legacy.length > 0) {
        variables = legacy;
        await saveVariablesToServer(true);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
          /* ignore */
        }
        return legacy;
      }
      return [];
    } catch (e) {
      return loadVariablesFromLocalStorage();
    }
  }

  async function saveVariablesToServer(silent) {
    if (saveInFlight) return;
    saveInFlight = true;
    const statusEl = document.getElementById("varMapStatus");
    try {
      const r = await fetch(VAR_MAP_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, variables: variables }),
      });
      if (!r.ok) throw new Error(String(r.status));
      if (!silent && statusEl) {
        statusEl.textContent = t("varmap.msg.saved");
      }
    } catch (e) {
      if (!silent && statusEl) {
        statusEl.textContent = t("varmap.msg.saveFailed");
      }
      if (!silent && ctx && ctx.setMsg) {
        ctx.setMsg(t("varmap.msg.saveFailed"), "err");
      }
    } finally {
      saveInFlight = false;
    }
  }

  function saveVariables() {
    scheduleSave();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveVariablesToServer(true);
    }, 250);
  }

  async function exportVarMap() {
    if (!ctx) return;
    if (ctx.setMsg) ctx.setMsg(t("varmap.msg.reading"));
    try {
      if (window.APCS_FILE_SAVE && window.APCS_FILE_SAVE.downloadUrl) {
        await window.APCS_FILE_SAVE.downloadUrl(
          VAR_MAP_API + "/export-file",
          "modbus-var-map.json"
        );
      } else {
        throw new Error("download unavailable");
      }
      const n = variables.length;
      if (ctx.setMsg) {
        ctx.setMsg(t("varmap.msg.exported", { n: n }), "ok");
      }
    } catch (e) {
      if (ctx.setMsg) ctx.setMsg(String(e.message || e), "err");
    }
  }

  function parseVarMapPayload(parsed) {
    if (parsed && parsed.varMap && Array.isArray(parsed.varMap.variables)) {
      return {
        version: parsed.varMap.version || 1,
        variables: parsed.varMap.variables,
      };
    }
    if (parsed && Array.isArray(parsed.variables)) {
      return { version: parsed.version || 1, variables: parsed.variables };
    }
    return null;
  }

  async function importVarMap(file) {
    if (!ctx || !file) return;
    if (ctx.setMsg) ctx.setMsg(t("varmap.msg.reading"));
    try {
      const parsed = JSON.parse(await file.text());
      const payload = parseVarMapPayload(parsed);
      if (!payload) throw new Error(t("varmap.msg.badImport"));
      let mode = "merge";
      if (variables.length > 0) {
        mode = window.confirm(t("varmap.importReplaceConfirm")) ? "replace" : "merge";
      }
      const r = await fetch(VAR_MAP_API + "/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: payload.version,
          variables: payload.variables,
          mode: mode,
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      variables = await loadVariables();
      renderTable();
      refreshValues(true);
      if (ctx.setMsg) {
        ctx.setMsg(t("varmap.msg.imported", { n: j.imported || 0 }), "ok");
      }
    } catch (e) {
      if (ctx.setMsg) ctx.setMsg(String(e.message || e), "err");
    }
  }

  async function reloadFromServer() {
    variables = await loadVariables();
    renderTable();
    refreshValues(true);
  }

  function regsToInt64(regs, i) {
    const buf = new ArrayBuffer(8);
    const u8 = new Uint8Array(buf);
    for (let j = 0; j < 4; j++) {
      const v = regs[i + j] & 0xffff;
      u8[j * 2] = (v >> 8) & 0xff;
      u8[j * 2 + 1] = v & 0xff;
    }
    const dv = new DataView(buf);
    if (typeof BigInt !== "undefined") {
      return dv.getBigInt64(0, false).toString();
    }
    const hi = dv.getInt32(0, false);
    const lo = dv.getUint32(4, false);
    if (hi >= 0 && hi <= 0x1fffff) return String(hi * 0x100000000 + lo);
    const twos = (hi * 0x100000000 + lo) >>> 0;
    if (twos <= 0x7fffffff) return String(twos);
    return String(twos - 0x100000000);
  }

  function formatFloatDisplay(f) {
    if (Number.isNaN(f)) return "NaN";
    if (f === Infinity) return "Infinity";
    if (f === -Infinity) return "-Infinity";
    return f.toFixed(4);
  }

  function decodeVariableValue(row, raw) {
    const c = ctx;
    if (row.type === "bool" || row.type === "bit") {
      if (row.type === "bit") {
        const bit = Number(row.bit) || 0;
        const word = Number(raw[0]) & 0xffff;
        return (word >> bit) & 1 ? t("varmap.val.true") : t("varmap.val.false");
      }
      return raw[0] ? t("varmap.val.true") : t("varmap.val.false");
    }
    const words = raw.map(function (x) {
      return Number(x) & 0xffff;
    });
    if (row.type === "uint16") return String(words[0]);
    if (row.type === "int16") return String((words[0] << 16) >> 16);
    if (row.type === "int32") {
      const u = c.combineU32(words[0], words[1], row.order);
      return String(c.u32ToInt32(u));
    }
    if (row.type === "float32") {
      const u = c.combineU32(words[0], words[1], row.order);
      const f = c.u32ToFloat32(u);
      return formatFloatDisplay(f);
    }
    if (row.type === "float64") {
      const f = c.regsToFloat64(words, 0);
      return formatFloatDisplay(f);
    }
    if (row.type === "int64") return regsToInt64(words, 0);
    return String(words[0]);
  }

  function isValueType(row) {
    return row.type === "bool" || row.type === "bit";
  }

  function buildValueEditorHtml(row) {
    const label = escapeAttr(row.name || t("varmap.col.value"));
    const title = escapeAttr(t("varmap.col.valueTitle"));
    if (isValueType(row)) {
      return (
        '<input type="checkbox" class="varmap-inp-value-bool" data-id="' +
        row.id +
        '" data-field="value" aria-label="' +
        label +
        '" title="' +
        title +
        '" />'
      );
    }
    return (
      '<input type="text" class="varmap-inp varmap-inp-value" data-id="' +
      row.id +
      '" data-field="value" spellcheck="false" aria-label="' +
      label +
      '" title="' +
      title +
      '" />'
    );
  }

  function valueEditorSelector(id) {
    return (
      '.varmap-inp-value[data-id="' +
      id +
      '"], .varmap-inp-value-bool[data-id="' +
      id +
      '"]'
    );
  }

  function isValueCellBusy(id) {
    if (writeInFlight.has(id)) return true;
    const el = document.querySelector(valueEditorSelector(id));
    return el && document.activeElement === el;
  }

  async function readVariableRaw(row) {
    const c = ctx;
    const cnt = typeWordCount(row.type);
    const addr = row.addr;
    if (addr > c.getMaxModbusAddress()) throw new Error("addr");
    if (addr + cnt - 1 > c.getMaxModbusAddress()) throw new Error("range");
    if (row.type === "bool" && !c.isBoolKind(row.kind)) throw new Error("kind");
    if (row.type === "bit" && c.isBoolKind(row.kind)) throw new Error("kind");
    if (row.type !== "bool" && row.type !== "bit" && c.isBoolKind(row.kind)) {
      throw new Error("kind");
    }
    const r = await fetch(c.readPath(row.kind, addr, cnt));
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    if (!Array.isArray(data) || data.length < cnt) throw new Error("data");
    return data;
  }

  function readErrorHint(err) {
    const msg = err && err.message ? String(err.message) : "";
    if (msg === "addr") return t("varmap.msg.err.addr");
    if (msg === "range") return t("varmap.msg.err.range");
    if (msg === "kind") return t("varmap.msg.err.kind");
    if (msg === "data") return t("varmap.msg.err.data");
    if (/^\d+$/.test(msg)) return t("varmap.msg.err.http", { status: msg });
    return t("varmap.msg.err.unknown");
  }

  function int64ToRegs(text) {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    const trimmed = String(text).trim();
    if (typeof BigInt !== "undefined") {
      dv.setBigInt64(0, BigInt(trimmed), false);
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new Error("badValue");
      }
      const hi = Math.floor(n / 0x100000000);
      const lo = n % 0x100000000;
      dv.setInt32(0, hi, false);
      dv.setUint32(4, lo >>> 0, false);
    }
    const u8 = new Uint8Array(buf);
    const regs = [];
    for (let j = 0; j < 4; j++) {
      regs.push((u8[j * 2] << 8) | u8[j * 2 + 1]);
    }
    return regs;
  }

  function encodeVariableWords(row, rawInput) {
    const a = app();
    if (row.type === "uint16") {
      const n = Number(String(rawInput).trim());
      if (!Number.isFinite(n) || n < 0 || n > 65535 || !Number.isInteger(n)) {
        throw new Error("badValue");
      }
      return [n & 0xffff];
    }
    if (row.type === "int16") {
      const n = Number(String(rawInput).trim());
      if (!Number.isFinite(n) || n < -32768 || n > 32767 || !Number.isInteger(n)) {
        throw new Error("badValue");
      }
      return [n & 0xffff];
    }
    if (row.type === "int32") {
      const n = Number(String(rawInput).trim());
      if (
        !Number.isFinite(n) ||
        !Number.isInteger(n) ||
        n < -2147483648 ||
        n > 2147483647
      ) {
        throw new Error("badValue");
      }
      return a.u32ToRegs(n >>> 0, row.order);
    }
    if (row.type === "float32") {
      const n = a.parseFloatLocale(String(rawInput));
      if (!Number.isFinite(n)) throw new Error("badValue");
      return a.float32ToRegs(n, row.order);
    }
    if (row.type === "float64") {
      const n = a.parseFloatLocale(String(rawInput));
      if (!Number.isFinite(n)) throw new Error("badValue");
      return a.float64ToRegs(n);
    }
    if (row.type === "int64") {
      return int64ToRegs(rawInput);
    }
    throw new Error("badValue");
  }

  async function postWriteWords(row, words) {
    const a = app();
    if (words.length === 1 && row.type !== "float64" && row.type !== "int64") {
      const val = words[0];
      if (row.type === "bool" && ctx.isBoolKind(row.kind)) {
        const r = await fetch(a.writeOnePath(row.kind, row.addr, !!val), {
          method: "POST",
        });
        if (!r.ok) throw new Error(String(r.status));
        return;
      }
      const r = await fetch(a.writeOnePath(row.kind, row.addr, val & 0xffff), {
        method: "POST",
      });
      if (!r.ok) throw new Error(String(r.status));
      return;
    }
    const r = await fetch(a.batchPath(row.kind, row.addr), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: words }),
    });
    if (!r.ok) throw new Error(String(r.status));
  }

  async function writeVariableBool(row, checked) {
    if (row.type === "bit") {
      const raw = await readVariableRaw(row);
      const word = Number(raw[0]) & 0xffff;
      const bit = Number(row.bit) || 0;
      const newWord = checked
        ? word | (1 << bit)
        : word & ~(1 << bit);
      await postWriteWords(row, [newWord & 0xffff]);
      return;
    }
    await postWriteWords(row, [checked ? 1 : 0]);
  }

  async function writeVariableFromEditor(row, el) {
    writeInFlight.add(row.id);
    const statusEl = document.getElementById("varMapStatus");
    if (statusEl) statusEl.textContent = t("varmap.msg.writing");
    try {
      if (isValueType(row)) {
        await writeVariableBool(row, !!el.checked);
      } else {
        const words = encodeVariableWords(row, el.value);
        await postWriteWords(row, words);
      }
      const raw = await readVariableRaw(row);
      applyRawToValueCell(row, raw, false);
      if (ctx && ctx.setMsg) {
        ctx.setMsg(t("varmap.msg.written", { name: row.name }), "ok");
      }
      if (statusEl) {
        statusEl.textContent = t("varmap.msg.written", { name: row.name });
      }
    } finally {
      writeInFlight.delete(row.id);
    }
  }

  function applyRawToValueCell(row, raw, err, hint) {
    if (isValueCellBusy(row.id)) return;
    const cb = document.querySelector(
      '.varmap-inp-value-bool[data-id="' + row.id + '"]'
    );
    const inp = document.querySelector(
      '.varmap-inp-value[data-id="' + row.id + '"]'
    );
    if (cb) {
      if (err) {
        cb.classList.add("varmap-value-err");
        cb.title = hint || readErrorHint({ message: "unknown" });
        return;
      }
      cb.classList.remove("varmap-value-err");
      cb.title = t("varmap.col.valueTitle");
      if (row.type === "bit") {
        const word = Number(raw[0]) & 0xffff;
        const bit = Number(row.bit) || 0;
        cb.checked = ((word >> bit) & 1) === 1;
      } else {
        cb.checked = !!raw[0];
      }
      return;
    }
    if (!inp) return;
    if (err) {
      inp.value = "";
      inp.placeholder = "—";
      inp.classList.add("varmap-value-err");
      inp.title = hint || readErrorHint({ message: "unknown" });
      return;
    }
    inp.classList.remove("varmap-value-err");
    inp.title = t("varmap.col.valueTitle");
    inp.placeholder = "";
    inp.value = decodeVariableValue(row, raw);
    inp.dataset.committed = inp.value;
  }

  function isUserEditingVarMap() {
    const body = document.getElementById("varMapBody");
    if (!body) return false;
    const el = document.activeElement;
    if (!el || !body.contains(el)) return false;
    return el.matches("input, select, textarea, button.varmap-del");
  }

  function flushQueuedRefresh() {
    if (!refreshPending) return;
    const silent = refreshPending.silent;
    refreshPending = null;
    refreshValues(silent);
  }

  function bindRowEditGuard(body) {
    body.addEventListener("focusout", function () {
      setTimeout(function () {
        if (!isUserEditingVarMap()) {
          flushQueuedRefresh();
        }
      }, 0);
    });
  }

  function formatRefreshStatus(ok, fail, time) {
    const summary =
      fail > 0
        ? t("varmap.msg.updatedWithErr", { ok: ok, fail: fail })
        : t("varmap.msg.updatedAllOk", { ok: ok });
    return t("varmap.msg.updated", { summary: summary, time: time });
  }

  async function readVariableValue(row) {
    const raw = await readVariableRaw(row);
    return decodeVariableValue(row, raw);
  }

  async function refreshValues(silent) {
    if (!ctx || refreshInFlight) return;
    if (isUserEditingVarMap()) {
      refreshPending = { silent: !!silent };
      return;
    }
    refreshInFlight = true;
    const statusEl = document.getElementById("varMapStatus");
    if (!silent && statusEl) statusEl.textContent = t("varmap.msg.reading");
    let ok = 0;
    let fail = 0;
    try {
      for (let i = 0; i < variables.length; i++) {
        const row = variables[i];
        try {
          const raw = await readVariableRaw(row);
          applyRawToValueCell(row, raw, false);
          ok += 1;
        } catch (e) {
          applyRawToValueCell(row, [], true, readErrorHint(e));
          fail += 1;
        }
      }
      if (statusEl) {
        const ts = new Date().toLocaleTimeString();
        statusEl.textContent = formatRefreshStatus(ok, fail, ts);
        statusEl.title =
          fail > 0
            ? t("varmap.msg.done", { ok: ok, fail: fail })
            : "";
      }
      if (!silent && ctx.setMsg) {
        ctx.setMsg(t("varmap.msg.done", { ok: ok, fail: fail }), fail ? "err" : "ok");
      }
    } finally {
      refreshInFlight = false;
    }
  }

  function isPollEnabled() {
    const el = document.getElementById("varMapPollEnabled");
    if (!el) return true;
    return el.checked;
  }

  function loadPollSetting() {
    const el = document.getElementById("varMapPollEnabled");
    if (!el) return;
    try {
      const v = localStorage.getItem(POLL_ENABLED_KEY);
      if (v === "0" || v === "false") el.checked = false;
      else if (v === "1" || v === "true") el.checked = true;
    } catch (e) {
      /* ignore */
    }
  }

  function pollIntervalMs() {
    return ctx && ctx.pollIntervalMs ? ctx.pollIntervalMs() : 1000;
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
    pollTimer = setInterval(function () {
      if (document.hidden || !ctx || !ctx.isActive()) return;
      refreshValues(true);
    }, pollIntervalMs());
  }

  function kindOptions(selected) {
    const kinds = ["holding", "input", "coil", "dinput"];
    return kinds
      .map(function (k) {
        const label = t("varmap.kind." + k);
        const sel = k === selected ? " selected" : "";
        return (
          '<option value="' +
          k +
          '"' +
          sel +
          ">" +
          label +
          "</option>"
        );
      })
      .join("");
  }

  function typeOptions(selected, kind) {
    const boolOnly = kind === "coil" || kind === "dinput";
    const types = boolOnly
      ? ["bool"]
      : ["uint16", "int16", "bit", "int32", "float32", "float64", "int64"];
    return types
      .map(function (tp) {
        const label = t("varmap.type." + tp);
        const sel = tp === selected ? " selected" : "";
        return (
          '<option value="' +
          tp +
          '"' +
          sel +
          ">" +
          label +
          "</option>"
        );
      })
      .join("");
  }

  function metricSlot(active, content) {
    return (
      '<div class="varmap-slot' +
      (active ? " varmap-slot-active" : " varmap-slot-empty") +
      '">' +
      content +
      "</div>"
    );
  }

  function buildRowHtml(row) {
    const showOrder = needsWordOrder(row.type);
    const showBit = needsBitIndex(row.type);
    return (
      '<td class="varmap-cell-name">' +
      '<input type="text" class="varmap-inp varmap-inp-name" data-field="name" value="' +
      escapeAttr(row.name) +
      '" placeholder="' +
      escapeAttr(t("varmap.placeholder.name")) +
      '" />' +
      "</td>" +
      '<td class="varmap-cell-kind">' +
      '<select class="varmap-inp" data-field="kind">' +
      kindOptions(row.kind) +
      "</select></td>" +
      '<td class="varmap-cell-addr">' +
      '<input type="number" class="varmap-inp varmap-inp-addr" data-field="addr" min="0" max="65535" value="' +
      row.addr +
      '" /></td>' +
      '<td class="varmap-cell-type">' +
      '<select class="varmap-inp" data-field="type">' +
      typeOptions(row.type, row.kind) +
      "</select></td>" +
      '<td class="varmap-cell-bit">' +
      metricSlot(
        showBit,
        showBit
          ? '<input type="number" class="varmap-inp varmap-inp-bit" data-field="bit" min="0" max="15" value="' +
            (row.bit != null ? row.bit : 0) +
            '" title="' +
            escapeAttr(t("varmap.col.bitTitle")) +
            '" />'
          : "—"
      ) +
      "</td>" +
      '<td class="varmap-cell-order">' +
      metricSlot(
        showOrder,
        showOrder
          ? '<select class="varmap-inp varmap-inp-order" data-field="order">' +
            '<option value="HL"' +
            (row.order === "HL" ? " selected" : "") +
            ">HL</option>" +
            '<option value="LH"' +
            (row.order === "LH" ? " selected" : "") +
            ">LH</option>" +
            "</select>"
          : "—"
      ) +
      "</td>" +
      '<td class="varmap-cell-value">' +
      '<div class="varmap-value-wrap">' +
      buildValueEditorHtml(row) +
      "</div></td>" +
      '<td class="varmap-cell-actions">' +
      '<button type="button" class="mfc-btn varmap-del" data-action="delete" title="' +
      escapeAttr(t("varmap.delete")) +
      '">×</button>' +
      "</td>"
    );
  }

  function createRowElement(row) {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;
    tr.innerHTML = buildRowHtml(row);
    return tr;
  }

  function updateRowElement(tr, row) {
    if (!tr) return;
    const prevCb = tr.querySelector('.varmap-inp-value-bool[data-id="' + row.id + '"]');
    const prevInp = tr.querySelector('.varmap-inp-value[data-id="' + row.id + '"]');
    const wasFocused =
      (prevCb && document.activeElement === prevCb) ||
      (prevInp && document.activeElement === prevInp);
    const cbChecked = prevCb ? prevCb.checked : false;
    const inpValue = prevInp ? prevInp.value : "";
    const inpCommitted = prevInp ? prevInp.dataset.committed : "";
    const hadErr =
      (prevCb && prevCb.classList.contains("varmap-value-err")) ||
      (prevInp && prevInp.classList.contains("varmap-value-err"));
    tr.innerHTML = buildRowHtml(row);
    const newCb = tr.querySelector('.varmap-inp-value-bool[data-id="' + row.id + '"]');
    const newInp = tr.querySelector('.varmap-inp-value[data-id="' + row.id + '"]');
    if (newCb && prevCb) {
      newCb.checked = cbChecked;
      newCb.classList.toggle("varmap-value-err", hadErr);
      if (wasFocused) newCb.focus();
    }
    if (newInp && prevInp) {
      newInp.value = inpValue;
      newInp.dataset.committed = inpCommitted || inpValue;
      newInp.classList.toggle("varmap-value-err", hadErr);
      if (wasFocused) newInp.focus();
    }
  }

  function syncEmptyState() {
    const empty = document.getElementById("varMapEmpty");
    if (empty) empty.hidden = variables.length > 0;
  }

  function renderTable() {
    const body = document.getElementById("varMapBody");
    if (!body) return;
    body.innerHTML = "";
    syncEmptyState();

    variables.forEach(function (row) {
      body.appendChild(createRowElement(row));
    });
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function findRow(id) {
    for (let i = 0; i < variables.length; i++) {
      if (variables[i].id === id) return variables[i];
    }
    return null;
  }

  function onTableChange(ev) {
    const tr = ev.target.closest("tr");
    if (!tr || !tr.dataset.id) return;
    const row = findRow(tr.dataset.id);
    if (!row) return;

    if (ev.target.dataset.field === "value") return;

    if (ev.target.dataset.action === "delete") {
      variables = variables.filter(function (v) {
        return v.id !== row.id;
      });
      saveVariables();
      tr.remove();
      syncEmptyState();
      refreshValues(true);
      return;
    }

    const field = ev.target.dataset.field;
    if (!field) return;

    if (field === "name") row.name = ev.target.value;
    else if (field === "kind") {
      row.kind = ev.target.value;
      if (row.kind === "coil" || row.kind === "dinput") row.type = "bool";
      else if (row.type === "bool" || row.type === "bit") row.type = "uint16";
      updateRowElement(tr, row);
    } else if (field === "addr") {
      row.addr = Math.max(0, Math.min(65535, Number(ev.target.value) || 0));
      ev.target.value = String(row.addr);
    } else if (field === "type") {
      row.type = ev.target.value;
      if (row.type === "bit" && (row.bit == null || row.bit === "")) row.bit = 0;
      updateRowElement(tr, row);
    } else if (field === "bit") {
      row.bit = Math.max(0, Math.min(15, Number(ev.target.value) || 0));
      ev.target.value = String(row.bit);
    } else if (field === "order") {
      row.order = ev.target.value === "LH" ? "LH" : "HL";
    }

    scheduleSave();
    if (ev.type === "change" && field !== "name") {
      refreshValues(true);
    }
  }

  function onValueKeydown(ev) {
    if (ev.key !== "Enter") return;
    const el = ev.target;
    if (!el.matches(".varmap-inp-value")) return;
    ev.preventDefault();
    el.blur();
  }

  async function commitValueEditor(el) {
    const tr = el.closest("tr");
    if (!tr || !tr.dataset.id) return;
    const row = findRow(tr.dataset.id);
    if (!row) return;
    if (el.matches(".varmap-inp-value")) {
      const committed = el.dataset.committed || "";
      if (el.value === committed) return;
    }
    try {
      await writeVariableFromEditor(row, el);
      if (el.matches(".varmap-inp-value")) {
        el.dataset.committed = el.value;
      }
    } catch (e) {
      const msg =
        e && e.message === "badValue"
          ? t("varmap.msg.badValue")
          : String(e.message || t("varmap.msg.writeFailed"));
      el.classList.add("varmap-value-err");
      const statusEl = document.getElementById("varMapStatus");
      if (statusEl) statusEl.textContent = msg;
      if (ctx && ctx.setMsg) ctx.setMsg(msg, "err");
    }
  }

  function onValueBlur(ev) {
    const el = ev.target;
    if (!el.matches(".varmap-inp-value")) return;
    commitValueEditor(el);
  }

  function onValueToggle(ev) {
    const el = ev.target;
    if (!el.matches(".varmap-inp-value-bool")) return;
    if (ev.type !== "change") return;
    commitValueEditor(el);
  }

  function addVariable() {
    variables.push(defaultVariable());
    saveVariables();
    const body = document.getElementById("varMapBody");
    if (body) {
      body.appendChild(createRowElement(variables[variables.length - 1]));
      syncEmptyState();
      const inp = body.lastElementChild.querySelector(".varmap-inp-name");
      if (inp) inp.focus();
    }
  }

  async function onShow() {
    variables = await loadVariables();
    renderTable();
    refreshValues(true);
    startPolling();
  }

  function onHide() {
    stopPolling();
  }

  function onLangChange() {
    if (!ctx || !ctx.isActive()) return;
    renderTable();
  }

  async function attach(options) {
    ctx = options;
    variables = await loadVariables();
    loadPollSetting();

    const body = document.getElementById("varMapBody");
    if (body) {
      body.addEventListener("input", onTableChange);
      body.addEventListener("change", onTableChange);
      body.addEventListener("click", onTableChange);
      body.addEventListener("keydown", onValueKeydown);
      body.addEventListener("change", onValueToggle);
      body.addEventListener("blur", onValueBlur, true);
      bindRowEditGuard(body);
    }

    const addBtn = document.getElementById("varMapAdd");
    if (addBtn) addBtn.addEventListener("click", addVariable);

    const refreshBtn = document.getElementById("varMapRefresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        refreshValues(false);
      });
    }

    const exportBtn = document.getElementById("varMapExport");
    if (exportBtn) exportBtn.addEventListener("click", exportVarMap);

    const importBtn = document.getElementById("varMapImport");
    const importFile = document.getElementById("varMapImportFile");
    if (importBtn && importFile) {
      importBtn.addEventListener("click", function () {
        importFile.click();
      });
      importFile.addEventListener("change", function () {
        const file = importFile.files && importFile.files[0];
        if (file) {
          importVarMap(file).finally(function () {
            importFile.value = "";
          });
        }
      });
    }

    const pollEl = document.getElementById("varMapPollEnabled");
    if (pollEl) {
      pollEl.addEventListener("change", function () {
        try {
          localStorage.setItem(
            POLL_ENABLED_KEY,
            pollEl.checked ? "1" : "0"
          );
        } catch (e) {
          /* ignore */
        }
        if (ctx.isActive()) {
          if (pollEl.checked) startPolling();
          else stopPolling();
        }
      });
    }
  }

  window.APCS_VAR_MAP = {
    attach: attach,
    onShow: onShow,
    onHide: onHide,
    onLangChange: onLangChange,
    restartPolling: startPolling,
    reloadFromServer: reloadFromServer,
  };
})();
