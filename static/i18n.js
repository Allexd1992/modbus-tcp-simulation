/**
 * UI i18n: English (default) and Russian. Storage key: apcs-ui-lang
 */
(function () {
  const STORAGE_KEY = "apcs-ui-lang";
  const FALLBACK = "en";

  const STR = {
    en: {
      "app.title": "Modbus TCP Server Simulation",
      "lang.switch": "Language",
      "theme.title": "Light / dark theme",
      "theme.aria": "Toggle theme",
      "mcpAi.title": "MCP — AI access",
      "mcp.heading": "MCP for AI",
      "mcp.lead":
        "<strong>Model Context Protocol</strong> — a separate HTTP service with the same in-memory store as REST: read/write registers and discretes via <strong>tools</strong> for clients such as Cursor.",
      "mcp.li1": "Transport: <strong>Streamable HTTP</strong>, path <code>/mcp</code>",
      "mcp.li3":
        "Inside a container MCP listens on <strong>8081</strong>; with host mapping <code>18081:8081</code> the example below uses <strong>18081</strong>. Other port: add <code>?mcpPort=8081</code> to the UI URL (native run without Docker).",
      "mcp.li4":
        "Environment <code>MCP_SERVER_PORT</code> (default <strong>8081</strong> in process); <strong>0</strong> — MCP disabled",
      "mcp.li5":
        "In tools, register <strong>addr</strong> is the <strong>protocol offset</strong> (0-based): <strong>40001 → addr 0</strong>, <strong>40021 → addr 20</strong>.",
      "mcp.li6":
        "Tools: <code>modbus_read_holding_registers</code>, <code>modbus_write_holding_registers</code>, etc.",
      "mcp.configTitle": "Cursor configuration example",
      "mcp.configHint":
        "File <code>mcp.json</code>: project <code>.cursor/mcp.json</code> or global <code>%USERPROFILE%\\.cursor\\mcp.json</code> (Windows). After changes — full Cursor restart. Host and port in the example follow this page (and <code>?mcpPort=</code>).",
      "mcp.download": "Download mcp.json",
      "mcp.close": "Close",
      "mcp.preAria": "Example mcp.json for Cursor",
      "mcp.urlLine":
        'Current URL for Cursor: <code class="mcp-ai-code">{url}</code> · host matches this page (<code>{host}</code>), port <strong>{port}</strong> — from <code>?mcpPort=…</code> or <strong>18081</strong> by default.',
      "swagger": "Swagger",
      "tabs.aria": "Modbus table",
      "tab.holding": "Holding registers",
      "tab.input": "Input registers",
      "tab.coil": "Coils",
      "tab.dinput": "Discrete inputs",
      "label.offset": "Offset",
      "label.count": "Count",
      "btn.refresh": "Refresh",
      "label.auto": "Auto",
      "label.interval": "Interval",
      "poll.unit": "s",
      "label.format": "Format",
      "label.word32": "32-bit words",
      "fmt.uint16": "UInt16",
      "fmt.int16": "Int16",
      "fmt.bitmask": "Bitmask",
      "fmt.int32": "Int32",
      "fmt.float32": "Float",
      "fmt.float64": "Double",
      "grid.aria": "Register matrix",
      "poll.title": "Periodic table refresh",
      "addr.title": "Window offset: start word/bit address (0-based)",
      "cnt.title": "Words/bits to request (1…{maxRead})",
      "displayMode.title": "Word decoding",
      "wordOrder.title": "16-bit word order",
      "pollInterval.title": "Seconds between auto-refreshes",
      "pollInterval.aria": "Auto-refresh interval in seconds",
      "btn.prev": "Shift window back",
      "btn.next": "Shift window forward",
      "unit.bit": "bits",
      "unit.word": "words",
      "area.window":
        "Window: protocol {a}…{end} ({c} {unit}) · doc. {docS}…{docE}",
      "th.corner.bitmask": "Word address (protocol); bits 0…15 to the right (LSB = b0)",
      "th.corner.row": "First cell address in row (protocol, 0-based)",
      "th.bitTitle": "Bit {n} (LSB = b0)",
      "th.offsetTitle": "Offset in row",
      "row.doc": "Doc: {doc}",
      "cell.bit": "{doc} · bit {b}",
      "inp.float32Title": "Float32 (IEEE754 BE), use . or , as decimal separator",
      "inp.float64Title": "Float64 BE (4 words), use . or , as decimal separator",
      "msg.badAddress": "Invalid address",
      "msg.windowOutOfRange":
        "Window end (start + count − 1) must be ≤ {max} (protocol)",
      "msg.badCount": "Count: 1…{max}",
      "msg.int32even": "int32 requires an even number of words",
      "msg.floatEven": "float requires an even number of words",
      "msg.doubleMul4": "double: word count must be a multiple of 4",
      "msg.requesting": "Requesting…",
      "msg.apiNotArray":
        "API response must be a JSON array (check URL and /api/v1)",
      "msg.auto": "Auto {sec}s · {n} {unit}",
      "msg.done": "Done · {n} {unit}",
      "msg.writing": "Writing…",
      "msg.written": "Written · {addr} = 0x{hex}",
      "msg.writtenAddr": "Written · {addr}",
      "msg.writtenSpan": "Written · {span}",
      "msg.int32Range": "int32: integer from −2147483648 to 2147483647",
      "msg.badFloat": "Invalid float number",
      "msg.badDouble": "Invalid double number",
      "msg.badNumber": "Invalid number",
      "msg.int16Range": "int16: −32768…32767",
      "msg.uint16Range": "uint16: 0…65535",
      "msg.matrixOdd":
        "Odd word count — change format or read an even-sized range.",
      "msg.matrixFloatOdd": "Odd word count for float.",
      "msg.matrixDoubleMul4": "Word count must be a multiple of 4 for double.",
    },
    ru: {
      "app.title": "Modbus TCP Server Simulation",
      "lang.switch": "Язык",
      "theme.title": "Светлая / тёмная тема",
      "theme.aria": "Переключить тему",
      "mcpAi.title": "MCP — доступ для ИИ",
      "mcp.heading": "MCP для ИИ",
      "mcp.lead":
        "<strong>Model Context Protocol</strong> — отдельный HTTP-сервис с тем же in-memory хранилищем, что и REST: чтение/запись регистров и дискретов через <strong>tools</strong> для клиентов вроде Cursor.",
      "mcp.li1": "Транспорт: <strong>Streamable HTTP</strong>, путь <code>/mcp</code>",
      "mcp.li3":
        "Внутри контейнера MCP слушает <strong>8081</strong>; с хоста при пробросе <code>18081:8081</code> порт по умолчанию в примере ниже — <strong>18081</strong>. Иной порт: добавьте в URL UI параметр <code>?mcpPort=8081</code> (нативный запуск без Docker).",
      "mcp.li4":
        "Переменная окружения <code>MCP_SERVER_PORT</code> (в процессе по умолчанию <strong>8081</strong>); <strong>0</strong> — MCP выключен",
      "mcp.li5":
        "В tools адрес регистра — <strong>смещение по протоколу</strong> (0-based): <strong>40001 → addr 0</strong>, <strong>40021 → addr 20</strong>.",
      "mcp.li6":
        "Инструменты: <code>modbus_read_holding_registers</code>, <code>modbus_write_holding_registers</code> и др.",
      "mcp.configTitle": "Пример конфигурации Cursor",
      "mcp.configHint":
        "Файл <code>mcp.json</code>: в каталоге проекта <code>.cursor/mcp.json</code> или глобально <code>%USERPROFILE%\\.cursor\\mcp.json</code> (Windows). После изменения — полный перезапуск Cursor. Хост и порт в примере берутся из адреса этой страницы (и <code>?mcpPort=</code>).",
      "mcp.download": "Скачать mcp.json",
      "mcp.close": "Закрыть",
      "mcp.preAria": "Пример mcp.json для Cursor",
      "mcp.urlLine":
        'Текущий URL для Cursor: <code class="mcp-ai-code">{url}</code> · хост как у этой страницы (<code>{host}</code>), порт <strong>{port}</strong> — из <code>?mcpPort=…</code> или <strong>18081</strong> по умолчанию.',
      "swagger": "Swagger",
      "tabs.aria": "Таблица Modbus",
      "tab.holding": "Holding registers",
      "tab.input": "Input registers",
      "tab.coil": "Coils",
      "tab.dinput": "Discrete inputs",
      "label.offset": "Сдвиг",
      "label.count": "Количество",
      "btn.refresh": "Обновить",
      "label.auto": "Авто",
      "label.interval": "Интервал",
      "poll.unit": "с",
      "label.format": "Формат",
      "label.word32": "32 бит слова",
      "fmt.uint16": "UInt16",
      "fmt.int16": "Int16",
      "fmt.bitmask": "Битовая маска",
      "fmt.int32": "Int32",
      "fmt.float32": "Float",
      "fmt.float64": "Double",
      "grid.aria": "Матрица регистров",
      "poll.title": "Периодическое обновление таблицы",
      "addr.title": "Сдвиг окна: стартовый адрес слова/бита (0-based, протокол)",
      "cnt.title": "Сколько слов/битов запросить (1…{maxRead})",
      "displayMode.title": "Декодирование слов",
      "wordOrder.title": "Порядок 16-бит слов",
      "pollInterval.title": "Секунды между автообновлениями",
      "pollInterval.aria": "Интервал автообновления в секундах",
      "btn.prev": "Сдвиг окна назад",
      "btn.next": "Сдвиг окна вперёд",
      "unit.bit": "бит",
      "unit.word": "сл.",
      "area.window":
        "Окно: протокол {a}…{end} ({c} {unit}) · док. {docS}…{docE}",
      "th.corner.bitmask":
        "Адрес слова (протокол), справа — биты 0…15 (LSB = b0)",
      "th.corner.row": "Адрес первой ячейки строки (протокол, 0-based)",
      "th.bitTitle": "Бит {n} (младший — b0)",
      "th.offsetTitle": "Смещение в строке",
      "row.doc": "Док: {doc}",
      "cell.bit": "{doc} · бит {b}",
      "inp.float32Title":
        "Float32 (IEEE754 BE), десятичный разделитель . или ,",
      "inp.float64Title": "Float64 BE (4 слова), десятичный разделитель . или ,",
      "msg.badAddress": "Некорректный адрес",
      "msg.windowOutOfRange":
        "Конец окна (старт + количество − 1) должен быть ≤ {max} (протокол)",
      "msg.badCount": "Количество: 1…{max}",
      "msg.int32even": "Для int32 нужно чётное число слов",
      "msg.floatEven": "Для float нужно чётное число слов",
      "msg.doubleMul4": "Для double число слов кратно 4",
      "msg.requesting": "Запрос…",
      "msg.apiNotArray":
        "Ответ API: нужен JSON-массив значений (проверьте URL и /api/v1)",
      "msg.auto": "Авто {sec}с · {n} {unit}",
      "msg.done": "Готово · {n} {unit}",
      "msg.writing": "Запись…",
      "msg.written": "Записано · {addr} = 0x{hex}",
      "msg.writtenAddr": "Записано · {addr}",
      "msg.writtenSpan": "Записано · {span}",
      "msg.int32Range": "int32: целое от −2147483648 до 2147483647",
      "msg.badFloat": "Некорректное число float",
      "msg.badDouble": "Некорректное число double",
      "msg.badNumber": "Некорректное число",
      "msg.int16Range": "int16: −32768…32767",
      "msg.uint16Range": "uint16: 0…65535",
      "msg.matrixOdd":
        "Нечётное число слов — переключите формат или прочитайте чётную область.",
      "msg.matrixFloatOdd": "Нечётное число слов для float.",
      "msg.matrixDoubleMul4": "Число слов должно быть кратно 4 для double.",
    },
  };

  function getLang() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "ru" || s === "en") return s;
    } catch (e) {
      /* ignore */
    }
    return FALLBACK;
  }

  function setLang(lang) {
    const l = lang === "ru" ? "ru" : "en";
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch (e) {
      /* ignore */
    }
    document.documentElement.setAttribute("lang", l);
    applyDomI18n();
    syncLangButtons();
    window.dispatchEvent(
      new CustomEvent("apcs-lang-change", { detail: { lang: l } })
    );
  }

  function t(key, params) {
    const lang = getLang();
    let s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (params && typeof params === "object") {
      Object.keys(params).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(params[k]));
      });
    }
    return s;
  }

  function applyDomI18n() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const k = key;
      if (el.tagName === "TITLE") {
        document.title = t(k);
        return;
      }
      const htmlKeys = [
        "mcp.lead",
        "mcp.li1",
        "mcp.li3",
        "mcp.li4",
        "mcp.li5",
        "mcp.li6",
        "mcp.configHint",
      ];
      if (htmlKeys.indexOf(k) >= 0) {
        el.innerHTML = t(k);
      } else {
        el.textContent = t(k);
      }
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      const spec = el.getAttribute("data-i18n-attr");
      if (!spec) return;
      spec.split(";").forEach(function (part) {
        const idx = part.indexOf(":");
        if (idx < 0) return;
        const attr = part.slice(0, idx).trim();
        const key = part.slice(idx + 1).trim();
        el.setAttribute(attr, t(key));
      });
    });

    const dm = document.getElementById("displayMode");
    if (dm) {
      dm.querySelectorAll("option").forEach(function (opt) {
        const k = opt.getAttribute("data-i18n");
        if (k) opt.textContent = t(k);
      });
    }
  }

  function syncLangButtons() {
    const l = getLang();
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      const on = btn.getAttribute("data-lang") === l;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function initLangFromStorage() {
    const l = getLang();
    document.documentElement.setAttribute("lang", l);
  }

  window.APCS_I18N = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    applyDomI18n: applyDomI18n,
    initLangFromStorage: initLangFromStorage,
    syncLangButtons: syncLangButtons,
  };

  initLangFromStorage();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyDomI18n();
      syncLangButtons();
      document.querySelectorAll(".lang-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const lang = btn.getAttribute("data-lang");
          if (lang) setLang(lang);
        });
      });
    });
  } else {
    applyDomI18n();
    syncLangButtons();
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const lang = btn.getAttribute("data-lang");
        if (lang) setLang(lang);
      });
    });
  }
})();
