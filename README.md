# TAF Klangkiste PRO

TAF Klangkiste PRO ist eine GitHub-Pages-WebApp, mit der du Toniebox-TAF-Dateien direkt im Browser in Audioformate wie MP3, M4A oder OPUS umwandeln kannst.

## Features

- Upload per Klick oder Drag & Drop.
- Format-Auswahl: MP3, M4A, OPUS.
- Bitrate-Auswahl.
- Cover einbetten: Ja / Nein.
- CUE-Datei erzeugen: Ja / Nein.
- Metadaten automatisch aus der Tonies-Datenbank erkennen.
- Direkt-Download im Browser.
- Funktioniert ohne lokale Installation und ohne Python-Start auf dem Computer.

## So benutzt du die App

1. Öffne die GitHub-Pages-Seite.
2. Wähle eine `.taf`-Datei aus oder ziehe sie in das Upload-Feld.
3. Prüfe oder ändere Titel, Serie und Beschreibung.
4. Wähle Format, Bitrate, Cover und CUE.
5. Klicke auf **Konvertierung starten**.
6. Lade die erzeugte Datei direkt herunter.

## Unterstützte Ausgabeformate

- MP3
- M4A / AAC
- OPUS

## Hinweise

- Die Verarbeitung läuft komplett im Browser.
- Große Dateien können auf Smartphones an Speichergrenzen stoßen.
- Am zuverlässigsten funktioniert die App auf modernen Desktop-Browsern.
- Einige Cover-Bilder werden über externe Quellen geladen.

## GitHub Pages

Diese App wird über GitHub Pages aus dem `docs/`-Ordner bereitgestellt.
Lege die Seite in GitHub unter `Settings -> Pages` auf `main` und `/docs` fest.

## Projektstruktur

```text
docs/
├── index.html
├── style.css
├── app.js
└── .nojekyll
```
