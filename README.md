# TAF Klangkiste PRO

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-success?logo=githubpages&logoColor=white)](https://basecore.github.io/taf-klangkiste/)
[![Version](https://img.shields.io/badge/version-1.1.0-blue)](#versionierung)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Workflow](https://github.com/basecore/taf-klangkiste/actions/workflows/convert-taf-release.yml/badge.svg)](https://github.com/basecore/taf-klangkiste/actions/workflows/convert-taf-release.yml)

[🚀 App öffnen](https://basecore.github.io/taf-klangkiste/) · [📦 Repository](https://github.com/basecore/taf-klangkiste) · [🐛 Issues](https://github.com/basecore/taf-klangkiste/issues) · [⚙️ Actions](https://github.com/basecore/taf-klangkiste/actions)

TAF Klangkiste PRO ist eine GitHub-Pages-WebApp, mit der du Toniebox-TAF-Dateien direkt im Browser analysieren, prüfen und für die Konvertierung vorbereiten kannst. Die App nutzt die Tonies-Datenbank für Cover, Metadaten und Tracklisten und zeigt Treffer mit Hash, Audio-ID, Größe und Confidence an. Die eigentliche Konvertierung kann anschließend entweder lokal im Browser oder – je nach Workflow – über GitHub Actions erfolgen.

## Features

- Upload per Klick oder Drag & Drop.
- Automatische Metadaten-Erkennung über die Tonies-Datenbank.
- Anzeige von Titel, Serie, Episode, Beschreibung, Alter, Sprache, Kategorie, Laufzeit und Trackliste.
- Cover-Vorschau direkt aus der Tonies-Datenbank.
- Detailansicht durch Klick auf das Cover mit allen verfügbaren Metadaten.
- Hash- und Audio-ID-gestützte Trefferprüfung mit Größenvergleich.
- Warnung bei unklaren Treffern, damit keine falschen Metadaten übernommen werden.
- MP3-/M4A-Export mit eingebettetem Cover, sofern möglich.
- OGG-Durchreichen als Schnellexport.
- Optionale Erstellung von `klangkiste.json`.
- Smartphone-taugliche Oberfläche mit schmalem Layout.

## Aktueller Workflow

Der aktuelle Workflow ist schlanker als früher:

1. TAF-Dateien direkt in der WebApp laden.
2. Die App liest Hash, Header-Infos und Tonies-Metadaten aus.
3. Der passende DB-Treffer wird angezeigt, inklusive Cover und Detailinfos.
4. Du bestätigst unklare Treffer manuell, damit keine falschen Covers oder Metadaten übernommen werden.
5. Anschließend konvertierst du direkt im Browser oder exportierst die Daten für deinen weiteren Workflow.

## So benutzt du die App

1. Öffne die App über den Link oben.
2. Wähle eine `.taf`-Datei aus oder ziehe sie in das Upload-Feld.
3. Prüfe den DB-Treffer in der Vorschau.
4. Klicke auf das Cover, um alle verfügbaren Tonie-Infos zu sehen.
5. Bestätige unklare Treffer manuell, wenn Titel oder Metadaten nur ungefähr passen.
6. Wähle Ausgabeformat, Bitrate und die gewünschten Optionen.
7. Starte die Konvertierung oder lade nur JSON herunter.
8. Bei mehreren Dateien kannst du den Export als ZIP vorbereiten.

## Unterstützte Ausgabeformate

- MP3.
- M4A / AAC.
- OGG.

MP3 und M4A können mit Cover-Art versehen werden, wenn die Quelle verfügbar ist und der Browserzugriff das zulässt. OGG wird direkt übernommen und ist besonders praktisch als schneller Zwischenschritt.

## Cover und Metadaten

Die App versucht zuerst, das Cover direkt aus der Tonies-Datenbank zu laden. Wenn das externe Bild keine CORS-Freigabe hat, wird es weiterhin in der Vorschau angezeigt, aber für das Einbetten kann es je nach Browser und Quelle Einschränkungen geben. Per Klick auf das Cover öffnet sich eine Detailansicht mit Serie, Episode, Dauer, Alter, Sprache, Kategorie, Hash, Audio-ID, Größe und Trackliste.

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
- Optional GitHub Actions für einen ergänzenden Release- oder Export-Workflow.
- GitHub Release Assets für alternative Verteilungswege.

## Konvertierungslogik

Die App sucht zuerst nach einem exakten Hash-Treffer. Wenn der Hash nicht passt, werden zusätzlich Audio-ID und Dateigröße berücksichtigt, um passende Kandidaten zu finden. Unklare Treffer werden nicht automatisch übernommen, sondern müssen manuell bestätigt werden.

### Warum das wichtig ist

Die Tonies-Datenbank enthält teils alternative Inhalte und unterschiedliche Varianten eines Titels. Ein passender Name allein reicht deshalb nicht aus, um sicher zu sein, dass wirklich der richtige Tonie geladen wurde.

## GitHub Pages Setup

Diese App kann aus dem Ordner `docs/` veröffentlicht werden.

So aktivierst du sie:

1. Öffne `Settings`.
2. Gehe zu `Pages`.
3. Wähle als Quelle `Deploy from a branch`.
4. Branch: `main`.
5. Ordner: `/docs`.
6. Speichern und kurz warten.

## Projektstruktur

```text
docs/
├── index.html
├── style.css
├── app.js
└── .nojekyll

.github/
└── workflows/
    └── convert-taf-release.yml

release-payloads/
├── latest.release.json
└── .gitkeep
```

## Versionierung

Aktuelle Version: `1.1.0`

### Changelog

- `1.1.0` – Browser-Workflow überarbeitet: Cover-Vorschau, Detailansicht, Hash-/Audio-ID-Prüfung, manuelle Bestätigung unklarer Treffer und optionaler Browser-Export.
- `1.0.0` – Erste Release-Variante mit GitHub-Pages-Frontend, Metadaten-Lookup, Payload-Export und GitHub-Actions-Konvertierung.

## Hinweise

- Die App kann Metadaten und Cover direkt anzeigen, auch wenn der Download des Covers für die Einbettung wegen CORS eingeschränkt ist.
- Der Dateidialog muss immer durch eine direkte Benutzeraktion ausgelöst werden.
- Unklare Treffer solltest du bestätigen, bevor du Metadaten übernimmst.
- Wenn du den Export über GitHub Actions nutzt, bleibt der Browser-Schritt nur die Vorbereitung und Prüfung.
- Für die finale MP3 brauchst du ein passendes Cover und einen eindeutigen Datenbanktreffer.

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz.
