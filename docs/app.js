import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import { toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const TONIES_DB_URL = "https://raw.githubusercontent.com/toniebox-reverse-engineering/tonies-json/release/toniesV2.json";
const HEADER_SIZE = 4096;
const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

const els = {
  status: document.getElementById("status"),
  dbStatus: document.getElementById("dbStatus"),
  fileInput: document.getElementById("fileInput"),
  dropzone: document.getElementById("dropzone"),
  pickBtn: document.getElementById("pickBtn"),
  fileName: document.getElementById("fileName"),
  convertBtn: document.getElementById("convertBtn"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  downloadArea: document.getElementById("downloadArea"),
  metaTitle: document.getElementById("metaTitle"),
  metaAlbum: document.getElementById("metaAlbum"),
  metaDesc: document.getElementById("metaDesc"),
  metaAge: document.getElementById("metaAge"),
  metaLanguage: document.getElementById("metaLanguage"),
  metaCategory: document.getElementById("metaCategory"),
  metaRuntime: document.getElementById("metaRuntime"),
  metaTracks: document.getElementById("metaTracks"),
  coverPreview: document.getElementById("coverPreview"),
  optFormat: document.getElementById("optFormat"),
  optBitrate: document.getElementById("optBitrate"),
  optCover: document.getElementById("optCover"),
  optCue: document.getElementById("optCue"),
  engineMode: document.getElementById("engineMode"),
  engineHint: document.getElementById("engineHint"),
  engineSource: document.getElementById("engineSource"),
  engineSourceLabel: document.getElementById("engineSourceLabel"),
  forceLocalBtn: document.getElementById("forceLocalBtn"),
  debugToggle: document.getElementById("debugToggle"),
  debugLog: document.getElementById("debugLog")
};

let debugEnabled = true;
let currentFile = null;
let currentCoverBlob = null;
let currentCoverUrl = null;
let ffmpegInstance = null;
let toniesLoadedCount = 0;

let toniesByHash = {};
let toniesByArticle = {};
let toniesBySeries = {};
let toniesByEpisode = {};
let toniesByTitle = {};
let toniesByAudioId = {};

function log(level, msg, data = null) {
  if (!debugEnabled) return;
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  const line = `[${ts}] [${level}] ${msg}` + (data ? ` ${typeof data === "string" ? data : JSON.stringify(data)}` : "");
  const fn = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
  fn(line);
  if (els.debugLog) {
    const div = document.createElement("div");
    div.textContent = line;
    els.debugLog.prepend(div);
  }
}

function setStatus(text, kind = "") {
  if (!els.status) return;
  els.status.textContent = text;
  els.status.className = kind ? `status ${kind}` : "status";
  log("INFO", text);
}

function setProgress(pct, text) {
  if (els.progressBar) els.progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (els.progressText) els.progressText.textContent = text;
  log("DEBUG", text, { pct });
}

function normalizeText(v) { return (v || "").toString().trim(); }
function normalizeKey(v) { return normalizeText(v).toLowerCase(); }
function isMeaningful(v) { return normalizeText(v).length > 0; }
function safeFileName(name) { return (name || "output").replace(/[\\/?%*:|"<>]/g, "-").trim(); }

async function fetchJson(url) {
  log("INFO", "Fetch JSON", url);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function flattenToniesDB(data) {
  const items = Array.isArray(data) ? data : [];
  items.forEach(item => {
    const article = normalizeKey(item?.article);
    if (article) toniesByArticle[article] = item;
    if (!item?.data || !Array.isArray(item.data)) return;
    item.data.forEach(entry => {
      const series = normalizeKey(entry?.series);
      const episode = normalizeKey(entry?.episode);
      const title = normalizeKey(entry?.title);
      if (series) toniesBySeries[series] = { ...item, ...entry };
      if (episode) toniesByEpisode[episode] = { ...item, ...entry };
      if (title) toniesByTitle[title] = { ...item, ...entry };
      (entry?.ids || []).forEach(idObj => {
        if (!idObj) return;
        if (idObj.hash) toniesByHash[idObj.hash.toLowerCase()] = { ...item, ...entry, _id: idObj };
        if (typeof idObj["audio-id"] !== "undefined") toniesByAudioId[String(idObj["audio-id"])] = { ...item, ...entry, _id: idObj };
      });
    });
  });
  toniesLoadedCount = Object.keys(toniesByHash).length;
}

async function initDb() {
  try {
    if (els.dbStatus) els.dbStatus.textContent = "Lade DB...";
    const data = await fetchJson(TONIES_DB_URL);
    flattenToniesDB(data);
    if (els.dbStatus) {
      els.dbStatus.textContent = `DB geladen (${toniesLoadedCount} Hashes)`;
      els.dbStatus.className = "badge success";
    }
    log("INFO", "Tonies DB geladen", {
      count: toniesLoadedCount,
      article: Object.keys(toniesByArticle).length,
      series: Object.keys(toniesBySeries).length,
      episode: Object.keys(toniesByEpisode).length,
      title: Object.keys(toniesByTitle).length,
      audioId: Object.keys(toniesByAudioId).length
    });
  } catch (err) {
    if (els.dbStatus) els.dbStatus.textContent = "DB Fehler";
    log("ERROR", "Tonies DB konnte nicht geladen werden", { message: err.message || String(err) });
  }
}

function bestDBMatch(filename, hash) {
  const titleKey = normalizeKey(filename.replace(/\.taf$/i, ""));
  let meta = toniesByHash[hash] || toniesByTitle[titleKey] || toniesByEpisode[titleKey] || toniesBySeries[titleKey] || toniesByArticle[titleKey];
  if (meta) return { meta, titleKey, source: "direct" };
  for (const [k, v] of Object.entries(toniesBySeries)) {
    if (titleKey.includes(k) || k.includes(titleKey)) return { meta: v, titleKey, source: "series-fuzzy" };
  }
  for (const [k, v] of Object.entries(toniesByEpisode)) {
    if (titleKey.includes(k) || k.includes(titleKey)) return { meta: v, titleKey, source: "episode-fuzzy" };
  }
  for (const [k, v] of Object.entries(toniesByTitle)) {
    if (titleKey.includes(k) || k.includes(titleKey)) return { meta: v, titleKey, source: "title-fuzzy" };
  }
  return { meta: null, titleKey, source: "none" };
}

function buildGuessDescription(meta, filename, hash) {
  const parts = [];
  if (isMeaningful(meta?.title)) parts.push(`Titel: ${meta.title}`);
  if (isMeaningful(meta?.series)) parts.push(`Serie: ${meta.series}`);
  if (isMeaningful(meta?.episode)) parts.push(`Episode: ${meta.episode}`);
  if (isMeaningful(meta?.description)) parts.push(meta.description);
  if (isMeaningful(meta?.desc)) parts.push(meta.desc);
  if (!parts.length) parts.push(`Keine Beschreibung in Tonies-DB gefunden fuer ${filename}. Hash: ${hash}`);
  return parts.join("\n\n");
}

function minutesFromRuntime(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Math.round(n)} Minuten`;
}

function joinTracks(meta) {
  const tracks = meta?.["track-desc"] || meta?.tracks || [];
  if (!Array.isArray(tracks) || !tracks.length) return "";
  return tracks.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

function setMetadataFields(meta, filename, hash) {
  const title = normalizeText(meta?.title || meta?.episode || filename.replace(/\.taf$/i, ""));
  const album = normalizeText(meta?.series || meta?.album || meta?.article || "");
  const description = buildGuessDescription(meta, filename, hash);
  if (els.metaTitle) els.metaTitle.value = title;
  if (els.metaAlbum) els.metaAlbum.value = album;
  if (els.metaDesc) els.metaDesc.value = description;
  if (els.metaAge) els.metaAge.value = meta?.age ? `${meta.age} Jahre` : "";
  if (els.metaLanguage) els.metaLanguage.value = normalizeText(meta?.language || "");
  if (els.metaCategory) els.metaCategory.value = normalizeText(meta?.category || "");
  if (els.metaRuntime) els.metaRuntime.value = minutesFromRuntime(meta?.runtime);
  if (els.metaTracks) els.metaTracks.value = joinTracks(meta);
}

async function loadCoverFromUrl(url) {
  if (!url) return null;
  log("INFO", "Lade Cover", { url });
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`Cover HTTP ${res.status}`);
  return await res.blob();
}

function showCover(blob) {
  if (!blob) return;
  if (currentCoverUrl) URL.revokeObjectURL(currentCoverUrl);
  currentCoverBlob = blob;
  currentCoverUrl = URL.createObjectURL(blob);
  if (els.coverPreview) {
    els.coverPreview.style.backgroundImage = `url(${currentCoverUrl})`;
    els.coverPreview.style.display = "block";
  }
}

async function ensureFfmpegLoaded() {
  if (ffmpegInstance) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm")
  ]);
  ffmpeg.on("log", ({ message }) => log("INFO", `FFmpeg: ${message}`));
  ffmpeg.on("progress", ({ progress }) => setProgress(Math.round(progress * 100), `Konvertiere: ${Math.round(progress * 100)}%`);
  await ffmpeg.load({ coreURL, wasmURL });
  ffmpegInstance = ffmpeg;
  return ffmpegInstance;
}

function renderDownload(blob, filename, text) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.className = "btn primary";
  a.textContent = text;
  a.onclick = () => setTimeout(() => URL.revokeObjectURL(url), 1500);
  els.downloadArea.appendChild(a);
}

async function buildCueText() {
  const title = normalizeText(els.metaTitle?.value || "");
  const album = normalizeText(els.metaAlbum?.value || "");
  return `REM GENERATED BY TAF KLANGKISTE\nTITLE "${title}"\nPERFORMER "${album}"\nFILE "output" ${String(els.optFormat.value || "mp3").toUpperCase()}\n  TRACK 01 AUDIO\n    TITLE "Kapitel 1"\n    INDEX 01 00:00:00\n`;
}

async function lookupMetadata(hash, filename) {
  const match = bestDBMatch(filename, hash);
  const meta = match.meta;
  log("INFO", "Metadata Lookup", { hash, filename, titleKey: match.titleKey, source: match.source, found: !!meta });

  if (currentCoverUrl) {
    URL.revokeObjectURL(currentCoverUrl);
    currentCoverUrl = null;
  }
  currentCoverBlob = null;
  if (els.coverPreview) {
    els.coverPreview.style.display = "none";
    els.coverPreview.style.backgroundImage = "";
  }

  if (meta) {
    setStatus("Tonie erkannt!");
    setMetadataFields(meta, filename, hash);

    const picUrl = meta.pic || meta.image || meta.cover;
    if (picUrl) {
      try {
        setStatus("Lade Cover aus Tonies-DB...");
        const blob = await loadCoverFromUrl(picUrl);
        if (blob) showCover(blob);
      } catch (e) {
        log("WARN", "Cover-Download fehlgeschlagen", { message: e.message || String(e), picUrl });
      }
    }
  } else {
    setStatus("Unbekannter Hash", "warn");
    if (els.metaTitle) els.metaTitle.value = filename.replace(/\.taf$/i, "");
    if (els.metaAlbum) els.metaAlbum.value = "Unbekannt";
    if (els.metaDesc) els.metaDesc.value = `Keine Tonies-DB Zuordnung gefunden. Hash: ${hash}`;
    if (els.metaAge) els.metaAge.value = "";
    if (els.metaLanguage) els.metaLanguage.value = "";
    if (els.metaCategory) els.metaCategory.value = "";
    if (els.metaRuntime) els.metaRuntime.value = "";
    if (els.metaTracks) els.metaTracks.value = "";
  }

  setStatus("Bereit zur Konvertierung", "success");
}

async function handleFile(file) {
  if (!file) return;
  currentFile = file;
  els.fileName.textContent = file.name;
  els.convertBtn.disabled = false;
  setProgress(0, "Berechne Hash...");
  setStatus("Datei geladen.");

  const slice = file.slice(HEADER_SIZE, HEADER_SIZE + 10 * 1024 * 1024);
  const buffer = await slice.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  const currentHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  await lookupMetadata(currentHash, file.name);
}

async function convertFile() {
  if (!currentFile) {
    setStatus("Bitte zuerst eine TAF-Datei auswählen.", "warn");
    return;
  }

  els.convertBtn.disabled = true;
  els.downloadArea.innerHTML = "";

  try {
    setProgress(0, "Initialisiere FFmpeg...");
    setStatus("Pruefe Browser-Faehigkeiten...");
    const ffmpeg = await ensureFfmpegLoaded();

    const format = els.optFormat.value;
    const bitrate = els.optBitrate.value;
    const outFile = `output.${format}`;
    const audioBuffer = await currentFile.slice(HEADER_SIZE).arrayBuffer();

    await ffmpeg.writeFile("input.ogg", new Uint8Array(audioBuffer));
    if (els.optCover.value === "yes" && currentCoverBlob) {
      const coverBytes = new Uint8Array(await currentCoverBlob.arrayBuffer());
      await ffmpeg.writeFile("cover.jpg", coverBytes);
    }

    const args = ["-y", "-i", "input.ogg"];
    if (els.optCover.value === "yes" && currentCoverBlob) {
      args.push("-i", "cover.jpg", "-map", "0:a", "-map", "1:v", "-c:v", "mjpeg", "-disposition:v", "attached_pic");
    } else {
      args.push("-map", "0:a");
    }
    if (format === "mp3") args.push("-c:a", "libmp3lame", "-b:a", bitrate);
    else if (format === "m4a") args.push("-c:a", "aac", "-b:a", bitrate);
    else args.push("-c:a", "libopus", "-b:a", bitrate);
    args.push("-metadata", `title=${els.metaTitle.value}`, "-metadata", `album=${els.metaAlbum.value}`, "-metadata", `comment=${els.metaDesc.value}`, outFile);

    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(outFile);
    const blob = new Blob([data.buffer], { type: `audio/${format}` });
    const safeName = safeFileName(`${(els.metaAlbum.value ? els.metaAlbum.value + " - " : "") + els.metaTitle.value}.${format}`);
    renderDownload(blob, safeName, `📥 Download ${format.toUpperCase()}`);

    if (els.optCue.value === "yes") {
      const cueText = await buildCueText();
      renderDownload(new Blob([cueText], { type: "text/plain" }), safeName.replace(`.${format}`, ".cue"), "📄 Download CUE");
    }

    setProgress(100, "Erfolgreich abgeschlossen.");
    setStatus("Fertiggestellt!", "success");
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    log("ERROR", "Konvertierung fehlgeschlagen", { message: msg, stack: err && err.stack ? err.stack : null });
    setStatus("Fehler aufgetreten", "error");
    setProgress(0, `Fehler: ${msg}`);
  } finally {
    els.convertBtn.disabled = false;
  }
}

function bindEvents() {
  if (els.pickBtn) els.pickBtn.onclick = () => els.fileInput.click();
  if (els.fileInput) els.fileInput.onchange = e => handleFile(e.target.files[0]);
  if (els.dropzone) {
    els.dropzone.ondragover = e => { e.preventDefault(); els.dropzone.classList.add("dragover"); };
    els.dropzone.ondragleave = () => els.dropzone.classList.remove("dragover");
    els.dropzone.ondrop = e => {
      e.preventDefault();
      els.dropzone.classList.remove("dragover");
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };
  }
  if (els.convertBtn) els.convertBtn.onclick = convertFile;
  if (els.debugToggle) els.debugToggle.onclick = () => {
    debugEnabled = !debugEnabled;
    if (els.debugLog) els.debugLog.style.display = debugEnabled ? "block" : "none";
  };
}

function initDefaults() {
  setProgress(0, "Warte auf Eingabe");
  setStatus("Warte auf Datei...");
  if (els.debugLog) els.debugLog.style.display = "block";
}

async function init() {
  initDefaults();
  bindEvents();
  log("INFO", "App gestartet", {
    userAgent: navigator.userAgent,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    crossOriginIsolated: window.crossOriginIsolated === true,
    location: location.href
  });
  await initDb();
}

init();
