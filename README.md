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
- **Nachbau** mit eigenem Canvas-Renderer (keine fremden Rahmengrafiken):
  - Rahmenstil passend zum Original: Modern (2015+), Modern (2003–2014), Retro 1997, Retro 1993 – oder manuell wählbar.
  - Farben: Mono, Gold, Hybrid (geteilter Rahmen), Artefakt, farbige Artefakte, Länder (mit Farbakzent), farblos, Vehikel.
  - Legendary-Krone, P/T-Box, Planeswalker (Loyalitätskosten + Startloyalität), doppelseitige Karten (Seite wählbar),
    Standardländer (großes Manasymbol), Holo-Siegel, Randfarbe (schwarz/weiß/silber/gold).
  - Set-Symbol von Scryfall in Seltenheitsfarbe; Sammlerinfo im jeweiligen Stil.
- **Textsatz**: automatische Schriftgröße (größte, die passt), vertikale Zentrierung,
  Mana-Symbole im Text, kursive Fähigkeitswörter und Reminder-Texte, typografische Anführungszeichen,
  Flavor-Trennlinie, P/T-Box wird umflossen. Alle Abstände (Zeilenabstand, Absatzabstand,
  Symbolgröße, Positionen) sind an Scans echter Karten vermessen und relativ zur Versalhöhe definiert,
  sodass der Satz auch mit anderen Schriften passt.
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

Alle Abhängigkeiten liegen lokal im Image. Der Browser spricht nur mit dem lokalen Server;
dieser lädt Kartendaten, Artworks und Symbole von Scryfall und cached sie im Volume `cardmaker-data`.

Für den geplanten Upscaling-Schritt ist `GET /api/art/:id` der Einhängepunkt.

## Hinweise

- Der Kartentext ist der aktuelle **Oracle-Text** von Scryfall (für englische Drucke liefert Scryfall
  keinen Originaldrucktext), d. h. ältere Karten zeigen die heutige Formulierung.
- Ohne die Originalschriften (Beleren, MPlantin) werden Ersatzschriften verwendet; der Regeltext wird dann
  leicht gestaucht, damit Zeilenumbrüche möglichst wie im Original fallen.
- Die Fußzeile rechts unten ist frei wählbar (Standard: „Proxy – not for sale“).

## Lokale Entwicklung ohne Docker

```bash
cd app && npm install && npm run dev   # http://localhost:8080
```
