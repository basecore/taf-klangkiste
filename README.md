# 🎧 TAF Klangkiste Converter

Konvertiert Toniebox `.taf`-Audiodateien automatisch in **MP3-Dateien** mit vollständigen Metadaten, Cover-Artwork, Kapitel-CUE-Sheets und einer fertig importierbaren **`klangkiste.json`** für die [Klangkiste-App](https://github.com/Tonies-Community/klangkiste).

---

## ✨ Features

- **Automatische Metadaten** – lädt Titel, Serie, Beschreibung und Cover aus der offiziellen Tonie-Datenbank
- **Live-Scraping** – holt fehlende Beschreibungen direkt von `tonies.com` via Playwright
- **Kapitel-CUE-Sheets** – extrahiert Kapitelmarken aus dem TAF-Header und schreibt `.cue`-Dateien
- **Automatisches Tagging** – erkennt Themen wie `Märchen`, `Weihnachten`, `Musik`, `Lernen` etc.
- **Cover-Download** – lädt Coverbild automatisch herunter und bettet es in die MP3 ein
- **Klangkiste-JSON** – erzeugt eine importfertige `klangkiste.json` mit allen Einträgen

---

## 📋 Voraussetzungen

- Python 3.8+
- [FFmpeg](https://ffmpeg.org/download.html) muss installiert und im PATH sein
- Abhängigkeiten (siehe unten)

---

## 🚀 Installation

```bash
# 1. Repository klonen
git clone https://github.com/basecore/taf-klangkiste.git
cd taf-klangkiste

# 2. Abhängigkeiten installieren
pip install -r requirements.txt

# 3. Playwright Browser installieren (optional, für Live-Scraping)
playwright install chromium
```

---

## 🎯 Verwendung

1. Kopiere deine `.taf`-Dateien in den gleichen Ordner wie das Skript
2. Führe das Skript aus:

```bash
python taf_klangkiste.py
```

3. Das Skript erstellt automatisch einen Ordner `klangkiste_output/` mit:
   - `TitelName.mp3` – konvertierte MP3-Datei mit eingebettetem Cover
   - `TitelName.jpg` – Cover-Artwork
   - `TitelName.cue` – Kapitel-CUE-Sheet (falls Kapitel vorhanden)
   - `klangkiste.json` – importfertige JSON-Datei für die Klangkiste-App

---

## ⚙️ Konfiguration

Du kannst folgende Konstanten am Anfang des Skripts anpassen:

| Variable | Standard | Beschreibung |
|---|---|---|
| `SOURCE_DIR` | `.` | Ordner mit den `.taf`-Dateien |
| `OUTPUT_DIR` | `klangkiste_output` | Ausgabe-Ordner |
| `JSON_FILE` | `tonies.json` | Lokale Fallback-Datenbank |
| `HEADER_SIZE` | `4096` | TAF-Header-Größe in Bytes |

---

## 🗂️ Ausgabe-Struktur

```
klangkiste_output/
├── Benjamin Blümchen - Im Zoo.mp3
├── Benjamin Blümchen - Im Zoo.jpg
├── Benjamin Blümchen - Im Zoo.cue
├── Die Maus - Sachgeschichten.mp3
├── ...
└── klangkiste.json
```

### Beispiel `klangkiste.json`

```json
[
  {
    "tagId": "auto_a1b2c3d4e5",
    "name": "Benjamin Blümchen - Im Zoo",
    "playlistFileNames": ["Benjamin Blümchen - Im Zoo.mp3"],
    "imageFileName": "Benjamin Blümchen - Im Zoo.jpg",
    "meta": {
      "description": "Benjamin und Otto erleben spannende Abenteuer im Zoo...",
      "age_recommendation": 3,
      "genre": "Hörspiel",
      "series": "Benjamin Blümchen",
      "runtime": 45
    },
    "filter_age": 3,
    "tags": ["Tiere", "Abenteuer", "Hörspiel"]
  }
]
```

---

## 🔧 Abhängigkeiten

| Paket | Zweck |
|---|---|
| `requests` | Tonie-Datenbank & Cover herunterladen |
| `playwright` | Live-Scraping von tonies.com (optional) |
| `beautifulsoup4` | HTML-Parsing für Beschreibungen (optional) |
| `ffmpeg` | Audio-Konvertierung (System-Tool) |

---

## ⚠️ Hinweise

- Dieses Tool ist für den **privaten Gebrauch** mit eigenen Tonies gedacht
- Die `.taf`-Dateien sind urheberrechtlich geschützt – dieses Tool konvertiert nur Dateien, die du bereits besitzt
- Playwright und BeautifulSoup4 sind optional – ohne sie werden keine Live-Beschreibungen geladen

---

## 📄 Lizenz

MIT License – siehe [LICENSE](LICENSE)
