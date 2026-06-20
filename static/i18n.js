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
        "MCP is served on the <strong>same port</strong> as the web UI and REST API (path <code>/mcp</code>).",
      "mcp.li4":
        "Disable MCP: environment variable <code>MCP_SERVER_PORT=0</code>",
      "mcp.li5":
        "In tools, register <strong>addr</strong> is the <strong>protocol offset</strong> (0-based): <strong>40001 → addr 0</strong>, <strong>40021 → addr 20</strong>.",
      "mcp.li6":
        "Tools: <code>modbus_read_holding_registers</code>, <code>modbus_write_holding_registers</code>, etc.",
      "mcp.configTitle": "Cursor configuration example",
      "mcp.configHint":
        "File <code>mcp.json</code>: project <code>.cursor/mcp.json</code> or global <code>%USERPROFILE%\\.cursor\\mcp.json</code> (Windows). After changes — full Cursor restart. URL uses the same host and port as this page.",
      "mcp.download": "Download mcp.json",
      "mcp.close": "Close",
      "mcp.preAria": "Example mcp.json for Cursor",
      "mcp.urlLine":
        'Current URL for Cursor: <code class="mcp-ai-code">{url}</code> · same host as this page (<code>{host}</code>), port <strong>{port}</strong>',
      "swagger": "Swagger",
      "nav.mainAria": "Main view",
      "nav.modbus": "Modbus",
      "nav.variables": "Address map",
      "nav.scripts": "Simulation rules",
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
      "scripts.new": "New",
      "scripts.save": "Save",
      "scripts.reload": "Reload engine",
      "scripts.delete": "Delete",
      "scripts.files": "Files",
      "scripts.listEmpty": "No scripts on disk — add one or check that the server is running",
      "scripts.editorAria": "Script source code",
      "scripts.disabled":
        "Simulation scripts are disabled on the server (SIM_SCRIPTS_DISABLE or engine failed to start).",
      "scripts.promptName": "Script file name (e.g. my-sim.js):",
      "scripts.fileName": "File",
      "scripts.namePlaceholder": "my-sim.js",
      "scripts.unsaved": "Unsaved changes — save or discard?",
      "scripts.msg.loading": "Loading scripts…",
      "scripts.msg.loaded": "Loaded · {name}",
      "scripts.msg.saved": "Saved · {name}",
      "scripts.msg.savedReload": "Saved and reloaded · {name}",
      "scripts.msg.reloaded": "Scripts reloaded in engine",
      "scripts.msg.deleted": "Deleted · {name}",
      "scripts.msg.newDraft": "New script — enter file name and click Save",
      "scripts.msg.nameRequired": "Enter script file name (must end with .js)",
      "scripts.msg.noSelection": "Select or create a script",
      "scripts.msg.badName": "Name must end with .js (letters, digits, - _ .)",
      "scripts.msg.confirmDelete": "Delete {name}?",
      "scripts.syntaxError": "Line {line}: {message}",
      "scripts.syntaxErrorSave": "Fix syntax error before saving (line {line})",
      "scripts.export": "Export",
      "scripts.import": "Import",
      "scripts.importReplaceConfirm":
        "Replace all existing scripts with the import? Cancel = merge (overwrite same names).",
      "scripts.msg.exported": "Exported {n} script(s)",
      "scripts.msg.nothingToExport": "No scripts to export",
      "scripts.msg.imported": "Imported {n} script(s), engine reloaded",
      "scripts.msg.badImport": "Invalid import file (expected .js, .zip, or JSON with scripts array)",
      "varmap.add": "Add entry",
      "varmap.refresh": "Refresh",
      "varmap.export": "Export",
      "varmap.import": "Import",
      "varmap.importReplaceConfirm":
        "Replace the entire address map with the import? Cancel = merge (overwrite same names).",
      "varmap.delete": "Remove",
      "varmap.empty": "Address map is empty — click Add entry.",
      "varmap.tableAria": "Address map",
      "varmap.placeholder.name": "Name",
      "varmap.col.name": "Name",
      "varmap.col.kind": "Area",
      "varmap.col.addr": "Address",
      "varmap.col.type": "Type",
      "varmap.col.bit": "Bit",
      "varmap.col.bitTitle": "Bit index 0…15 (LSB = b0)",
      "varmap.col.order": "Order",
      "varmap.col.value": "Value",
      "varmap.col.actions": "Actions",
      "varmap.kind.holding": "Holding (4x)",
      "varmap.kind.input": "Input (3x)",
      "varmap.kind.coil": "Coil (0x)",
      "varmap.kind.dinput": "Discrete in (1x)",
      "varmap.type.uint16": "UInt16",
      "varmap.type.int16": "Int16",
      "varmap.type.bit": "Bit",
      "varmap.type.int32": "Int32",
      "varmap.type.float32": "Float",
      "varmap.type.float64": "Double",
      "varmap.type.int64": "Int64",
      "varmap.type.bool": "Bool",
      "varmap.val.true": "true",
      "varmap.val.false": "false",
      "varmap.msg.reading": "Reading…",
      "varmap.msg.done": "Updated {ok} entry(ies), {fail} failed",
      "varmap.msg.updated": "{summary} · {time}",
      "varmap.msg.updatedAllOk": "{ok} ok",
      "varmap.msg.updatedWithErr": "{ok} ok, {fail} err",
      "varmap.msg.err.addr": "Address out of range",
      "varmap.msg.err.range": "Type spans past max address",
      "varmap.msg.err.kind": "Type/kind mismatch (e.g. bool on holding)",
      "varmap.msg.err.http": "Read failed (HTTP {status})",
      "varmap.msg.err.data": "Invalid response from server",
      "varmap.msg.err.unknown": "Read failed",
      "varmap.msg.saved": "Address map saved",
      "varmap.msg.saveFailed": "Failed to save address map",
      "varmap.msg.exported": "Exported {n} map entry(ies)",
      "varmap.msg.imported": "Imported {n} map entry(ies)",
      "varmap.msg.badImport": "Invalid import file (expected JSON with variables array)",
      "varmap.msg.writing": "Writing…",
      "varmap.msg.written": "Written {name}",
      "varmap.msg.writeFailed": "Write failed",
      "varmap.msg.badValue": "Invalid value for type",
      "varmap.col.valueTitle": "Edit value — Enter or leave field to write",
      "sim.export": "Export all",
      "sim.import": "Import all",
      "sim.importReplaceConfirm":
        "Replace scripts and address map with the import? Cancel = merge (overwrite same names).",
      "sim.msg.exported": "Exported {scripts} script(s) and {map} map entry(ies)",
      "sim.msg.exportedZip": "Exported simulation bundle (ZIP with .js scripts and var-map.json)",
      "sim.msg.imported": "Imported {scripts} script(s) and {map} map entry(ies), engine reloaded",
      "sim.msg.badImport": "Invalid import file (expected .zip or JSON with scripts and/or varMap/variables)",
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
        "MCP на <strong>том же порту</strong>, что веб-UI и REST API (путь <code>/mcp</code>).",
      "mcp.li4":
        "Отключить MCP: переменная окружения <code>MCP_SERVER_PORT=0</code>",
      "mcp.li5":
        "В tools адрес регистра — <strong>смещение по протоколу</strong> (0-based): <strong>40001 → addr 0</strong>, <strong>40021 → addr 20</strong>.",
      "mcp.li6":
        "Инструменты: <code>modbus_read_holding_registers</code>, <code>modbus_write_holding_registers</code> и др.",
      "mcp.configTitle": "Пример конфигурации Cursor",
      "mcp.configHint":
        "Файл <code>mcp.json</code>: в каталоге проекта <code>.cursor/mcp.json</code> или глобально <code>%USERPROFILE%\\.cursor\\mcp.json</code> (Windows). После изменения — полный перезапуск Cursor. URL совпадает с хостом и портом этой страницы.",
      "mcp.download": "Скачать mcp.json",
      "mcp.close": "Закрыть",
      "mcp.preAria": "Пример mcp.json для Cursor",
      "mcp.urlLine":
        'Текущий URL для Cursor: <code class="mcp-ai-code">{url}</code> · тот же хост, что у страницы (<code>{host}</code>), порт <strong>{port}</strong>',
      "swagger": "Swagger",
      "nav.mainAria": "Основной вид",
      "nav.modbus": "Modbus",
      "nav.variables": "Карта адресов",
      "nav.scripts": "Правила симуляции",
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
      "scripts.new": "Новый",
      "scripts.save": "Сохранить",
      "scripts.reload": "Перезагрузить движок",
      "scripts.delete": "Удалить",
      "scripts.files": "Файлы",
      "scripts.listEmpty": "Нет скриптов на диске — создайте новый или проверьте, что сервер запущен",
      "scripts.editorAria": "Исходный код скрипта",
      "scripts.disabled":
        "Скрипты симуляции отключены на сервере (SIM_SCRIPTS_DISABLE или ошибка запуска движка).",
      "scripts.promptName": "Имя файла (например my-sim.js):",
      "scripts.fileName": "Файл",
      "scripts.namePlaceholder": "my-sim.js",
      "scripts.unsaved": "Есть несохранённые изменения — сохранить или отменить?",
      "scripts.msg.loading": "Загрузка скриптов…",
      "scripts.msg.loaded": "Загружен · {name}",
      "scripts.msg.saved": "Сохранено · {name}",
      "scripts.msg.savedReload": "Сохранено и перезагружено · {name}",
      "scripts.msg.reloaded": "Скрипты перезагружены в движке",
      "scripts.msg.deleted": "Удалено · {name}",
      "scripts.msg.newDraft": "Новый скрипт — введите имя файла и нажмите «Сохранить»",
      "scripts.msg.nameRequired": "Укажите имя файла (должно заканчиваться на .js)",
      "scripts.msg.noSelection": "Выберите или создайте скрипт",
      "scripts.msg.badName": "Имя должно заканчиваться на .js (буквы, цифры, - _ .)",
      "scripts.msg.confirmDelete": "Удалить {name}?",
      "scripts.syntaxError": "Строка {line}: {message}",
      "scripts.syntaxErrorSave": "Исправьте синтаксическую ошибку перед сохранением (строка {line})",
      "scripts.export": "Экспорт",
      "scripts.import": "Импорт",
      "scripts.importReplaceConfirm":
        "Заменить все существующие скрипты импортом? Отмена = объединить (перезапись одноимённых).",
      "scripts.msg.exported": "Экспортировано скриптов: {n}",
      "scripts.msg.nothingToExport": "Нет скриптов для экспорта",
      "scripts.msg.imported": "Импортировано: {n}, движок перезагружен",
      "scripts.msg.badImport": "Некорректный файл (ожидается .js, .zip или JSON с массивом scripts)",
      "varmap.add": "Добавить в карту",
      "varmap.refresh": "Обновить",
      "varmap.export": "Экспорт",
      "varmap.import": "Импорт",
      "varmap.importReplaceConfirm":
        "Заменить всю карту адресов импортом? Отмена = объединить (перезапись одноимённых).",
      "varmap.delete": "Удалить",
      "varmap.empty": "Карта адресов пуста — нажмите «Добавить в карту».",
      "varmap.tableAria": "Карта адресов",
      "varmap.placeholder.name": "Имя",
      "varmap.col.name": "Имя",
      "varmap.col.kind": "Область",
      "varmap.col.addr": "Адрес",
      "varmap.col.type": "Тип",
      "varmap.col.bit": "Бит",
      "varmap.col.bitTitle": "Номер бита 0…15 (LSB = b0)",
      "varmap.col.order": "Порядок",
      "varmap.col.value": "Значение",
      "varmap.col.actions": "Действия",
      "varmap.kind.holding": "Holding (4x)",
      "varmap.kind.input": "Input (3x)",
      "varmap.kind.coil": "Coil (0x)",
      "varmap.kind.dinput": "Discrete in (1x)",
      "varmap.type.uint16": "UInt16",
      "varmap.type.int16": "Int16",
      "varmap.type.bit": "Бит",
      "varmap.type.int32": "Int32",
      "varmap.type.float32": "Float",
      "varmap.type.float64": "Double",
      "varmap.type.int64": "Int64",
      "varmap.type.bool": "Bool",
      "varmap.val.true": "true",
      "varmap.val.false": "false",
      "varmap.msg.reading": "Чтение…",
      "varmap.msg.done": "Обновлено: {ok}, ошибок: {fail}",
      "varmap.msg.updated": "{summary} · {time}",
      "varmap.msg.updatedAllOk": "{ok} ok",
      "varmap.msg.updatedWithErr": "{ok} ok, {fail} err",
      "varmap.msg.err.addr": "Адрес вне допустимого диапазона",
      "varmap.msg.err.range": "Тип выходит за предел max address",
      "varmap.msg.err.kind": "Несовместимы тип и область (напр. bool на holding)",
      "varmap.msg.err.http": "Ошибка чтения (HTTP {status})",
      "varmap.msg.err.data": "Некорректный ответ сервера",
      "varmap.msg.err.unknown": "Ошибка чтения",
      "varmap.msg.saved": "Карта адресов сохранена",
      "varmap.msg.saveFailed": "Не удалось сохранить карту адресов",
      "varmap.msg.exported": "Экспортировано записей карты: {n}",
      "varmap.msg.imported": "Импортировано записей карты: {n}",
      "varmap.msg.badImport": "Некорректный файл (ожидается JSON с массивом variables)",
      "varmap.msg.writing": "Запись…",
      "varmap.msg.written": "Записано: {name}",
      "varmap.msg.writeFailed": "Ошибка записи",
      "varmap.msg.badValue": "Некорректное значение для типа",
      "varmap.col.valueTitle": "Измените значение — Enter или выход из поля для записи",
      "sim.export": "Экспорт всего",
      "sim.import": "Импорт всего",
      "sim.importReplaceConfirm":
        "Заменить скрипты и карту адресов импортом? Отмена = объединить (перезапись одноимённых).",
      "sim.msg.exported": "Экспорт: {scripts} скрипт(ов), {map} записей карты",
      "sim.msg.exportedZip": "Экспорт: ZIP с .js скриптами и var-map.json",
      "sim.msg.imported": "Импорт: {scripts} скрипт(ов), {map} записей карты, движок перезагружен",
      "sim.msg.badImport": "Некорректный файл (ожидается .zip или JSON с scripts и/или varMap/variables)",
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
