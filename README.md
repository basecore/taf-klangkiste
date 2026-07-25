# TAF Klangkiste PRO

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-success?logo=githubpages&logoColor=white)](https://basecore.github.io/taf-klangkiste/)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](#versionierung)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Release Workflow](https://github.com/basecore/taf-klangkiste/actions/workflows/convert-taf-release.yml/badge.svg)](https://github.com/basecore/taf-klangkiste/actions/workflows/convert-taf-release.yml)

[🚀 App öffnen](https://basecore.github.io/taf-klangkiste/) · [📦 Repository](https://github.com/basecore/taf-klangkiste) · [🐛 Issues](https://github.com/basecore/taf-klangkiste/issues) · [⚙️ Actions](https://github.com/basecore/taf-klangkiste/actions)

TAF Klangkiste PRO ist eine GitHub-Pages-WebApp, mit der du Toniebox-TAF-Dateien im Browser analysieren und für die Konvertierung über GitHub Actions vorbereiten kannst. Die eigentliche MP3-Erzeugung läuft in der **Release-Variante** auf einem GitHub-Runner und wird anschließend als Release-Asset bereitgestellt. [web:250][web:268]

## Features

- Upload per Klick oder Drag & Drop.
- Automatische Erkennung von Metadaten über die Tonies-Datenbank.
- Anzeige von Titel, Serie, Beschreibung, Alter, Sprache, Kategorie, Laufzeit und Trackliste.
- Cover-Vorschau aus der Tonies-Datenbank.
- Vorbereitung einer Release-Payload für GitHub Actions.
- MP3-Erzeugung als GitHub-Release-Asset.
- GitHub-Pages-Frontend ohne lokale Python-Installation.
- Smartphone-taugliche Oberfläche mit schmalem Layout.

## So benutzt du die App

1. Öffne die App über den Link oben.
2. Wähle eine `.taf`-Datei aus oder ziehe sie in das Upload-Feld.
3. Prüfe oder ändere Titel, Album, Beschreibung und weitere Metadaten.
4. Wähle Bitrate, Cover-Option und CUE-Option.
5. Klicke auf **Release-Job starten**.
6. Lade die erzeugte Payload als JSON herunter.
7. Lege die Payload-Datei in `release-payloads/` ab und veröffentliche einen Release oder starte den Workflow manuell.
8. GitHub Actions erzeugt daraus die MP3 und hängt sie an den Release an. [web:250][web:267][web:268]

## Unterstützte Ausgabeformate

- MP3.

In der Release-Variante ist MP3 das Zielformat, weil der Runner die Konvertierung serverseitig mit FFmpeg durchführt. [web:251][web:256]

## Für Smartphones

Die App funktioniert auch auf Smartphones, weil das Frontend leichtgewichtig ist und die Dateivorbereitung im Browser stattfindet. Auf mobilen Geräten ist der Workflow aber am besten für das Erstellen der Payload geeignet; die eigentliche Konvertierung läuft danach auf GitHub Actions. [web:236][web:237]

Beachte aber:

- Große Dateien können auf mobilen Geräten zu Speicherproblemen führen.
- Desktop-Browser sind für lange Hörspiele zuverlässiger.
- Die Release-Erzeugung selbst findet serverseitig statt und ist daher nicht vom mobilen Browser abhängig.

## Technischer Aufbau

- GitHub Pages für das Frontend.
- JavaScript für die Bedienoberfläche.
- Tonies-Datenbank für Metadaten und Cover.
- GitHub Actions für die MP3-Konvertierung.
- FFmpeg auf dem GitHub-Runner für den Audio-Export.
- GitHub Release Assets für den Download der fertigen Datei. [web:250][web:251][web:268]

## Release-Workflow

Die Release-Variante nutzt einen GitHub Actions Workflow, der eine Payload-Datei verarbeitet und daraus eine MP3 erzeugt. Der Workflow kann beim Veröffentlichen eines Releases oder per manuellem `workflow_dispatch`-Start laufen. GitHub Actions unterstützt Artefakte und Release-Uploads direkt, und Release-Uploads werden über die Action `softprops/action-gh-release` abgewickelt. [web:248][web:268][web:267]

### Ablauf

1. Die App erzeugt eine `*.release.json`-Datei mit Base64-kodierter TAF-Datei und Metadaten.
2. Diese Datei wird in `release-payloads/<tag>.release.json` abgelegt.
3. Der Workflow liest die Payload ein.
4. FFmpeg erzeugt daraus die MP3.
5. Die MP3 wird als Release-Asset veröffentlicht. [web:248][web:250][web:268]

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

.github/
└── workflows/
    └── convert-taf-release.yml

release-payloads/
└── latest.release.json
```

## Versionierung

Aktuelle Version: `1.0.0`

### Changelog

- `1.0.0` – Erste Release-Variante mit GitHub-Pages-Frontend, Metadaten-Lookup, Payload-Export und GitHub-Actions-Konvertierung.

## Hinweise

- Die Release-Konvertierung läuft nicht direkt im Browser, sondern auf GitHub Actions.
- Die WebApp dient als komfortables Frontend für Upload und Metadatenprüfung.
- Für die finale MP3 muss die Payload in `release-payloads/` bereitstehen.
- Die Tonies-Datenbank und das Cover-Fetching benötigen eine stabile Internetverbindung.
- Einige Cover-Bilder werden aus externen Quellen geladen.
- Wenn der Browser an seine Grenzen stößt, kannst du die Payload auch am Desktop erstellen und später den Release-Workflow starten.

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz.
