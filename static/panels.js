/** Navigation (Modbus / Address map / Scripts) and scripts import-export. */
(function () {
  const API = "/api/v1";

  function t(key, params) {
    return window.APCS_I18N ? window.APCS_I18N.t(key, params) : key;
  }

  function setMsg(text, kind) {
    const el = document.getElementById("msg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "status-msg" + (kind ? " status-" + kind : "");
  }

  let currentView = "registers";
  let simScriptsEnabled = false;
  let scriptCatalog = [];
  let activeScriptName = null;
  let scriptSavedContent = "";
  let scriptIsDraft = false;
  let scriptHighlight = null;

  const modbusPanel = document.getElementById("modbusPanel");
  const variablesPanel = document.getElementById("variablesPanel");
  const scriptsPanel = document.getElementById("scriptsPanel");
  const navModbus = document.getElementById("navModbus");
  const navVariables = document.getElementById("navVariables");
  const navScripts = document.getElementById("navScripts");
  const scriptList = document.getElementById("scriptList");
  const scriptEditor = document.getElementById("scriptEditor");
  const scriptNewBtn = document.getElementById("scriptNew");
  const scriptSaveBtn = document.getElementById("scriptSave");
  const scriptReloadBtn = document.getElementById("scriptReload");
  const scriptDeleteBtn = document.getElementById("scriptDelete");
  const scriptExportBtn = document.getElementById("scriptExport");
  const scriptImportBtn = document.getElementById("scriptImport");
  const scriptImportFile = document.getElementById("scriptImportFile");
  const simExportBtn = document.getElementById("simExport");
  const simImportBtn = document.getElementById("simImport");
  const simImportFile = document.getElementById("simImportFile");
  const scriptNameInput = document.getElementById("scriptNameInput");
  const scriptSyntaxError = document.getElementById("scriptSyntaxError");
  const scriptsDisabledMsg = document.getElementById("scriptsDisabledMsg");

  function setScriptEditorContent(text, disabled) {
    if (!scriptEditor) return;
    scriptEditor.value = text;
    if (disabled != null) scriptEditor.disabled = disabled;
    scriptEditor.dispatchEvent(new Event("input"));
  }

  function scriptIsDirty() {
    return scriptEditor && scriptEditor.value !== scriptSavedContent;
  }

  function validateScriptName(name) {
    if (!name || name.length > 128) return false;
    if (!name.endsWith(".js")) return false;
    if (name.includes("..") || name.includes("/") || name.includes("\\")) return false;
    return /^[\w.\-]+$/.test(name);
  }

  function confirmDiscardScriptChanges() {
    if (!scriptIsDirty()) return true;
    return window.confirm(t("scripts.unsaved"));
  }

  function syncMainNav() {
    if (navModbus) {
      const on = currentView === "registers";
      navModbus.classList.toggle("active", on);
      navModbus.setAttribute("aria-selected", on ? "true" : "false");
    }
    if (navVariables) {
      const on = currentView === "variables";
      navVariables.classList.toggle("active", on);
      navVariables.setAttribute("aria-selected", on ? "true" : "false");
    }
    if (navScripts) {
      const on = currentView === "scripts";
      navScripts.classList.toggle("active", on);
      navScripts.setAttribute("aria-selected", on ? "true" : "false");
    }
  }

  function setMainView(view) {
    if (view === currentView) return true;
    if (currentView === "scripts" && view !== "scripts" && !confirmDiscardScriptChanges()) {
      return false;
    }
    const prev = currentView;
    currentView = view;
    if (modbusPanel) modbusPanel.hidden = view !== "registers";
    if (variablesPanel) variablesPanel.hidden = view !== "variables";
    if (scriptsPanel) scriptsPanel.hidden = view !== "scripts";
    syncMainNav();
    if (prev === "variables" && view !== "variables" && window.APCS_VAR_MAP) {
      window.APCS_VAR_MAP.onHide();
    }
    if (view === "variables" && window.APCS_VAR_MAP) {
      const areaHint = document.getElementById("areaHint");
      if (areaHint) areaHint.textContent = "";
      window.APCS_VAR_MAP.onShow();
    }
    if (window.APCS_APP && window.APCS_APP.onViewChange) {
      window.APCS_APP.onViewChange(view);
    }
    return true;
  }

  function renderScriptList() {
    if (!scriptList) return;
    scriptList.innerHTML = "";
    if (scriptCatalog.length === 0) {
      const li = document.createElement("li");
      li.className = "script-list-empty";
      li.textContent = t("scripts.listEmpty");
      scriptList.appendChild(li);
      return;
    }
    scriptCatalog.forEach(function (item) {
      const li = document.createElement("li");
      li.className = "script-list-item";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "script-list-btn";
      btn.textContent = item.name;
      if (item.name === activeScriptName) btn.classList.add("active");
      btn.addEventListener("click", function () {
        selectScript(item.name);
      });
      li.appendChild(btn);
      scriptList.appendChild(li);
    });
  }

  function updateScriptActiveLabel() {
    if (!scriptNameInput) return;
    const editable = scriptIsDraft || !activeScriptName;
    scriptNameInput.readOnly = !editable;
    if (activeScriptName && !scriptIsDraft) {
      scriptNameInput.value = activeScriptName;
    } else if (!scriptIsDraft) {
      scriptNameInput.value = "";
    }
    scriptNameInput.classList.toggle("script-name-draft", editable);
    scriptNameInput.classList.toggle("script-name-dirty", scriptIsDirty());
  }

  function updateScriptSyntaxError(detail) {
    if (!scriptSyntaxError) return;
    if (!detail || detail.ok) {
      scriptSyntaxError.hidden = true;
      scriptSyntaxError.textContent = "";
      return;
    }
    scriptSyntaxError.hidden = false;
    scriptSyntaxError.textContent = t("scripts.syntaxError", {
      line: detail.line || 1,
      message: detail.message || "",
    });
  }

  async function fetchScriptList() {
    const r = await fetch(API + "/sim-scripts");
    if (!r.ok) throw new Error(r.status + " " + r.statusText);
    const j = await r.json();
    if (!j.enabled) {
      simScriptsEnabled = false;
      if (navScripts) navScripts.hidden = true;
      throw new Error("disabled");
    }
    scriptCatalog = Array.isArray(j.scripts) ? j.scripts : [];
  }

  async function selectScript(name) {
    if (!confirmDiscardScriptChanges()) return;
    setMsg(t("scripts.msg.loading"));
    try {
      const r = await fetch(API + "/sim-scripts/" + encodeURIComponent(name));
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      const j = await r.json();
      activeScriptName = j.name;
      scriptIsDraft = false;
      scriptSavedContent = j.content || "";
      setScriptEditorContent(scriptSavedContent, false);
      renderScriptList();
      updateScriptActiveLabel();
      setMsg(t("scripts.msg.loaded", { name: activeScriptName }), "ok");
    } catch (e) {
      setMsg(String(e.message || e), "err");
    }
  }

  async function reloadScriptEngine() {
    const r = await fetch(API + "/sim-scripts/reload", { method: "POST" });
    if (!r.ok) throw new Error(r.status + " " + r.statusText);
  }

  async function saveActiveScript(reloadAfter) {
    if (!scriptEditor) return;
    const syntax =
      scriptHighlight && scriptHighlight.getValidation
        ? scriptHighlight.getValidation()
        : window.APCS_SCRIPT_HIGHLIGHT
          ? window.APCS_SCRIPT_HIGHLIGHT.validate(scriptEditor.value)
          : { ok: true };
    if (!syntax.ok) {
      updateScriptSyntaxError(syntax);
      setMsg(t("scripts.syntaxErrorSave", { line: syntax.line || 1 }), "err");
      return;
    }
    let name = activeScriptName;
    if (scriptIsDraft || !name) {
      name = scriptNameInput ? scriptNameInput.value.trim() : "";
      if (!name) {
        if (scriptNameInput) scriptNameInput.focus();
        setMsg(t("scripts.msg.nameRequired"), "err");
        return;
      }
      if (!validateScriptName(name)) {
        if (scriptNameInput) scriptNameInput.focus();
        setMsg(t("scripts.msg.badName"), "err");
        return;
      }
    }
    setMsg(t("msg.writing"));
    try {
      if (scriptIsDraft || !activeScriptName) {
        const r = await fetch(API + "/sim-scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, content: scriptEditor.value }),
        });
        if (r.status === 409) throw new Error("409 Conflict");
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        activeScriptName = name;
        scriptIsDraft = false;
      } else {
        const r = await fetch(API + "/sim-scripts/" + encodeURIComponent(name), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: scriptEditor.value }),
        });
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
      }
      scriptSavedContent = scriptEditor.value;
      await fetchScriptList();
      renderScriptList();
      updateScriptActiveLabel();
      if (reloadAfter) {
        await reloadScriptEngine();
        setMsg(t("scripts.msg.savedReload", { name: name }), "ok");
      } else {
        setMsg(t("scripts.msg.saved", { name: name }), "ok");
      }
    } catch (e) {
      setMsg(String(e.message || e), "err");
    }
  }

  async function deleteActiveScript() {
    if (!activeScriptName || scriptIsDraft) {
      setMsg(t("scripts.msg.noSelection"), "err");
      return;
    }
    if (!window.confirm(t("scripts.msg.confirmDelete", { name: activeScriptName }))) return;
    setMsg(t("msg.writing"));
    try {
      const name = activeScriptName;
      const r = await fetch(API + "/sim-scripts/" + encodeURIComponent(name), { method: "DELETE" });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      activeScriptName = null;
      scriptIsDraft = false;
      scriptSavedContent = "";
      setScriptEditorContent("", false);
      await fetchScriptList();
      renderScriptList();
      updateScriptActiveLabel();
      await reloadScriptEngine();
      setMsg(t("scripts.msg.deleted", { name: name }), "ok");
    } catch (e) {
      setMsg(String(e.message || e), "err");
    }
  }

  function yieldMain() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
  }

  function downloadUrl(url, filename) {
    if (window.APCS_FILE_SAVE && window.APCS_FILE_SAVE.downloadUrl) {
      return window.APCS_FILE_SAVE.downloadUrl(url, filename);
    }
    return Promise.resolve(false);
  }

  async function exportScriptsBundle() {
    if (!simScriptsEnabled) return;
    setMsg(t("scripts.msg.loading"));
    try {
      const n = scriptCatalog.length;
      if (n === 0) {
        throw new Error(t("scripts.msg.nothingToExport"));
      }
      if (n === 1) {
        const name = scriptCatalog[0].name;
        await downloadUrl(
          API + "/sim-scripts/" + encodeURIComponent(name) + "/download",
          name.endsWith(".js") ? name : name + ".js"
        );
        setMsg(t("scripts.msg.exported", { n: 1 }), "ok");
        return;
      }
      await downloadUrl(API + "/sim-scripts/export-zip", "modbus-scripts.zip");
      setMsg(t("scripts.msg.exported", { n: n }), "ok");
    } catch (e) {
      setMsg(String(e.message || e), "err");
    }
  }

  function scriptNameFromFile(name) {
    const base = String(name || "")
      .replace(/^.*[/\\]/, "")
      .trim();
    if (!base) return "script.js";
    return base.endsWith(".js") ? base : base + ".js";
  }

  async function importScriptsBundle(file) {
    if (!simScriptsEnabled || !file) return;
    setMsg(t("scripts.msg.loading"));
    try {
      await yieldMain();
      const lower = String(file.name || "").toLowerCase();
      let mode = "merge";
      if (scriptCatalog.length > 0) {
        mode = window.confirm(t("scripts.importReplaceConfirm")) ? "replace" : "merge";
      }
      if (lower.endsWith(".zip")) {
        const r = await fetch(
          API + "/sim-scripts/import-zip?mode=" + encodeURIComponent(mode),
          {
            method: "POST",
            headers: { "Content-Type": "application/zip" },
            body: file,
          }
        );
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        const j = await r.json();
        activeScriptName = null;
        scriptIsDraft = false;
        scriptSavedContent = "";
        setScriptEditorContent("", false);
        await fetchScriptList();
        renderScriptList();
        updateScriptActiveLabel();
        if (scriptCatalog.length === 1) {
          await selectScript(scriptCatalog[0].name);
        } else {
          setMsg(t("scripts.msg.imported", { n: j.imported || 0 }), "ok");
        }
        return;
      }
      if (lower.endsWith(".js")) {
        const content = await file.text();
        const scriptName = scriptNameFromFile(file.name);
        const r = await fetch(API + "/sim-scripts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: 1,
            scripts: [{ name: scriptName, content: content }],
            mode: mode,
          }),
        });
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        const j = await r.json();
        activeScriptName = null;
        scriptIsDraft = false;
        scriptSavedContent = "";
        setScriptEditorContent("", false);
        await fetchScriptList();
        renderScriptList();
        updateScriptActiveLabel();
        if (scriptCatalog.length === 1) {
          await selectScript(scriptCatalog[0].name);
        } else {
          setMsg(t("scripts.msg.imported", { n: j.imported || 0 }), "ok");
        }
        return;
      }
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.scripts)) {
        throw new Error(t("scripts.msg.badImport"));
      }
      const r = await fetch(API + "/sim-scripts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: parsed.version || 1,
          scripts: parsed.scripts,
          mode: mode,
        }),
      });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      const j = await r.json();
      activeScriptName = null;
      scriptIsDraft = false;
      scriptSavedContent = "";
      setScriptEditorContent("", false);
      await fetchScriptList();
      renderScriptList();
      updateScriptActiveLabel();
      if (scriptCatalog.length === 1) {
        await selectScript(scriptCatalog[0].name);
      } else {
        setMsg(t("scripts.msg.imported", { n: j.imported || 0 }), "ok");
      }
    } catch (e) {
      setMsg(String(e.message || e), "err");
    } finally {
      if (scriptImportFile) scriptImportFile.value = "";
    }
  }

  function parseSimulationPayload(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    const hasScripts = Array.isArray(parsed.scripts);
    const hasVarMap =
      (parsed.varMap && Array.isArray(parsed.varMap.variables)) ||
      Array.isArray(parsed.variables);
    if (!hasScripts && !hasVarMap) return null;
    const body = { version: parsed.version || 1, mode: "merge" };
    if (hasScripts) body.scripts = parsed.scripts;
    if (parsed.varMap && Array.isArray(parsed.varMap.variables)) {
      body.varMap = parsed.varMap;
    } else if (Array.isArray(parsed.variables)) {
      body.variables = parsed.variables;
    }
    return body;
  }

  function hasSimulationData() {
    return scriptCatalog.length > 0;
  }

  async function exportSimulationBundle() {
    setMsg(t("scripts.msg.loading"));
    try {
      await downloadUrl(API + "/simulation/export-zip", "modbus-simulation.zip");
      setMsg(t("sim.msg.exportedZip"), "ok");
    } catch (e) {
      setMsg(String(e.message || e), "err");
    }
  }

  async function importSimulationBundle(file) {
    if (!file) return;
    setMsg(t("scripts.msg.loading"));
    try {
      await yieldMain();
      const lower = String(file.name || "").toLowerCase();
      let mode = "merge";
      if (hasSimulationData() || (window.APCS_VAR_MAP && variablesExist())) {
        mode = window.confirm(t("sim.importReplaceConfirm")) ? "replace" : "merge";
      }
      if (lower.endsWith(".zip")) {
        const r = await fetch(
          API + "/simulation/import-zip?mode=" + encodeURIComponent(mode),
          {
            method: "POST",
            headers: { "Content-Type": "application/zip" },
            body: file,
          }
        );
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        const j = await r.json();
        activeScriptName = null;
        scriptIsDraft = false;
        scriptSavedContent = "";
        setScriptEditorContent("", false);
        await fetchScriptList();
        renderScriptList();
        updateScriptActiveLabel();
        if (window.APCS_VAR_MAP && window.APCS_VAR_MAP.reloadFromServer) {
          await window.APCS_VAR_MAP.reloadFromServer();
        }
        setMsg(
          t("sim.msg.imported", {
            scripts: j.scripts_imported || 0,
            map: j.var_map_imported || 0,
          }),
          "ok"
        );
        return;
      }
      const parsed = JSON.parse(await file.text());
      const payload = parseSimulationPayload(parsed);
      if (!payload) throw new Error(t("sim.msg.badImport"));
      payload.mode = mode;
      const r = await fetch(API + "/simulation/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      const j = await r.json();
      activeScriptName = null;
      scriptIsDraft = false;
      scriptSavedContent = "";
      setScriptEditorContent("", false);
      if (simScriptsEnabled) {
        await fetchScriptList();
        renderScriptList();
        updateScriptActiveLabel();
        if (scriptCatalog.length === 1) {
          await selectScript(scriptCatalog[0].name);
        }
      }
      if (window.APCS_VAR_MAP && window.APCS_VAR_MAP.reloadFromServer) {
        await window.APCS_VAR_MAP.reloadFromServer();
      }
      setMsg(
        t("sim.msg.imported", {
          scripts: j.scripts_imported || 0,
          map: j.var_map_imported || 0,
        }),
        "ok"
      );
    } catch (e) {
      setMsg(String(e.message || e), "err");
    } finally {
      if (simImportFile) simImportFile.value = "";
    }
  }

  function variablesExist() {
    const empty = document.getElementById("varMapEmpty");
    return empty ? empty.hidden : false;
  }

  function startNewScriptDraft() {
    if (!confirmDiscardScriptChanges()) return;
    activeScriptName = null;
    scriptIsDraft = true;
    scriptSavedContent = "";
    if (scriptNameInput) {
      scriptNameInput.value = "";
      scriptNameInput.readOnly = false;
    }
    setScriptEditorContent(
      "// Holding 0…9: HR0 +1 every 1 s; each write propagates to the next register via onWrite.\n" +
        "/*\n" +
        "const CHAIN_LEN = 10;\n" +
        "\n" +
        "function holdingValue(values) {\n" +
        "  let v = Array.isArray(values) ? values[0] : values;\n" +
        "  return Number(v) & 0xffff;\n" +
        "}\n" +
        "\n" +
        "modbus.onWrite('holding', function (addr, values) {\n" +
        "  if (addr >= CHAIN_LEN - 1) return;\n" +
        "  modbus.holdingWrite(addr + 1, holdingValue(values));\n" +
        "});\n" +
        "\n" +
        "modbus.setInterval(1000, function () {\n" +
        "  let v = (Number(modbus.holdingRead(0)) + 1) & 0xffff;\n" +
        "  modbus.holdingWrite(0, v);\n" +
        "});\n" +
        "*/\n",
      false
    );
    renderScriptList();
    updateScriptActiveLabel();
    if (scriptNameInput) scriptNameInput.focus();
    setMsg(t("scripts.msg.newDraft"));
  }

  async function refreshScriptsPanel(selectFirstIfNeeded) {
    if (scriptsDisabledMsg) scriptsDisabledMsg.hidden = true;
    if (scriptEditor) scriptEditor.disabled = false;
    setMsg(t("scripts.msg.loading"));
    try {
      await loadSimConfig();
      if (!simScriptsEnabled) {
        throw new Error("disabled");
      }
      await fetchScriptList();
      renderScriptList();
      if (selectFirstIfNeeded && scriptCatalog.length && !scriptIsDraft && !activeScriptName) {
        await selectScript(scriptCatalog[0].name);
      } else {
        updateScriptActiveLabel();
        if (scriptCatalog.length) {
          setMsg("");
        } else {
          setMsg(t("scripts.listEmpty"), "ok");
        }
      }
    } catch (e) {
      renderScriptList();
      if (String(e.message || e) === "disabled" && scriptsDisabledMsg) {
        scriptsDisabledMsg.hidden = false;
        if (scriptEditor) {
          scriptEditor.disabled = true;
          scriptEditor.dispatchEvent(new Event("input"));
        }
      }
      setMsg(String(e.message || e), "err");
    }
  }

  async function openScriptsView() {
    if (!setMainView("scripts")) return;
    await refreshScriptsPanel(true);
  }

  async function loadSimConfig() {
    try {
      const r = await fetch(API + "/ui-config");
      if (!r.ok) return;
      const j = await r.json();
      simScriptsEnabled = !!j.sim_scripts_enabled;
      if (navScripts) navScripts.hidden = !simScriptsEnabled;
    } catch (e) {
      /* ignore */
    }
  }

  function init() {
    loadSimConfig();
    document.querySelectorAll(".mfc-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        setMainView("registers");
      });
    });
    if (navModbus) {
      navModbus.addEventListener("click", function () {
        if (currentView !== "registers") setMainView("registers");
      });
    }
    if (navVariables) {
      navVariables.addEventListener("click", function () {
        if (currentView !== "variables") setMainView("variables");
      });
    }
    if (navScripts) {
      navScripts.addEventListener("click", function () {
        if (currentView === "scripts") {
          refreshScriptsPanel(false);
        } else {
          openScriptsView();
        }
      });
    }
    if (scriptEditor && window.APCS_SCRIPT_HIGHLIGHT) {
      scriptHighlight = window.APCS_SCRIPT_HIGHLIGHT.attach(scriptEditor);
      scriptEditor.addEventListener("input", updateScriptActiveLabel);
      scriptEditor.addEventListener("apcs-script-validate", function (ev) {
        updateScriptSyntaxError(ev.detail);
      });
    }
    if (scriptNewBtn) scriptNewBtn.addEventListener("click", startNewScriptDraft);
    if (scriptSaveBtn) {
      scriptSaveBtn.addEventListener("click", function () {
        saveActiveScript(true);
      });
    }
    if (scriptReloadBtn) {
      scriptReloadBtn.addEventListener("click", async function () {
        setMsg(t("scripts.msg.loading"));
        try {
          await reloadScriptEngine();
          await fetchScriptList();
          renderScriptList();
          updateScriptActiveLabel();
          setMsg(t("scripts.msg.reloaded"), "ok");
        } catch (e) {
          setMsg(String(e.message || e), "err");
        }
      });
    }
    if (scriptDeleteBtn) scriptDeleteBtn.addEventListener("click", deleteActiveScript);
    if (scriptExportBtn) scriptExportBtn.addEventListener("click", exportScriptsBundle);
    if (scriptImportBtn && scriptImportFile) {
      scriptImportBtn.addEventListener("click", function () {
        scriptImportFile.click();
      });
      scriptImportFile.addEventListener("change", function () {
        const file = scriptImportFile.files && scriptImportFile.files[0];
        if (file) importScriptsBundle(file);
      });
    }
    if (simExportBtn) simExportBtn.addEventListener("click", exportSimulationBundle);
    if (simImportBtn && simImportFile) {
      simImportBtn.addEventListener("click", function () {
        simImportFile.click();
      });
      simImportFile.addEventListener("change", function () {
        const file = simImportFile.files && simImportFile.files[0];
        if (file) importSimulationBundle(file);
      });
    }
    if (window.APCS_VAR_MAP && window.APCS_APP) {
      window.APCS_VAR_MAP.attach({
        t: t,
        readPath: window.APCS_APP.readPath,
        combineU32: window.APCS_APP.combineU32,
        u32ToInt32: window.APCS_APP.u32ToInt32,
        u32ToFloat32: window.APCS_APP.u32ToFloat32,
        regsToFloat64: window.APCS_APP.regsToFloat64,
        isBoolKind: window.APCS_APP.isBoolKind,
        getMaxModbusAddress: window.APCS_APP.getMaxModbusAddress,
        pollIntervalMs: window.APCS_APP.pollIntervalMs,
        setMsg: setMsg,
        isActive: function () {
          return currentView === "variables";
        },
      });
    }
    window.addEventListener("apcs-lang-change", function () {
      updateScriptActiveLabel();
      if (scriptHighlight && scriptHighlight.getValidation) {
        updateScriptSyntaxError(scriptHighlight.getValidation());
      }
      if (window.APCS_VAR_MAP) window.APCS_VAR_MAP.onLangChange();
    });
  }

  window.APCS_PANELS = {
    isRegistersView: function () {
      return currentView === "registers";
    },
    setMainView: setMainView,
    init: init,
  };
})();
