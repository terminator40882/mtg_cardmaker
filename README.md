# MTG Cardmaker

Web-UI, um eine Magic-Karte über Scryfall zu suchen, eine Version (Druck) mit klassischem
Rahmen auszuwählen und die Karte mit dem zugeschnittenen Artwork originalgetreu nachzubauen.

## Starten

```bash
docker compose up -d --build
```

Danach im Browser: <http://localhost:8080> (Direktlink: `http://localhost:8080/?q=Lightning%20Bolt`).

## Funktionen

- **Suche** mit Autovervollständigung, alle Drucke einer Karte inkl. Promos.
- **Nur klassische Rahmen**: Borderless, Full-Art, Extended-Art, Textless, Tokens,
  Art-Series usw. werden ausgeblendet. Optional werden Drucke mit identischem Artwork zusammengefasst.
- **Nachbau** mit eigenem Canvas-Renderer (alle Rahmen werden per Code gezeichnet, keine fremden Rahmengrafiken):
  - Rahmenstil passend zum Original: Modern (2015+), Modern (2003–2014), Retro 1997, Retro 1993 – oder manuell wählbar.
  - Spezial-Layouts (moderner Rahmen): **Planeswalker** (3 und 4 Fähigkeiten), **Saga**, **Class**, **Adventure**,
    **Split** (zwei gedrehte Hälften), **Battle** (Querformat), **Transform-DFC** (Sonne/Mond-Symbol, Rückseiten-P/T),
    **Modal DFC** (Linsen-Symbol + Lasche mit Infos zur Rückseite).
  - Rahmen-Varianten: **Snow**, **Nyx** (Verzauberungs-Kreaturen ab THB), **Devoid** (durchscheinend).
  - Farben: Mono, Gold (zweifarbig mit geteilter Innenkante), Hybrid (geteilter Rahmen), Artefakt, farbige Artefakte,
    Länder (mit Farbakzent), farblos, Vehikel.
  - Legendary-Krone (ab Dominaria 2018), P/T-Box, Standardländer (großes Manasymbol), Holo-Siegel,
    Randfarbe (schwarz/weiß/silber/gold).
  - Set-Symbol von Scryfall in Seltenheitsfarbe; Sammlerinfo im jeweiligen Stil (inkl. neuem Format ab 2023).
- **Textsatz** – an Scans echter Karten vermessen und per Pixel-Overlay geprüft (Grundlinien ±4 px):
  - Schriftgröße wie im Druck in 0,5-pt-Schritten (max. 9 pt), größte passende Größe wird gewählt.
  - Zeilenabstand 1,545 × Versalhöhe, Absatzabstand 0,62 ×, Flavor-Abstand 1,26 ×, Trennlinie.
  - Vertikal zentriert; reicht der Block bis auf Höhe der P/T-Box, rückt er nach oben (wie gedruckt).
  - Mana-Symbole im Text, kursive Fähigkeitswörter/Reminder-Texte, typografische Anführungszeichen.
- **Optionen**: Flavortext an/aus, Reminder-Text an/aus, feste Schriftgröße, Artwork zoomen/verschieben,
  Fußzeilentext, PNG-Export in 1500×2100 (600 dpi) oder 2010×2814 (≈800 dpi).

## Architektur

```
docker-compose.yml
app/
  Dockerfile
  server/            Express: Scryfall-Proxy mit Rate-Limit + Festplatten-Cache, Schriften
  public/            Web-UI (reines ES-Modul-JavaScript, kein Build-Schritt, keine CDNs)
    js/render/       Renderer: Layouts, Rahmen, Texturen, Textsatz, Set-Symbole
  fonts/             optionale eigene Schriften (siehe fonts/README.md)
```

**Was woher kommt:** Rahmen, Texturen, Leisten, Kronen, Planeswalker-/Saga-/DFC-Symbole werden vollständig
im Code erzeugt. Von Scryfall kommen zur Laufzeit nur Kartendaten, das zugeschnittene Artwork sowie Mana- und
Set-Symbole (SVG). Schriften sind freie Open-Source-Schriften aus npm.

Alle Abhängigkeiten liegen lokal im Image. Der Browser spricht nur mit dem lokalen Server;
dieser lädt Kartendaten, Artworks und Symbole von Scryfall und cached sie im Volume `cardmaker-data`.

Für den geplanten Upscaling-Schritt ist `GET /api/art/:id` der Einhängepunkt.

## Hinweise

- Der Kartentext ist der aktuelle **Oracle-Text** von Scryfall (für englische Drucke liefert Scryfall
  keinen Originaldrucktext), d. h. ältere Karten zeigen die heutige Formulierung.
- Ohne die Originalschriften (Beleren, MPlantin) werden freie Ersatzschriften verwendet. Sie wurden per
  Pixel-Korrelation gegen Kartenscans aus ~90 freien Schriften ausgewählt: **Tinos** für den Regeltext
  (Times-Klon – Times New Roman stammt von Plantin ab) und **PT Serif Bold** für Name/Typzeile. Ihre Laufweite
  wird horizontal korrigiert (×1,115 / ×1,054 kursiv / ×0,93), damit Zeilen wie im Original umbrechen.
- Beim Planeswalker liefert Scryfall das Artwork nur bis zur Typzeile; hinter dem transparenten Textfeld wird es
  gespiegelt und weichgezeichnet fortgesetzt.
- Die Fußzeile rechts unten ist frei wählbar (Standard: „Proxy – not for sale“).

## Lokale Entwicklung ohne Docker

```bash
cd app && npm install && npm run dev   # http://localhost:8080
```
