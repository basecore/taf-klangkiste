const TONIES_DB_URL = "https://raw.githubusercontent.com/toniebox-reverse-engineering/tonies-json/release/toniesV2.json";
const HEADER_SIZE = 4096;
const API_BASE = ".github/actions-api";
const GITHUB_REPO = "basecore/taf-klangkiste";

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
  debugToggle: document.getElementById("debugToggle")
};

let debugEnabled = true;
let currentFile = null;
let currentCoverBlob = null;
let currentCoverUrl = null;
let currentHash = null;
let currentMeta = null;

function log(level, msg, data = null) {
  if (!debugEnabled) return;
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  const line = `[${ts}] [${level}] ${msg}` + (data ? ` ${typeof data === "string" ? data : JSON.stringify(data)}` : "");
  const fn = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
  fn(line);
  if (document.getElementById("downloadArea")) {
    const logBox = document.getElementById("downloadArea");
    let dbg = document.getElementById("debugLogInline");
    if (!dbg) { dbg = document.createElement("div"); dbg.id = "debugLogInline"; dbg.className = "debug-box"; logBox.parentElement.appendChild(dbg); }
    const div = document.createElement("div");
    div.textContent = line;
    dbg.prepend(div);
  }
}

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.className = kind ? `status ${kind}` : "status";
  log("INFO", text);
}

function setProgress(pct, text) {
  els.progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  els.progressText.textContent = text;
}

function normalizeText(v) { return (v || "").toString().trim(); }
function normalizeKey(v) { return normalizeText(v).toLowerCase(); }
function isMeaningful(v) { return normalizeText(v).length > 0; }
function safeFileName(name) { return (name || "output").replace(/[\\/?%*:|"<>]/g, "-").trim(); }

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

let toniesByHash = {}, toniesByArticle = {}, toniesBySeries = {}, toniesByEpisode = {}, toniesByTitle = {}, toniesByAudioId = {};

function flattenToniesDB(data) {
  (Array.isArray(data) ? data : []).forEach(item => {
    const article = normalizeKey(item?.article);
    if (article) toniesByArticle[article] = item;
    if (!Array.isArray(item?.data)) return;
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
}

function bestDBMatch(filename, hash) {
  const titleKey = normalizeKey(filename.replace(/\.taf$/i, ""));
  const meta = toniesByHash[hash] || toniesByTitle[titleKey] || toniesByEpisode[titleKey] || toniesBySeries[titleKey] || toniesByArticle[titleKey];
  return { meta: meta || null, titleKey };
}

function minutesFromRuntime(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${(n / 60).toFixed(1).replace(/\.0$/, "")} Minuten`;
}

function setMetadataFields(meta, filename, hash) {
  if (!meta) {
    els.metaTitle.value = filename.replace(/\.taf$/i, "");
    els.metaAlbum.value = "Unbekannt";
    els.metaDesc.value = `Keine Tonies-DB Zuordnung gefunden. Hash: ${hash}`;
    els.metaAge.value = els.metaLanguage.value = els.metaCategory.value = els.metaRuntime.value = els.metaTracks.value = "";
    return;
  }
  els.metaTitle.value = normalizeText(meta?.title || meta?.episode || filename.replace(/\.taf$/i, ""));
  els.metaAlbum.value = normalizeText(meta?.series || meta?.album || meta?.article || "");
  els.metaDesc.value = normalizeText(meta?.description || meta?.desc || "");
  els.metaAge.value = meta?.age ? `${meta.age} Jahre` : "";
  els.metaLanguage.value = normalizeText(meta?.language || "");
  els.metaCategory.value = normalizeText(meta?.category || "");
  els.metaRuntime.value = minutesFromRuntime(meta?.runtime);
  const tracks = meta?.["track-desc"] || meta?.tracks || [];
  els.metaTracks.value = Array.isArray(tracks) ? tracks.map((t, i) => `${i + 1}. ${t}`).join("\n") : "";
}

async function loadCoverFromUrl(url) {
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`Cover HTTP ${res.status}`);
  return await res.blob();
}

function showCover(blob) {
  if (currentCoverUrl) URL.revokeObjectURL(currentCoverUrl);
  currentCoverBlob = blob;
  currentCoverUrl = URL.createObjectURL(blob);
  els.coverPreview.style.backgroundImage = `url(${currentCoverUrl})`;
  els.coverPreview.style.display = "block";
}

function cleanupUploads() {
  els.downloadArea.innerHTML = "";
  const old = document.getElementById("workflowMeta");
  if (old) old.remove();
}

function injectMetaBlock(obj) {
  const pre = document.createElement("pre");
  pre.id = "workflowMeta";
  pre.className = "debug-box";
  pre.textContent = JSON.stringify(obj, null, 2);
  els.downloadArea.parentElement.appendChild(pre);
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareReleasePayload() {
  return {
    filename: currentFile.name,
    hash: currentHash,
    title: els.metaTitle.value,
    album: els.metaAlbum.value,
    description: els.metaDesc.value,
    age: els.metaAge.value,
    language: els.metaLanguage.value,
    category: els.metaCategory.value,
    runtime: els.metaRuntime.value,
    tracks: els.metaTracks.value,
    format: els.optFormat.value,
    bitrate: els.optBitrate.value,
    cover: els.optCover.value,
    cue: els.optCue.value,
    base64: await fileToBase64(currentFile),
    source: "gitHub-actions-release"
  };
}

async function startReleaseWorkflow() {
  if (!currentFile) return;
  setProgress(10, "Bereite Release-Payload vor...");
  const payload = await prepareReleasePayload();
  injectMetaBlock(payload);
  setProgress(35, "Erzeuge Trigger-Link...");
  const info = document.createElement("div");
  info.className = "note";
  info.innerHTML = `Für die Release-Variante brauchst du eine kleine Upload-Brücke. Lege die Datei lokal als JSON ab und triggert dann per Actions-Workflow. Workflow-Datei siehe <code>.github/workflows/convert-taf-release.yml</code>.`;
  els.downloadArea.appendChild(info);
  const download = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(download);
  a.download = safeFileName(currentFile.name.replace(/\.taf$/i, "")) + ".release.json";
  a.className = "btn primary";
  a.textContent = "Payload herunterladen";
  els.downloadArea.appendChild(a);
  setProgress(100, "Payload fertig. Release-Workflow starten und Asset hochladen.");
  setStatus("Release-Payload erstellt", "success");
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
  currentHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  const match = bestDBMatch(file.name, currentHash);
  currentMeta = match.meta;
  setMetadataFields(match.meta, file.name, currentHash);
  if (match.meta?.pic || match.meta?.image || match.meta?.cover) {
    try { showCover(await loadCoverFromUrl(match.meta.pic || match.meta.image || match.meta.cover)); } catch (e) {}
  }
  setStatus(match.meta ? "Tonie erkannt!" : "Unbekannter Hash", match.meta ? "success" : "warn");
  setStatus("Bereit für Release-Upload", "success");
}

function bindEvents() {
  els.pickBtn.onclick = () => els.fileInput.click();
  els.fileInput.onchange = e => handleFile(e.target.files[0]);
  els.dropzone.ondragover = e => { e.preventDefault(); els.dropzone.classList.add("dragover"); };
  els.dropzone.ondragleave = () => els.dropzone.classList.remove("dragover");
  els.dropzone.ondrop = e => { e.preventDefault(); els.dropzone.classList.remove("dragover"); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); };
  els.convertBtn.onclick = startReleaseWorkflow;
  els.debugToggle.onclick = () => { debugEnabled = !debugEnabled; document.getElementById("debugLogInline")?.classList.toggle("hidden", !debugEnabled); };
}

async function init() {
  setProgress(0, "Warte auf Eingabe");
  setStatus("Warte auf Datei...");
  bindEvents();
  log("INFO", "App gestartet", { location: location.href });
  try {
    const db = await fetchJson(TONIES_DB_URL);
    flattenToniesDB(db);
    els.dbStatus.textContent = `DB geladen (${Object.keys(toniesByHash).length} Hashes)`;
    els.dbStatus.className = "badge success";
  } catch (e) {
    els.dbStatus.textContent = "DB Fehler";
  }
}
init();
