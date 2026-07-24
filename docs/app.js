const TONIES_DB_URL = "https://raw.githubusercontent.com/toniebox-reverse-engineering/tonies-json/release/toniesV2.json";
const HEADER_SIZE = 4096;

const els = {
  status: document.getElementById('status'),
  dbStatus: document.getElementById('dbStatus'),
  fileInput: document.getElementById('fileInput'),
  dropzone: document.getElementById('dropzone'),
  pickBtn: document.getElementById('pickBtn'),
  fileName: document.getElementById('fileName'),
  convertBtn: document.getElementById('convertBtn'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  downloadArea: document.getElementById('downloadArea'),
  metaTitle: document.getElementById('metaTitle'),
  metaAlbum: document.getElementById('metaAlbum'),
  metaDesc: document.getElementById('metaDesc'),
  coverPreview: document.getElementById('coverPreview'),
  optFormat: document.getElementById('optFormat'),
  optBitrate: document.getElementById('optBitrate'),
  optCover: document.getElementById('optCover'),
  optCue: document.getElementById('optCue'),
  engineMode: document.getElementById('engineMode'),
  engineHint: document.getElementById('engineHint'),
  engineSource: document.getElementById('engineSource'),
  engineSourceLabel: document.getElementById('engineSourceLabel'),
  forceLocalBtn: document.getElementById('forceLocalBtn'),
  debugToggle: document.getElementById('debugToggle'),
  debugLog: document.getElementById('debugLog')
};

let toniesDB = {};
let currentFile = null;
let currentCoverBlob = null;
let currentCoverUrl = null;
let engineSource = 'cdn';
let ffmpegInstance = null;
let debugEnabled = true;

function log(level, msg, data = null) {
  if (!debugEnabled) return;
  const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const line = `[${ts}] [${level}] ${msg}` + (data ? ` ${typeof data === 'string' ? data : JSON.stringify(data)}` : '');
  console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](line);
  if (els.debugLog) {
    const div = document.createElement('div');
    div.textContent = line;
    els.debugLog.prepend(div);
  }
}

function hasSharedArrayBuffer() { return typeof SharedArrayBuffer !== 'undefined'; }
function hasCrossOriginIsolation() { return window.crossOriginIsolated === true; }
function supportsWasmThreads() { return hasSharedArrayBuffer() && hasCrossOriginIsolation(); }

function updateEngineUI() {
  const threadsOk = supportsWasmThreads();
  const mode = engineSource === 'cdn' ? 'CDN' : 'Lokal';
  if (els.engineSource) els.engineSource.textContent = mode;
  if (els.engineSourceLabel) els.engineSourceLabel.textContent = `${mode} ist aktiv`;
  if (els.engineMode) els.engineMode.textContent = `Engine: ${mode}`;
  if (els.engineHint) {
    els.engineHint.textContent = threadsOk
      ? 'Thread-Modus verfuegbar.'
      : 'Kein SharedArrayBuffer. Single-Thread-/Fallback-Modus wird genutzt.';
  }
  if (els.status && !currentFile) els.status.textContent = threadsOk ? 'Bereit.' : 'Bereit ohne SharedArrayBuffer.';
}

function setStatus(text) { if (els.status) els.status.textContent = text; log('INFO', text); }
function setProgress(pct, text) { if (els.progressBar) els.progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`; if (els.progressText) els.progressText.textContent = text; log('DEBUG', text, { pct }); }

async function fetchJson(url) {
  log('INFO', 'Fetch JSON', url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function normalizeText(v) { return (v || '').toString().trim(); }
function isMeaningful(v) { return normalizeText(v).length > 0; }

async function initDb() {
  try {
    if (els.dbStatus) els.dbStatus.textContent = 'Lade DB...';
    log('INFO', 'Tonies DB Laden gestartet', TONIES_DB_URL);
    const data = await fetchJson(TONIES_DB_URL);
    const entries = Array.isArray(data) ? data : [];
    entries.forEach(item => {
      if (item && item.data) {
        item.data.forEach(entry => {
          if (entry && entry.ids) {
            entry.ids.forEach(idObj => {
              if (idObj && idObj.hash) toniesDB[idObj.hash.toLowerCase()] = entry;
            });
          }
        });
      }
    });
    const count = Object.keys(toniesDB).length;
    if (els.dbStatus) { els.dbStatus.textContent = `DB geladen (${count} Hashes)`; els.dbStatus.className = 'badge success'; }
    log('INFO', 'Tonies DB geladen', { count });
  } catch (err) {
    if (els.dbStatus) els.dbStatus.textContent = 'DB Fehler';
    log('ERROR', 'Tonies DB konnte nicht geladen werden', { message: err.message || String(err) });
  }
}

function pickFfmpegAssets() {
  const base = engineSource === 'cdn' ? 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd' : './vendor/ffmpeg';
  return { base, coreURL: `${base}/ffmpeg-core.js`, wasmURL: `${base}/ffmpeg-core.wasm`, workerURL: `${base}/ffmpeg-core.worker.js`, globalURL: `${base}/index.global.js`, indexURL: `${base}/index.js` };
}

async function ensureScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === src)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => { log('INFO', 'Script geladen', src); resolve(); };
    script.onerror = () => reject(new Error(`Script konnte nicht geladen werden: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadFfmpegLibrary() {
  if (window.FFmpeg && (window.FFmpeg.createFFmpeg || window.FFmpeg.FFmpeg)) return;
  const assets = pickFfmpegAssets();
  const candidates = [assets.globalURL, assets.indexURL];
  let lastErr = null;
  for (const src of candidates) {
    try {
      log('INFO', 'Versuche FFmpeg Library', src);
      await ensureScript(src);
      if (window.FFmpeg && (window.FFmpeg.createFFmpeg || window.FFmpeg.FFmpeg)) return;
    } catch (err) {
      lastErr = err;
      log('WARN', 'FFmpeg Library Kandidat fehlgeschlagen', { src, message: err.message || String(err) });
    }
  }
  throw lastErr || new Error('FFmpeg Bibliothek konnte nicht geladen werden.');
}

async function createFfmpegInstance() {
  if (ffmpegInstance) return ffmpegInstance;
  const api = window.FFmpeg || {};
  const assets = pickFfmpegAssets();
  const threadsOk = supportsWasmThreads();
  log('INFO', 'FFmpeg Instanz erzeugen', { engineSource, threadsOk, assets });

  if (typeof api.createFFmpeg === 'function') {
    ffmpegInstance = api.createFFmpeg({
      log: false,
      corePath: assets.coreURL,
      mainName: 'main',
      progress: ({ ratio }) => {
        const pct = Math.min(100, Math.round(ratio * 100));
        setProgress(pct, `Konvertiere: ${pct}%`);
      },
      wasmThreads: threadsOk,
      workerPath: threadsOk ? assets.workerURL : undefined
    });
    log('INFO', 'Klassische FFmpeg API verwendet');
    return { kind: 'classic', instance: ffmpegInstance };
  }

  if (typeof api.FFmpeg === 'function') {
    ffmpegInstance = new api.FFmpeg();
    log('INFO', 'Moderne FFmpeg API verwendet');
    return { kind: 'modern', instance: ffmpegInstance, loadOptions: { coreURL: assets.coreURL, wasmURL: assets.wasmURL, workerURL: threadsOk ? assets.workerURL : undefined } };
  }

  throw new Error('FFmpeg API nicht gefunden.');
}

function renderDownload(blob, filename, text) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.className = 'btn primary';
  a.textContent = text;
  a.onclick = () => setTimeout(() => URL.revokeObjectURL(url), 1500);
  els.downloadArea.appendChild(a);
  log('INFO', 'Download-Link erstellt', { filename, size: blob.size });
}

function buildGuessDescription(meta, filename, hash) {
  const parts = [];
  if (isMeaningful(meta?.title)) parts.push(`Titel: ${meta.title}`);
  if (isMeaningful(meta?.series)) parts.push(`Serie: ${meta.series}`);
  if (isMeaningful(meta?.description)) parts.push(meta.description);
  if (isMeaningful(meta?.desc)) parts.push(meta.desc);
  if (!parts.length) parts.push(`Keine Beschreibung in Tonies-DB gefunden fuer ${filename}. Hash: ${hash}`);
  return parts.join('\n\n');
}

async function loadCoverFromUrl(url) {
  if (!url) return null;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  log('INFO', 'Lade Cover', { url, proxyUrl });
  const imgRes = await fetch(proxyUrl, { cache: 'no-store' });
  if (!imgRes.ok) throw new Error(`Cover HTTP ${imgRes.status}`);
  return await imgRes.blob();
}

function showCover(blob) {
  if (!blob) return;
  if (currentCoverUrl) URL.revokeObjectURL(currentCoverUrl);
  currentCoverBlob = blob;
  currentCoverUrl = URL.createObjectURL(blob);
  els.coverPreview.style.backgroundImage = `url(${currentCoverUrl})`;
  els.coverPreview.style.display = 'block';
  log('INFO', 'Cover angezeigt', { size: blob.size, type: blob.type });
}

async function handleFile(file) {
  if (!file) return;
  currentFile = file;
  els.fileName.textContent = file.name;
  els.convertBtn.disabled = false;
  setProgress(0, 'Berechne Hash...');
  setStatus('Datei geladen.');
  log('INFO', 'Datei ausgewählt', { name: file.name, size: file.size, type: file.type });

  const slice = file.slice(HEADER_SIZE, HEADER_SIZE + 10 * 1024 * 1024);
  const buffer = await slice.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const currentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  log('DEBUG', 'Hash berechnet', { currentHash });
  await lookupMetadata(currentHash, file.name);
}

async function lookupMetadata(hash, filename) {
  const meta = toniesDB[hash];
  log('INFO', 'Metadata Lookup', { hash, found: !!meta });

  if (currentCoverUrl) {
    URL.revokeObjectURL(currentCoverUrl);
    currentCoverUrl = null;
  }
  currentCoverBlob = null;
  els.coverPreview.style.display = 'none';
  els.coverPreview.style.backgroundImage = '';

  if (meta) {
    setStatus('Tonie erkannt!');
    const title = normalizeText(meta.title || meta.episode || filename.replace(/\.taf$/i, ''));
    const album = normalizeText(meta.series || meta.album || '');
    const description = buildGuessDescription(meta, filename, hash);

    els.metaTitle.value = title;
    els.metaAlbum.value = album;
    els.metaDesc.value = description;
    log('INFO', 'Tonies-DB Metadaten gesetzt', { title, album, descriptionPresent: isMeaningful(description) });

    const picUrl = meta.pic || meta.image || meta.cover;
    if (picUrl) {
      try {
        setStatus('Lade Cover aus Tonies-DB...');
        const blob = await loadCoverFromUrl(picUrl);
        if (blob) {
          showCover(blob);
        } else {
          log('WARN', 'Cover-Blob leer');
        }
      } catch (e) {
        log('WARN', 'Cover-Download fehlgeschlagen', { message: e.message || String(e) });
      }
    } else {
      log('WARN', 'Kein Cover in Tonies-DB gefunden', { hash });
    }
  } else {
    setStatus('Unbekannter Hash');
    els.metaTitle.value = filename.replace(/\.taf$/i, '');
    els.metaAlbum.value = 'Unbekannt';
    els.metaDesc.value = `Keine Tonies-DB Zuordnung gefunden. Hash: ${hash}`;
    log('WARN', 'Hash nicht in DB', { hash, filename });
  }

  setStatus('Bereit zur Konvertierung');
  updateEngineUI();
}

async function buildCueText() {
  const title = normalizeText(els.metaTitle.value || '');
  const album = normalizeText(els.metaAlbum.value || '');
  return `REM GENERATED BY TAF KLANGKISTE\nTITLE "${title}"\nPERFORMER "${album}"\nFILE "output" ${String(els.optFormat.value || 'mp3').toUpperCase()}\n  TRACK 01 AUDIO\n    TITLE "Kapitel 1"\n    INDEX 01 00:00:00\n`;
}

async function convertFile() {
  if (!currentFile) {
    setStatus('Bitte zuerst eine TAF-Datei auswählen.');
    return;
  }

  els.convertBtn.disabled = true;
  els.downloadArea.innerHTML = '';

  try {
    setProgress(0, 'Initialisiere FFmpeg...');
    setStatus('Pruefe Browser-Faehigkeiten...');
    log('INFO', 'Konvertierung gestartet', { file: currentFile.name, engineSource, sharedArrayBuffer: hasSharedArrayBuffer(), crossOriginIsolated: hasCrossOriginIsolation() });

    const threadsOk = supportsWasmThreads();
    if (!threadsOk) {
      setStatus('SharedArrayBuffer fehlt. Nutze kompatiblen Fallback-Modus.');
      log('WARN', 'Threading nicht verfuegbar, Fallback aktiv');
    }

    await loadFfmpegLibrary();
    const ff = await createFfmpegInstance();
    const format = els.optFormat.value;
    const bitrate = els.optBitrate.value;
    const outFile = `output.${format}`;
    const audioPayload = currentFile.slice(HEADER_SIZE);
    const audioBuffer = await audioPayload.arrayBuffer();
    log('DEBUG', 'Audio-Payload gelesen', { bytes: audioBuffer.byteLength, format, bitrate });

    if (ff.kind === 'modern') {
      const inst = ff.instance;
      setProgress(10, 'Lade FFmpeg...');
      await inst.load(ff.loadOptions);
      setProgress(20, 'Schreibe Eingabedaten...');
      await inst.writeFile('input.ogg', new Uint8Array(audioBuffer));
      if (els.optCover.value === 'yes' && currentCoverBlob) {
        const coverBytes = new Uint8Array(await currentCoverBlob.arrayBuffer());
        await inst.writeFile('cover.jpg', coverBytes);
        log('INFO', 'Cover in FFmpeg geschrieben', { bytes: coverBytes.byteLength });
      }
      const args = ['-y', '-i', 'input.ogg'];
      if (els.optCover.value === 'yes' && currentCoverBlob) {
        args.push('-i', 'cover.jpg', '-map', '0:a', '-map', '1:v', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic');
      } else {
        args.push('-map', '0:a');
      }
      if (format === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
      else if (format === 'm4a') args.push('-c:a', 'aac', '-b:a', bitrate);
      else args.push('-c:a', 'libopus', '-b:a', bitrate);
      args.push('-metadata', `title=${els.metaTitle.value}`, '-metadata', `album=${els.metaAlbum.value}`, '-metadata', `comment=${els.metaDesc.value}`, outFile);
      log('DEBUG', 'FFmpeg args', args);
      setProgress(45, 'Konvertiere...');
      await inst.exec(args);
      const data = await inst.readFile(outFile);
      const blob = new Blob([data.buffer], { type: `audio/${format}` });
      const safeName = `${(els.metaAlbum.value ? els.metaAlbum.value + ' - ' : '') + els.metaTitle.value}.${format}`.replace(/[/\\?%*:|"<>]/g, '-');
      renderDownload(blob, safeName, `📥 Download ${format.toUpperCase()}`);
      if (els.optCue.value === 'yes') {
        const cueText = await buildCueText();
        renderDownload(new Blob([cueText], { type: 'text/plain' }), safeName.replace(`.${format}`, '.cue'), '📄 Download CUE');
      }
      setProgress(100, 'Erfolgreich abgeschlossen.');
      setStatus('Fertiggestellt!');
      return;
    }

    const inst = ff.instance;
    setProgress(10, 'Lade FFmpeg...');
    await inst.load();
    setProgress(20, 'Schreibe Eingabedaten...');
    inst.FS('writeFile', 'input.ogg', new Uint8Array(audioBuffer));
    if (els.optCover.value === 'yes' && currentCoverBlob) {
      const coverBytes = new Uint8Array(await currentCoverBlob.arrayBuffer());
      inst.FS('writeFile', 'cover.jpg', coverBytes);
      log('INFO', 'Cover in FFmpeg geschrieben', { bytes: coverBytes.byteLength });
    }
    const args = ['-y', '-i', 'input.ogg'];
    if (els.optCover.value === 'yes' && currentCoverBlob) {
      args.push('-i', 'cover.jpg', '-map', '0:a', '-map', '1:v', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic');
    } else {
      args.push('-map', '0:a');
    }
    if (format === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
    else if (format === 'm4a') args.push('-c:a', 'aac', '-b:a', bitrate);
    else args.push('-c:a', 'libopus', '-b:a', bitrate);
    args.push('-metadata', `title=${els.metaTitle.value}`, '-metadata', `album=${els.metaAlbum.value}`, '-metadata', `comment=${els.metaDesc.value}`, outFile);
    log('DEBUG', 'FFmpeg args', args);
    setProgress(45, 'Konvertiere...');
    await inst.run(...args);
    const data = inst.FS('readFile', outFile);
    const blob = new Blob([data.buffer], { type: `audio/${format}` });
    const safeName = `${(els.metaAlbum.value ? els.metaAlbum.value + ' - ' : '') + els.metaTitle.value}.${format}`.replace(/[/\\?%*:|"<>]/g, '-');
    renderDownload(blob, safeName, `📥 Download ${format.toUpperCase()}`);
    if (els.optCue.value === 'yes') {
      const cueText = await buildCueText();
      renderDownload(new Blob([cueText], { type: 'text/plain' }), safeName.replace(`.${format}`, '.cue'), '📄 Download CUE');
    }
    setProgress(100, 'Erfolgreich abgeschlossen.');
    setStatus('Fertiggestellt!');
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    log('ERROR', 'Konvertierung fehlgeschlagen', { message: msg, stack: err && err.stack ? err.stack : null });
    if (msg.includes('SharedArrayBuffer') || msg.includes('crossOriginIsolated')) {
      setStatus('SharedArrayBuffer fehlt. Bitte Lokal-Modus oder einen COI-faehigen Host verwenden.');
    } else if (msg.includes('DB') || msg.includes('Tonies')) {
      setStatus('Tonies-DB Problem. Siehe Debug-Log.');
    } else {
      setStatus('Fehler aufgetreten');
    }
    setProgress(0, `Fehler: ${msg}`);
  } finally {
    els.convertBtn.disabled = false;
  }
}

function bindEvents() {
  if (els.pickBtn) els.pickBtn.onclick = () => els.fileInput.click();
  if (els.fileInput) els.fileInput.onchange = e => handleFile(e.target.files[0]);
  if (els.dropzone) {
    els.dropzone.ondragover = e => { e.preventDefault(); els.dropzone.classList.add('dragover'); };
    els.dropzone.ondragleave = () => els.dropzone.classList.remove('dragover');
    els.dropzone.ondrop = e => {
      e.preventDefault();
      els.dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };
  }
  if (els.convertBtn) els.convertBtn.onclick = convertFile;
  if (els.forceLocalBtn) els.forceLocalBtn.onclick = () => { engineSource = 'local'; ffmpegInstance = null; updateEngineUI(); setStatus('Lokal-Modus aktiviert. Bitte Engine neu laden.'); log('INFO', 'Engine Source auf lokal gesetzt'); };
  if (els.debugToggle) els.debugToggle.onclick = () => { debugEnabled = !debugEnabled; if (els.debugLog) els.debugLog.style.display = debugEnabled ? 'block' : 'none'; log('INFO', `Debug ${debugEnabled ? 'aktiv' : 'deaktiviert'}`); };
}

function initDefaults() {
  updateEngineUI();
  setProgress(0, 'Warte auf Eingabe');
  setStatus('Warte auf Datei...');
  if (els.debugLog) els.debugLog.style.display = 'block';
}

async function init() {
  initDefaults();
  bindEvents();
  log('INFO', 'App gestartet', { userAgent: navigator.userAgent, sharedArrayBuffer: hasSharedArrayBuffer(), crossOriginIsolated: hasCrossOriginIsolation(), location: location.href });
  await initDb();
  updateEngineUI();
}

init();
