import os
import subprocess
import glob
import json
import hashlib
import requests
import shutil
import sys
import struct
import time
import re
from datetime import datetime

# Versuch, Playwright zu laden (für die Beschreibungen)
try:
    from playwright.sync_api import sync_playwright
    from bs4 import BeautifulSoup
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("⚠️ Warnung: Playwright nicht gefunden. Beschreibungen werden nicht live geladen.")
    print("   Bitte installieren: pip install playwright beautifulsoup4 && playwright install")

# --- KONFIGURATION ---
SOURCE_DIR = "."
OUTPUT_DIR = "klangkiste_output"
JSON_FILE = "tonies.json"  # Fallback Datei
HEADER_SIZE = 4096
OPUS_SAMPLE_RATE = 48000.0
TONIES_DB_URL = "https://raw.githubusercontent.com/toniebox-reverse-engineering/tonies-json/release/toniesV2.json"

# Automatische Tags (Keywords)
TOPIC_KEYWORDS = {
    "Weihnachten": ["weihnacht", "advent", "christmas", "nikolaus", "rentier", "krippe", "winter"],
    "Märchen":     ["märchen", "fee", "hex", "prinz", "könig", "wolf", "rotkäppchen", "grimm", "fabel"],
    "Tiere":       ["tier", "zoo", "bauernhof", "dino", "pferd", "hund", "katze", "löwe", "bär", "wal"],
    "Einschlafen": ["schlaf", "gute nacht", "träum", "sandmann", "lullaby", "ruhe", "bett"],
    "Musik":       ["lied", "sing", "musik", "song", "tanzen", "rhythmus", "orchester", "minimusiker"],
    "Lernen":      ["wissen", "lernen", "schule", "was ist was", "entdeck", "forscher", "englisch", "buchstabe", "zahl"],
    "Abenteuer":   ["abenteuer", "pirat", "räuber", "schatz", "reise", "detektiv", "drache", "ritter"],
    "Disney":      ["disney", "pixar", "micky", "minnie", "donald", "goofy"],
    "Helden":      ["held", "super", "spidey", "batman", "paw patrol", "feuerwehrmann", "ninjago"],
}


# ==========================================
# TEIL 1: SCRAPING & DATENBANK
# ==========================================

def download_db():
    print("🌐 Lade Tonie-Datenbank (V2)...", end=" ")
    try:
        r = requests.get(TONIES_DB_URL, timeout=10)
        if r.status_code == 200:
            print("OK ✓")
            return r.json()
    except:
        pass
    print("Fehler (nutze lokale Datei falls vorhanden)")
    return []


def normalize_db(json_data):
    """Wandelt die DB in ein Hash-Dictionary um."""
    db = {}
    if isinstance(json_data, list):
        for item in json_data:
            if 'article' in item and 'data' in item:
                for entry in item.get('data', []):
                    ids = entry.get('ids', [])
                    for audio_id in ids:
                        h = audio_id.get('hash')
                        if h:
                            db[h.lower()] = entry
            elif 'hash' in item:
                hashes = item.get('hash')
                if not isinstance(hashes, list):
                    hashes = [hashes]
                for h in hashes:
                    if h:
                        db[h.lower()] = item
    return db


def scrape_full_description(page, url):
    """Versucht aggressiv, die VOLLE Beschreibung von tonies.com zu holen."""
    if not url or not PLAYWRIGHT_AVAILABLE:
        return {}
    try:
        page.goto(url, timeout=20000, wait_until="domcontentloaded")
        try:
            page.get_by_role("button", name=re.compile("Alle akzeptieren|Akzeptieren")).click(timeout=1000)
        except:
            pass
        try:
            expand_btn = page.get_by_text("Mehr anzeigen", exact=False).first
            if expand_btn.is_visible():
                expand_btn.click(timeout=1000)
                time.sleep(1.0)
        except:
            pass
        soup = BeautifulSoup(page.content(), 'html.parser')
        res = {}
        json_ld = soup.find('script', type='application/ld+json')
        if json_ld:
            try:
                data = json.loads(json_ld.string)
                if isinstance(data, list):
                    data = data[0]
                if data.get('description'):
                    res['description'] = data.get('description')
            except:
                pass
        if not res.get('description'):
            m = soup.find(string=lambda t: t and "Inhalt:" in t)
            if m:
                c = m.find_parent()
                if len(c.get_text()) < 50:
                    c = c.parent
                if len(c.get_text()) < 50:
                    c = c.parent
                full_text = c.get_text(separator="\n")
                full_text = full_text.replace("Inhalt:", "").split("Titelliste")[0].strip()
                res['description'] = full_text
        all_texts = [t.get_text(strip=True) for t in soup.find_all(['span', 'div', 'p'])]
        for txt in all_texts:
            if 'Jahre' in txt and 'ab' in txt.lower() and len(txt) < 15:
                res['min_age'] = int(re.findall(r'\d+', txt)[0])
            elif txt in ['Hörspiel', 'Hörbuch', 'Musik', 'Wissen', 'Deutsch', 'Englisch']:
                if txt in ['Deutsch', 'Englisch']:
                    res['language'] = txt
                else:
                    res['genre'] = txt
        return res
    except Exception as e:
        print(f" (Scrape Fehler: {e})")
        return {}


def detect_tags(title, desc, genre=""):
    tags = []
    full_text = (str(title) + " " + str(desc) + " " + str(genre)).lower()
    for category, keywords in TOPIC_KEYWORDS.items():
        if any(k in full_text for k in keywords):
            tags.append(category)
    if genre and genre not in tags:
        tags.append(genre)
    return list(set(tags))


# ==========================================
# TEIL 2: AUDIO VERARBEITUNG
# ==========================================

def read_varint(data, offset):
    value = 0
    shift = 0
    curr = offset
    while True:
        if curr >= len(data):
            raise ValueError("EOF")
        byte = data[curr]
        curr += 1
        value |= (byte & 0x7f) << shift
        if not (byte & 0x80):
            break
        shift += 7
    return value, curr


def get_chapters_robust(filepath):
    best_chapters = []
    try:
        with open(filepath, "rb") as f:
            data = f.read(HEADER_SIZE)
        for i in range(len(data) - 2):
            if data[i] == 0x22:
                try:
                    length = data[i + 1]
                    start = i + 2
                    end = start + length
                    if end > len(data):
                        continue
                    temp = []
                    curr = start
                    while curr < end:
                        val, curr = read_varint(data, curr)
                        temp.append(val)
                    if len(temp) > len(best_chapters):
                        if all(temp[j] <= temp[j + 1] for j in range(len(temp) - 1)):
                            best_chapters = temp
                except:
                    continue
    except:
        pass
    return sorted(list(set([0] + best_chapters)))


def scan_ogg_timestamps(filepath):
    page_map = {}
    try:
        with open(filepath, "rb") as f:
            f.seek(HEADER_SIZE)
            file_size = os.fstat(f.fileno()).st_size
            while f.tell() < file_size:
                pos = f.tell()
                sig = f.read(4)
                if sig != b'OggS':
                    if not sig:
                        break
                    f.seek(pos + 1)
                    continue
                head = f.read(23)
                if len(head) < 23:
                    break
                data = struct.unpack("<BBQIIIB", head)
                granule = data[2]
                seq = data[4]
                n_segs = data[6]
                seg_table = f.read(n_segs)
                page_size = sum(seg_table)
                f.read(page_size)
                if granule != 0xFFFFFFFFFFFFFFFF:
                    page_map[seq] = granule
    except:
        pass
    return page_map


def granule_to_cue(granule):
    total_sec = granule / OPUS_SAMPLE_RATE
    m = int(total_sec // 60)
    s = int(total_sec % 60)
    f = int((total_sec - int(total_sec)) * 75)
    return f"{m:02d}:{s:02d}:{f:02d}"


def get_hash(filepath):
    try:
        with open(filepath, "rb") as f:
            f.seek(HEADER_SIZE)
            return hashlib.sha1(f.read(10 * 1024 * 1024)).hexdigest()
    except:
        return None


def dl_cover(url, dest):
    try:
        r = requests.get(url, timeout=10, stream=True)
        if r.status_code == 200:
            with open(dest, 'wb') as f:
                shutil.copyfileobj(r.raw, f)
            return True
    except:
        pass
    return False


def clean_filename(name):
    name = re.sub(r'[<>:"/\\|?*]', '', str(name))
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:100]


# ==========================================
# TEIL 3: AUDIO KONVERTIERUNG
# ==========================================

def convert_audio_with_progress(audio_data, output_path, meta, cover_path=None):
    title = meta.get('title', 'Unbekannt')
    series = meta.get('series', '')
    desc = meta.get('description', '')
    age = meta.get('age', 0)
    genre = meta.get('genre', 'Hörspiel')

    cmd = [
        'ffmpeg', '-y',
        '-f', 'ogg', '-i', 'pipe:0',
    ]
    if cover_path and os.path.exists(cover_path):
        cmd += ['-i', cover_path,
                '-map', '0:a', '-map', '1:v',
                '-c:v', 'mjpeg', '-disposition:v', 'attached_pic']
    else:
        cmd += ['-map', '0:a']

    cmd += [
        '-c:a', 'libmp3lame', '-q:a', '3',
        '-metadata', f'title={title}',
        '-metadata', f'album={series}',
        '-metadata', f'comment={desc[:200] if desc else ""}',
        '-metadata', f'genre={genre}',
        '-metadata', f'date={datetime.now().year}',
        output_path
    ]

    total_size = len(audio_data)
    process = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    chunk = 65536
    sent = 0
    try:
        while sent < total_size:
            end = min(sent + chunk, total_size)
            process.stdin.write(audio_data[sent:end])
            sent = end
            perc = int(sent / total_size * 100)
            sys.stdout.write(f"\r   -> Konvertiere: {perc}%")
            sys.stdout.flush()
        process.stdin.close()
        process.wait()
        sys.stdout.write("\r   -> Konvertiere: 100% ✓ \n")
        return process.returncode == 0
    except:
        return False


# ==========================================
# TEIL 4: MAIN
# ==========================================

def main():
    global PLAYWRIGHT_AVAILABLE

    print("=" * 60)
    print("  ULTIMATE TAF TO KLANGKISTE (Scrape & Convert)")
    print("=" * 60)

    taf_files = sorted(glob.glob(os.path.join(SOURCE_DIR, "*.taf")))
    if not taf_files:
        print("✗ Keine .taf Dateien gefunden!")
        input("Enter...")
        return

    raw_db = download_db()
    if not raw_db:
        print("  Suche lokale 'tonies.json'...", end=" ")
        if os.path.exists(JSON_FILE):
            with open(JSON_FILE, 'r', encoding='utf-8') as f:
                raw_db = json.load(f)
            print("Gefunden ✓")
        else:
            print("Nicht gefunden ✗")

    db = normalize_db(raw_db)

    browser = None
    page = None
    if PLAYWRIGHT_AVAILABLE:
        print("🚀 Starte Browser für Detail-Daten...")
        try:
            p = sync_playwright().start()
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
        except Exception as e:
            print(f"  (Browser Start fehlgeschlagen: {e})")
            PLAYWRIGHT_AVAILABLE = False

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    klangkiste_entries = []

    for i, taf_path in enumerate(taf_files, 1):
        filename = os.path.basename(taf_path)
        print(f"\n[{i}/{len(taf_files)}] {filename}")

        file_hash = get_hash(taf_path)
        meta = db.get(file_hash, {})

        series = meta.get('series', '')
        episode = meta.get('episode', '')
        title = f"{series} - {episode}" if series and episode else (series or episode or "Unbekannt")
        if title == "Unbekannt" and meta.get('title'):
            title = meta.get('title')

        orig_base = clean_filename(title)
        if not orig_base:
            orig_base = os.path.splitext(filename)[0]

        scraped = {}
        if page and meta.get('web'):
            if not meta.get('description') or len(meta.get('description', '')) < 20:
                print(f"  🔍 Hole Details von tonies.com...", end=" ")
                scraped = scrape_full_description(page, meta.get('web'))
                if scraped.get('description'):
                    print("Beschreibung gefunden ✓")
                else:
                    print("-")

        final_desc = scraped.get('description') or meta.get('description', '')
        final_age = scraped.get('min_age') or meta.get('age') or 0
        try:
            final_age = int(final_age)
        except:
            final_age = 0
        final_genre = scraped.get('genre') or "Hörspiel"

        convert_meta = {
            'title': title,
            'series': series,
            'description': final_desc,
            'age': final_age,
            'genre': final_genre,
        }

        mp3_path = os.path.join(OUTPUT_DIR, f"{orig_base}.mp3")
        jpg_path = os.path.join(OUTPUT_DIR, f"{orig_base}.jpg")
        cue_path = os.path.join(OUTPUT_DIR, f"{orig_base}.cue")

        has_cover = False
        if os.path.exists(jpg_path):
            has_cover = True
        elif meta.get('image') or meta.get('pic'):
            url = meta.get('image') or meta.get('pic')
            if dl_cover(url, jpg_path):
                has_cover = True

        if not os.path.exists(mp3_path):
            try:
                with open(taf_path, "rb") as f:
                    f.seek(HEADER_SIZE)
                    audio_data = f.read()
                convert_audio_with_progress(audio_data, mp3_path, convert_meta, jpg_path if has_cover else None)
            except Exception as e:
                print(f"  ✗ Fehler: {e}")
        else:
            print("  -> MP3 existiert bereits.")

        chapters = get_chapters_robust(taf_path)
        if len(chapters) > 1:
            try:
                page_map = scan_ogg_timestamps(taf_path)
                with open(cue_path, "w", encoding="utf-8") as f:
                    f.write(f'REM CREATED BY TAF CONVERTER\nTITLE "{title}"\nFILE "{os.path.basename(mp3_path)}" MP3\n')
                    track_list = meta.get('tracks') or meta.get('track-desc') or []
                    for idx, ch in enumerate(chapters):
                        ts = "00:00:00"
                        if ch > 0 and (ch - 1) in page_map:
                            ts = granule_to_cue(page_map[ch - 1])
                        t_name = track_list[idx] if idx < len(track_list) else f"Kapitel {idx + 1}"
                        f.write(f'  TRACK {idx + 1:02d} AUDIO\n    TITLE "{t_name}"\n    INDEX 01 {ts}\n')
            except:
                pass

        tags = detect_tags(title, final_desc, final_genre)
        entry = {
            "tagId": f"auto_{file_hash[:10] if file_hash else 'unknown'}",
            "name": title,
            "playlistFileNames": [os.path.basename(mp3_path)],
            "imageFileName": os.path.basename(jpg_path) if has_cover else None,
            "meta": {
                "description": final_desc,
                "age_recommendation": final_age,
                "genre": final_genre,
                "series": series,
                "runtime": meta.get('runtime', 0),
            },
            "filter_age": final_age,
            "tags": tags,
        }
        klangkiste_entries.append(entry)

    if browser:
        browser.close()

    json_out = os.path.join(OUTPUT_DIR, "klangkiste.json")
    with open(json_out, 'w', encoding='utf-8') as f:
        json.dump(klangkiste_entries, f, indent=4, ensure_ascii=False)

    print("-" * 60)
    print(f"✅ Fertig! klangkiste.json erstellt in: {OUTPUT_DIR}")
    input("Enter zum Beenden...")


if __name__ == "__main__":
    main()
