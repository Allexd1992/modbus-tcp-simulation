(function () {
  var KEYWORDS = {
    function: 1,
    var: 1,
    let: 1,
    const: 1,
    if: 1,
    else: 1,
    return: 1,
    for: 1,
    while: 1,
    do: 1,
    switch: 1,
    case: 1,
    break: 1,
    continue: 1,
    new: 1,
    true: 1,
    false: 1,
    null: 1,
    undefined: 1,
    this: 1,
    typeof: 1,
    throw: 1,
    try: 1,
    catch: 1,
    finally: 1,
  };

  function esc(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function span(cls, s) {
    return '<span class="' + cls + '">' + esc(s) + "</span>";
  }

  function readString(code, i, quote) {
    var out = quote;
    i += 1;
    while (i < code.length) {
      var ch = code[i];
      out += ch;
      i += 1;
      if (ch === "\\" && i < code.length) {
        out += code[i];
        i += 1;
        continue;
      }
      if (ch === quote) break;
    }
    return { text: out, next: i };
  }

  function highlightJavaScript(code) {
    var out = [];
    var i = 0;
    var len = code.length;

    while (i < len) {
      var rest = code.slice(i);
      var ch = code[i];

      if (ch === "\r") {
        out.push(ch);
        i += 1;
        continue;
      }

      if (/\s/.test(ch)) {
        var ws = rest.match(/^\s+/)[0];
        out.push(esc(ws));
        i += ws.length;
        continue;
      }

      if (rest.indexOf("//") === 0) {
        var line = rest.match(/^\/\/[^\n\r]*/)[0];
        out.push(span("hl-cmt", line));
        i += line.length;
        continue;
      }

      if (rest.indexOf("/*") === 0) {
        var end = rest.indexOf("*/");
        var block = end === -1 ? rest : rest.slice(0, end + 2);
        out.push(span("hl-cmt", block));
        i += block.length;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === "`") {
        var str = readString(code, i, ch);
        out.push(span("hl-str", str.text));
        i = str.next;
        continue;
      }

      var num = rest.match(/^(?:0x[\da-fA-F]+|\d+\.\d*(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\d+)/);
      if (num) {
        out.push(span("hl-num", num[0]));
        i += num[0].length;
        continue;
      }

      var id = rest.match(/^[a-zA-Z_$][\w$]*/);
      if (id) {
        var word = id[0];
        if (word === "modbus") out.push(span("hl-modbus", word));
        else if (word === "map") out.push(span("hl-map", word));
        else if (KEYWORDS[word]) out.push(span("hl-kw", word));
        else out.push(esc(word));
        i += word.length;
        continue;
      }

      out.push(esc(ch));
      i += 1;
    }

    return out.join("");
  }

  function cleanSyntaxMessage(msg) {
    return String(msg || "")
      .replace(/^SyntaxError:\s*/i, "")
      .trim();
  }

  function locateSyntaxError(code) {
    var lines = code.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var prefix = lines.slice(0, i + 1).join("\n");
      try {
        new Function(prefix);
      } catch (e) {
        try {
          new Function(lines[i]);
        } catch (eLine) {
          return {
            ok: false,
            line: i + 1,
            column: 1,
            message: cleanSyntaxMessage(eLine.message),
          };
        }
        return {
          ok: false,
          line: i + 1,
          column: 1,
          message: cleanSyntaxMessage(e.message),
        };
      }
    }
    return { ok: true };
  }

  function validateJavaScript(code) {
    if (!code || !code.trim()) return { ok: true };
    try {
      new Function(code);
      return { ok: true };
    } catch (e) {
      var located = locateSyntaxError(code);
      if (located.ok) {
        return {
          ok: false,
          line: 1,
          column: 1,
          message: cleanSyntaxMessage(e.message),
        };
      }
      return located;
    }
  }

  function highlightLineWithError(line, column) {
    var col = column > 0 ? column : 0;
    if (col > 0 && col <= line.length) {
      var before = highlightJavaScript(line.slice(0, col - 1));
      var at = highlightJavaScript(line.slice(col - 1, col));
      var after = highlightJavaScript(line.slice(col));
      return before + '<span class="hl-err-col">' + at + "</span>" + after;
    }
    return highlightJavaScript(line);
  }

  function highlightJavaScriptWithErrors(code, err) {
    if (!err || err.ok) return highlightJavaScript(code);
    var lines = code.split("\n");
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var lineNo = i + 1;
      var lineHtml =
        lineNo === err.line
          ? highlightLineWithError(lines[i], err.column)
          : highlightJavaScript(lines[i]);
      if (lineNo === err.line) {
        out.push('<span class="hl-err-line">' + lineHtml + "</span>");
      } else {
        out.push(lineHtml);
      }
      if (i < lines.length - 1) out.push("\n");
    }
    return out.join("");
  }

  function attach(textarea) {
    if (!textarea || textarea.dataset.hlAttached === "1") {
      return { refresh: function () {} };
    }
    textarea.dataset.hlAttached = "1";

    var wrap = textarea.parentElement;
    if (!wrap || !wrap.classList.contains("script-editor-wrap")) {
      wrap = document.createElement("div");
      wrap.className = "script-editor-wrap";
      textarea.parentNode.insertBefore(wrap, textarea);
      wrap.appendChild(textarea);
    }

    var pre = wrap.querySelector(".script-editor-highlight");
    var code;
    if (!pre) {
      pre = document.createElement("pre");
      pre.className = "script-editor-highlight";
      pre.setAttribute("aria-hidden", "true");
      code = document.createElement("code");
      pre.appendChild(code);
      wrap.insertBefore(pre, textarea);
    } else {
      code = pre.querySelector("code") || pre;
    }

    var lastValidation = { ok: true };
    var validateTimer = null;

    function paint() {
      var v = textarea.value;
      code.innerHTML =
        highlightJavaScriptWithErrors(v, lastValidation) +
        (v.endsWith("\n") ? "" : "\n");
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
      wrap.classList.toggle("script-editor-has-error", !lastValidation.ok);
    }

    function runValidation() {
      lastValidation = validateJavaScript(textarea.value);
      paint();
      textarea.dispatchEvent(
        new CustomEvent("apcs-script-validate", {
          bubbles: true,
          detail: lastValidation,
        })
      );
    }

    function refresh() {
      if (validateTimer) clearTimeout(validateTimer);
      validateTimer = setTimeout(runValidation, 200);
      paint();
    }

    textarea.addEventListener("input", refresh);
    textarea.addEventListener("scroll", function () {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    });
    runValidation();

    return {
      refresh: function () {
        runValidation();
      },
      getValidation: function () {
        return lastValidation;
      },
    };
  }

  window.APCS_SCRIPT_HIGHLIGHT = {
    attach: attach,
    validate: validateJavaScript,
  };
})();
