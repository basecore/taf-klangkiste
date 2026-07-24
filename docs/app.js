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
  optCue: document.getElementById('optCue')
};

let toniesDB = {};
let currentFile = null;
let currentCoverBlob = null;

async function init() {
  try {
    els.dbStatus.textContent = "Lade DB...";
    const res = await fetch(TONIES_DB_URL);
    const data = await res.json();
    data.forEach(item => {
      if (item.data) {
        item.data.forEach(entry => {
          if (entry.ids) {
            entry.ids.forEach(idObj => {
              if (idObj.hash) toniesDB[idObj.hash.toLowerCase()] = entry;
            });
          }
        });
      }
    });
    els.dbStatus.textContent = `DB geladen (${Object.keys(toniesDB).length} Hashes)`;
    els.dbStatus.className = "badge success";
  } catch (err) {
    els.dbStatus.textContent = "DB Fehler";
  }
}
init();

els.pickBtn.onclick = () => els.fileInput.click();
els.fileInput.onchange = e => handleFile(e.target.files[0]);

els.dropzone.ondragover = e => { e.preventDefault(); els.dropzone.classList.add('dragover'); };
els.dropzone.ondragleave = () => els.dropzone.classList.remove('dragover');
els.dropzone.ondrop = e => {
  e.preventDefault();
  els.dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
};

async function handleFile(file) {
  if (!file) return;
  currentFile = file;
  els.fileName.textContent = file.name;
  els.convertBtn.disabled = false;
  els.status.textContent = "Berechne Hash...";
  
  const slice = file.slice(HEADER_SIZE, HEADER_SIZE + 10 * 1024 * 1024);
  const buffer = await slice.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const currentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  lookupMetadata(currentHash, file.name);
}

async function lookupMetadata(hash, filename) {
  const meta = toniesDB[hash];
  currentCoverBlob = null;
  els.coverPreview.style.display = 'none';

  if (meta) {
    els.status.textContent = "Tonie erkannt!";
    els.metaTitle.value = meta.title || meta.episode || "";
    els.metaAlbum.value = meta.series || "";
    if (meta.pic) {
      try {
        els.status.textContent = "Lade Cover...";
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(meta.pic)}`;
        const imgRes = await fetch(proxyUrl);
        if (imgRes.ok) {
          currentCoverBlob = await imgRes.blob();
          els.coverPreview.style.backgroundImage = `url(${URL.createObjectURL(currentCoverBlob)})`;
          els.coverPreview.style.display = 'block';
        }
      } catch (e) { console.warn("Cover Download fehlgeschlagen"); }
    }
  } else {
    els.status.textContent = "Unbekannter Hash";
    els.metaTitle.value = filename.replace('.taf', '');
    els.metaAlbum.value = "Unbekannt";
  }
  els.status.textContent = "Bereit zur Konvertierung";
}

els.convertBtn.onclick = async () => {
  els.convertBtn.disabled = true;
  els.downloadArea.innerHTML = '';
  
  try {
    const { createFFmpeg } = FFmpeg;
    const ffmpeg = createFFmpeg({
      log: false,
      progress: ({ ratio }) => {
        const pct = Math.min(100, Math.round(ratio * 100));
        els.progressBar.style.width = `${pct}%`;
        els.progressText.textContent = `Konvertiere: ${pct}%`;
      }
    });
    
    els.progressText.textContent = "Initialisiere FFmpeg Engine...";
    await ffmpeg.load();

    els.progressText.textContent = "Lese Audio-Payload...";
    const audioPayload = currentFile.slice(HEADER_SIZE);
    const audioBuffer = await audioPayload.arrayBuffer();
    ffmpeg.FS('writeFile', 'input.ogg', new Uint8Array(audioBuffer));

    const format = els.optFormat.value;
    const bitrate = els.optBitrate.value;
    const outFile = `output.${format}`;
    let args = ['-y', '-i', 'input.ogg'];

    if (els.optCover.value === 'yes' && currentCoverBlob) {
      ffmpeg.FS('writeFile', 'cover.jpg', new Uint8Array(await currentCoverBlob.arrayBuffer()));
      args.push('-i', 'cover.jpg', '-map', '0:a', '-map', '1:v', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic');
    } else {
      args.push('-map', '0:a');
    }

    if (format === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
    else if (format === 'm4a') args.push('-c:a', 'aac', '-b:a', bitrate);
    else args.push('-c:a', 'libopus', '-b:a', bitrate);

    args.push('-metadata', `title=${els.metaTitle.value}`, '-metadata', `album=${els.metaAlbum.value}`, '-metadata', `comment=${els.metaDesc.value}`, outFile);

    els.status.textContent = "Konvertiere...";
    await ffmpeg.run(...args);

    const data = ffmpeg.FS('readFile', outFile);
    const finalFilename = `${els.metaAlbum.value ? els.metaAlbum.value + ' - ' : ''}${els.metaTitle.value}.${format}`.replace(/[/\\?%*:|"<>]/g, '-');
    createDownloadLink(new Blob([data.buffer], { type: `audio/${format}` }), finalFilename, `📥 Download ${format.toUpperCase()}`);

    if (els.optCue.value === 'yes') {
      const cueText = `REM GENERATED BY TAF KLANGKISTE\nTITLE "${els.metaTitle.value}"\nPERFORMER "${els.metaAlbum.value}"\nFILE "${finalFilename}" ${format.toUpperCase()}\n  TRACK 01 AUDIO\n    TITLE "Kapitel 1"\n    INDEX 01 00:00:00\n`;
      createDownloadLink(new Blob([cueText], { type: 'text/plain' }), finalFilename.replace(`.${format}`, '.cue'), `📄 Download CUE`);
    }

    els.status.textContent = "Fertiggestellt!";
    els.progressBar.style.width = '100%';
    els.progressText.textContent = "Erfolgreich abgeschlossen.";

  } catch (err) {
    els.status.textContent = "Fehler aufgetreten";
    els.progressText.textContent = `Fehler: ${err.message || err}`;
  } finally {
    els.convertBtn.disabled = false;
  }
};

function createDownloadLink(blob, filename, text) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.className = 'btn primary'; a.textContent = text;
  els.downloadArea.appendChild(a);
}