/** Save blobs without blocking the UI (File System Access API or deferred anchor download). */
(function () {
  function extOf(name) {
    const i = String(name || "").lastIndexOf(".");
    return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
  }

  function mimeForExt(ext) {
    if (ext === "zip") return "application/zip";
    if (ext === "js") return "application/javascript";
    if (ext === "json") return "application/json";
    return "application/octet-stream";
  }

  function pickerTypes(filename) {
    const ext = extOf(filename);
    if (!ext) return undefined;
    const mime = mimeForExt(ext);
    return [{ description: ext.toUpperCase(), accept: { [mime]: ["." + ext] } }];
  }

  function clickDownloadLink(a) {
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** Same-origin URL with Content-Disposition — works after async fetch (no user-gesture required). */
  function downloadUrl(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.style.display = "none";
    if (filename) a.download = filename;
    clickDownloadLink(a);
    return Promise.resolve(true);
  }

  function saveBlobAnchor(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    clickDownloadLink(a);
    // Do not revoke while the system Save dialog may still be open (Windows/Chrome hang).
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 120000);
    return Promise.resolve(true);
  }

  async function saveBlob(blob, filename, options) {
    filename = filename || "download.bin";
    options = options || {};
    if (
      !options.fromAsync &&
      typeof window.showSaveFilePicker === "function"
    ) {
      try {
        const opts = { suggestedName: filename };
        const types = pickerTypes(filename);
        if (types) opts.types = types;
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false;
      }
    }
    return saveBlobAnchor(blob, filename);
  }

  async function saveText(text, filename, mime, options) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    return saveBlob(blob, filename, options);
  }

  async function saveJson(obj, filename, options) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    return saveBlob(blob, filename || "export.json", options);
  }

  window.APCS_FILE_SAVE = {
    downloadUrl: downloadUrl,
    saveBlob: saveBlob,
    saveText: saveText,
    saveJson: saveJson,
  };
})();
