# TAF Klangkiste PRO

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-success?logo=githubpages&logoColor=white)](https://basecore.github.io/taf-klangkiste/)
[![Version](https://img.shields.io/badge/version-1.2.0-blue)](#versionierung)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Workflow](https://github.com/basecore/taf-klangkiste/actions/workflows/convert-taf-release.yml/badge.svg)](https://github.com/basecore/taf-klangkiste/actions/workflows/convert-taf-release.yml)

[🚀 App öffnen](https://basecore.github.io/taf-klangkiste/) · [📦 Repository](https://github.com/basecore/taf-klangkiste) · [🐛 Issues](https://github.com/basecore/taf-klangkiste/issues) · [⚙️ Actions](https://github.com/basecore/taf-klangkiste/actions)

TAF Klangkiste PRO ist eine GitHub-Pages-WebApp, mit der du Toniebox-TAF-Dateien direkt im Browser analysieren, prüfen und konvertieren kannst. Die App liest die TAF-Datei lokal im Browser ein, vergleicht den Audio-Hash mit der Tonies-Datenbank, zeigt passende Metadaten an und kann die Audio-Daten anschließend im Browser exportieren.

## App benutzen

1. Öffne die App über den Link oben.
2. Wähle eine oder mehrere `.taf`-Dateien aus oder ziehe sie per Drag & Drop in das Upload-Feld.
3. Warte, bis die App die Datei analysiert und den passenden Tonie-Eintrag sucht.
4. Prüfe Cover, Titel, Serie, Episode, Laufzeit, Trackliste und weitere Metadaten.
5. Klicke auf das Cover, um die vollständige Detailansicht zu öffnen.
6. Bestätige unklare Treffer manuell, bevor du Metadaten übernimmst.
7. Wähle Ausgabeformat, Bitrate und gewünschte Optionen.
8. Starte die Konvertierung oder lade nur die JSON-Daten herunter.

## Was die App macht

Die App arbeitet vollständig im Browser und nutzt dabei lokale Dateidaten, die Tonies-Datenbank und optional FFmpeg.wasm für den Export. Beim Einlesen wird die TAF-Datei ab dem Audio-Bereich untersucht, damit Hash, Audio-ID und Dateigröße mit den DB-Einträgen abgeglichen werden können. Danach werden Cover, Trackliste und weitere Metadaten in der Vorschau angezeigt.

## Features

- Upload per Klick oder Drag & Drop.
- Lokale Analyse der TAF-Datei im Browser.
- Hash-Prüfung des Audio-Teils ab Header-Ende.
- Vergleich mit Tonies-DB über Hash, Audio-ID und Größe.
- Anzeige von Titel, Serie, Episode, Beschreibung, Alter, Sprache, Kategorie, Laufzeit und Trackliste.
- Cover-Vorschau direkt aus der Tonies-Datenbank.
- Detailansicht beim Klick auf das Cover.
- Warnung bei unklaren Treffern.
- MP3-/M4A-Export mit eingebettetem Cover, sofern möglich.
- OGG-Durchreichen als Schnellexport.
- Optionale Erstellung von `klangkiste.json`.
- Smartphone-taugliche Oberfläche.

## Datenquellen und Zugriff

Die App greift im Wesentlichen auf drei Dinge zu:

1. **Lokale TAF-Datei**: Die Datei wird direkt im Browser gelesen. Die App extrahiert daraus den Audio-Teil, berechnet den SHA-1-Hash und versucht, Header-Informationen auszulesen.
2. **Tonies-Datenbank**: Die WebApp lädt die Tonies-DB aus dem öffentlichen Repository `toniebox-reverse-engineering/tonies-json`. Dort werden Hash, Audio-ID, Größe, Tracks, Cover-URL, Web-Link und weitere Metadaten gesucht.
3. **FFmpeg.wasm**: Für die Konvertierung wird der Audio-Inhalt im Browser verarbeitet. Bei MP3 und M4A kann zusätzlich ein Cover eingebettet werden, wenn die Bildquelle verfügbar ist.

## So wird der Tonie gefunden

Die App versucht den Treffer schrittweise zu bestimmen:

1. Zuerst wird der SHA-1-Hash des Audio-Bereichs der TAF-Datei berechnet.
2. Dieser Hash wird in der Tonies-Datenbank nachgeschlagen.
3. Wenn kein exakter Treffer vorhanden ist, werden weitere Hinweise geprüft, zum Beispiel die `audio-id` und die Dateigröße.
4. Wenn mehrere Kandidaten ähnlich wirken, wird der Treffer als unsicher markiert.
5. Unsichere Treffer müssen manuell bestätigt werden, damit keine falschen Cover oder Metadaten übernommen werden.

Dieses Verhalten ist wichtig, weil die Tonies-Datenbank teils alternative Inhalte oder verschiedene Varianten eines Titels enthält.

## Detailansicht

Wenn du auf das Cover in der Vorschau klickst, öffnet sich eine Detailansicht mit allen verfügbaren Informationen aus der Tonies-Datenbank. Dazu gehören unter anderem:

- Serie.
- Episode.
- Dauer.
- Altersempfehlung.
- Sprache.
- Kategorie.
- Hash.
- Audio-ID.
- Dateigröße.
- Trackliste.
- Web-Link zum Tonies-Eintrag.

## Unterstützte Ausgabeformate

- MP3.
- M4A / AAC.
- OGG.

MP3 und M4A können mit Cover-Art versehen werden, wenn die Quelle verfügbar ist und der Browserzugriff das zulässt. OGG wird direkt übernommen und ist besonders praktisch als schneller Zwischenschritt.

## Für Smartphones

Die App funktioniert auch auf Smartphones, weil das Frontend leichtgewichtig ist und die Dateiverarbeitung direkt im Browser stattfindet. Für längere Hörspiele ist ein Desktop-Browser trotzdem oft angenehmer, vor allem wenn mehrere Dateien oder große Exporte anstehen.

Beachte aber:

- Große Dateien können auf mobilen Geräten zu Speicherproblemen führen.
- Der Dateiauswahldialog muss immer durch eine echte Benutzeraktion geöffnet werden.
- Externe Cover können je nach Browser und Quelle nicht für das Einbetten, aber trotzdem für die Vorschau verfügbar sein.

## Technischer Aufbau

- GitHub Pages für das Frontend.
- JavaScript für die Bedienoberfläche.
- Tonies-Datenbank für Metadaten, Cover und Tracklisten.
- FFmpeg.wasm für die Browser-Konvertierung.
- Optional GitHub Actions für ergänzende Workflows.

## Konvertierungslogik

Die App sucht zuerst nach einem exakten Hash-Treffer. Wenn der Hash nicht passt, werden zusätzlich Audio-ID und Dateigröße berücksichtigt, um passende Kandidaten zu finden. Unklare Treffer werden nicht automatisch übernommen, sondern müssen manuell bestätigt werden.

### Warum das wichtig ist

Die Tonies-Datenbank enthält teils alternative Inhalte und unterschiedliche Varianten eines Titels. Ein passender Name allein reicht deshalb nicht aus, um sicher zu sein, dass wirklich der richtige Tonie geladen wurde.

## Aktueller Workflow

1. TAF-Datei in die WebApp laden.
2. Die App liest den Audio-Teil, berechnet den Hash und sucht in der Tonies-DB.
3. Passende Metadaten und Cover werden angezeigt.
4. Die Detailansicht zeigt alle verfügbaren Tonie-Infos.
5. Unklare Treffer werden manuell bestätigt.
6. Danach wird exportiert oder nur eine JSON-Datei erzeugt.

## Projektstruktur

```text
/
├── index.html
├── assets/
│   └── ffmpeg/
│       ├── ffmpeg-core.js
│       ├── ffmpeg-core.wasm
│       ├── ffmpeg-core.worker.js
│       ├── worker.js
│       ├── const.js
│       └── errors.js
├── README.md
├── LICENSE
└── .nojekyll
```

## GitHub Pages Setup

Diese App wird direkt aus dem Repository-Root veröffentlicht.

So aktivierst du sie:

1. Öffne `Settings`.
2. Gehe zu `Pages`.
3. Wähle als Quelle `Deploy from a branch`.
4. Branch: `main`.
5. Ordner: `/ (root)`.
6. Speichern und kurz warten.

## Versionierung

Aktuelle Version: `1.2.0`

### Changelog

- `1.2.0` – Root-Workflow dokumentiert, Browser-Analyse erklärt, Datenzugriffe beschrieben und Detailansicht/Bestätigungslogik hervorgehoben.
- `1.1.0` – Browser-Workflow überarbeitet: Cover-Vorschau, Detailansicht, Hash-/Audio-ID-Prüfung, manuelle Bestätigung unklarer Treffer und optionaler Browser-Export.
- `1.0.0` – Erste Release-Variante mit GitHub-Pages-Frontend, Metadaten-Lookup, Payload-Export und GitHub-Actions-Konvertierung.

## Hinweise

- Metadaten und Cover können direkt angezeigt werden, auch wenn das Einbetten wegen CORS eingeschränkt sein kann.
- Der Dateidialog muss immer durch eine direkte Benutzeraktion ausgelöst werden.
- Unklare Treffer solltest du bestätigen, bevor du Metadaten übernimmst.
- Wenn du den Export über GitHub Actions nutzt, bleibt der Browser-Schritt nur die Vorbereitung und Prüfung.
- Für die finale MP3 brauchst du einen eindeutigen Datenbanktreffer und idealerweise ein passendes Cover.

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz.
