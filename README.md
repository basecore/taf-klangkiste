# TAF Klangkiste PRO

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-success?logo=githubpages&logoColor=white)](https://basecore.github.io/taf-klangkiste/)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](#versionierung)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[🚀 App öffnen](https://basecore.github.io/taf-klangkiste/) · [📦 Repository](https://github.com/basecore/taf-klangkiste) · [🐛 Issues](https://github.com/basecore/taf-klangkiste/issues)

TAF Klangkiste PRO ist eine GitHub-Pages-WebApp, mit der du Toniebox-TAF-Dateien direkt im Browser in Audioformate wie **MP3**, **M4A/AAC** oder **OPUS** umwandeln kannst.

## Features

- Upload per Klick oder Drag & Drop.
- Auswahl des Ausgabeformats.
- Auswahl der Bitrate bzw. Qualität.
- Cover einbetten: Ja / Nein.
- CUE-Datei erzeugen: Ja / Nein.
- Metadaten automatisch aus der Tonies-Datenbank erkennen.
- Manuelle Bearbeitung von Titel, Serie und Beschreibung.
- Direkter Download der erzeugten Datei im Browser.
- Läuft ohne lokale Python-Installation.

## So benutzt du die App

1. Öffne die App über den Link oben.
2. Wähle eine `.taf`-Datei aus oder ziehe sie in das Upload-Feld.
3. Prüfe oder ändere Titel, Serie und Beschreibung.
4. Wähle Format, Bitrate, Cover und CUE.
5. Klicke auf **Konvertierung starten**.
6. Lade die erzeugte Datei direkt herunter.

## Unterstützte Ausgabeformate

- MP3.
- M4A / AAC.
- OPUS.

## Für Smartphones

Die App funktioniert auch auf Smartphones, weil alles direkt im Browser läuft.

Beachte aber:
- Große Dateien können auf mobilen Geräten zu Speicherproblemen führen.
- Desktop-Browser sind für lange Hörspiele meist zuverlässiger.
- Moderne Android-Browser funktionieren in der Regel besser als iOS bei großen Dateien.

## Technischer Aufbau

- GitHub Pages für das Frontend.
- JavaScript für die Bedienoberfläche.
- FFmpeg.wasm für die Umwandlung im Browser.
- Tonies-Datenbank für Metadaten und Cover.

## GitHub Pages Setup

Diese App wird aus dem Ordner `docs/` veröffentlicht.

So aktivierst du sie:
1. Öffne `Settings`.
2. Gehe zu `Pages`.
3. Wähle als Quelle `Deploy from a branch`.
4. Branch: `main`.
5. Ordner: `/docs`.

## Projektstruktur

```text
docs/
├── index.html
├── style.css
├── app.js
└── .nojekyll
```

## Versionierung

Aktuelle Version: `1.0.0`

### Changelog

- `1.0.0` – Erste browserbasierte GitHub-Pages-Version mit Upload, Optionen, Metadaten, Cover-Support und Download.

## Hinweise

- Die Konvertierung läuft vollständig im Browser.
- Die App benötigt eine stabile Internetverbindung für die Tonies-Datenbank und das FFmpeg-WASM-Laden.
- Bei sehr großen Dateien kann der Browser an seine Grenzen kommen.
- Einige Cover-Bilder werden über externe Quellen geladen.

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz.
