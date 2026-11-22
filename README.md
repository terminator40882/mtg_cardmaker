# MTG Cardmaker

Web-UI, um eine Magic-Karte über Scryfall zu suchen, eine Version (Druck) mit klassischem
Rahmen auszuwählen und die Karte mit dem zugeschnittenen Artwork originalgetreu nachzubauen.

## Starten

```bash
git lfs install && git lfs pull   # Card-Conjurer-Rahmen in Assets/ (ca. 1,9 GB)
docker compose up -d --build
```

Danach im Browser: <http://localhost:8080> (Direktlink: `http://localhost:8080/?q=Lightning%20Bolt`).

## Funktionen

- **Suche** mit Autovervollständigung, alle Drucke einer Karte inkl. Promos.
- **Nur klassische Rahmen**: Borderless, Full-Art, Extended-Art, Textless, Tokens,
  Art-Series usw. werden ausgeblendet. Optional werden Drucke mit identischem Artwork zusammengefasst.
- **Nachbau** mit eigenem Canvas-Renderer – Rahmen aus den Card-Conjurer-Grafiken in `Assets/` (Fallback: per Code gezeichnet):
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
Assets/              Card-Conjurer-Rahmen, -Masken, -Symbole (Git LFS, siehe Assets/SOURCE.md)
tools/delta.mjs      misst die Abweichung Nachbau ↔ Original-Scan je Kartenbereich
```

**Was woher kommt:** Standardmäßig werden die Rahmen aus den **Card-Conjurer-Grafiken** in `Assets/`
zusammengesetzt (Option „Rahmengrafik“). Welche Ebenen und Masken verwendet werden, folgt der Auto-Frame-Logik
von Card Conjurer (`cardFrameProperties`, `autoM15NewFrame`, `auto8thEditionFrame`, `autoSeventhEditionFrame`),
gespeist aus den Scryfall-Daten des gewählten Drucks:

| Scryfall | Card-Conjurer-Pack |
|---|---|
| Rahmen 2015 | M15 „new“ (inkl. Legendary-Krone, Nyx, Snow, Devoid, Fahrzeug, Holo-Stempel, Land-/Hybrid-/Gold-Varianten) |
| Rahmen 2015 + Transform / Modal DFC | M15 Transform Front/Back, Modal Front/Back |
| Planeswalker (3 / 4 Fähigkeiten) | Planeswalker Regular / Tall inkl. Loyalitäts-Symbole und Fähigkeitszeilen |
| Saga, Class, Adventure | Saga Regular, Class, Adventure |
| Rahmen 2003 | 8th Edition |
| Rahmen 1997 | Seventh Edition |
| Rahmen 1993 | ABU (Alpha/Beta/Unlimited) bzw. Fourth |

Wasserzeichen (Gilden, Clans, Colleges …) kommen ebenfalls aus `Assets/`. Split- und Battle-Karten sowie
alle Karten ohne `git lfs pull` zeichnet weiterhin der Code-Renderer. Von Scryfall kommen Kartendaten,
das zugeschnittene Artwork, der Original-Scan sowie Mana- und Set-Symbole (SVG).

**Abgleich mit dem Original-Scan** (Option „am Original-Scan ausrichten“, Standard an): Das Artwork wird per
Bildregistrierung (Skalierung + Verschiebung, grob-zu-fein) exakt so ins Bildfenster gelegt wie auf dem Scan,
und Größe sowie Zeilenabstand des Regel-/Fähigkeitstexts werden so gewählt, dass der Satz am besten mit der
Schrift auf dem Scan übereinstimmt.

**Zeilenlayout vom Original** (Option, Standard an): Ist der Text unverändert (gedruckter Text, Reminder- und
Flavortext an, Schriftgröße automatisch), werden Zeilenumbrüche, Grundlinien sowie linker/rechter Rand jeder
Zeile aus dem Scan übernommen (Zeilenerkennung über leere Pixelzeilen, Umbrüche per dynamischer Programmierung
auf die gemessenen Zeilenlängen, max. ±4 % Laufweitenkorrektur je Zeile). Wird der Text angepasst, greift das
automatische Layout.

**Farbabgleich** (Option, Standard an): Druckfarben sind dunkler und satter als die Card-Conjurer-Grafiken.
Jeder Rahmenbereich (Textfeld, Namens-/Typleiste, Rahmen, Kontur, P/T-Box – je Maske der Card-Conjurer-Ebene)
wird per Verstärkung je Farbkanal an die Medianfarbe des Scans angeglichen.

**Delta messen:** `node tools/delta.mjs --url http://localhost:8080 m19/156 grn/192 …` rendert die Karten im
Browser (Playwright), vergleicht sie mit dem Scryfall-PNG und gibt die mittlere absolute Abweichung (0–255) je
Bereich aus; pro Karte entsteht ein Bild Nachbau | Original | Differenz.

Alle Abhängigkeiten liegen lokal im Image. Der Browser spricht nur mit dem lokalen Server;
dieser lädt Kartendaten, Artworks und Symbole von Scryfall und cached sie im Volume `cardmaker-data`.

Für den geplanten Upscaling-Schritt ist `GET /api/art/:id` der Einhängepunkt.

## Hinweise

- Der Kartentext ist standardmäßig der **gedruckte Text dieses Drucks** aus MTGJSON (`originalText`,
  je Set einmal geladen und gecacht; Option „Gedruckter Text dieses Drucks“). Fehlt er, wird der Oracle-Text
  von Scryfall verwendet; Reminder-Text, der auf dem Druck fehlt, wird dann per Vergleich mit dem Scan erkannt.
  Alte Typzeilen werden rekonstruiert („Summon …“ vor der 6. Edition, Planeswalker ohne „Legendary“ vor Amonkhet).
- Rahmenwahl nach Scryfall-`frame_effects`: Legendary-Krone, Nyx, Snow, Devoid, Miracle, Companion,
  Colorshifted; farblose Nicht-Artefakte bekommen den farblosen Rahmen, phyrexisches Mana gilt nicht als Hybrid.
- Ein Delta von exakt 0 ist nicht erreichbar: Der Scan ist ein gedrucktes, fotografiertes Exemplar
  (Druckraster, Farbabweichung, minimale Verzerrung), der Oracle-Text weicht bei älteren Karten vom Drucktext ab,
  und Copyright-Zeile/Fußzeile unterscheiden sich bewusst.
- Schriften aus Card Conjurer werden unter ihren dortigen Dateinamen erkannt (`beleren-b.ttf`, `beleren-bsc.ttf`,
  `mplantin.ttf`, `mplantin-i.ttf`, `matrix-b.ttf`, `goudy-medieval.ttf`, `gotham-medium.ttf`), wenn sie in
  `app/fonts` liegen.
- Die Karten-Schriften (Beleren, MPlantin, Matrix, Goudy Medieval, Gotham) liegen per Git LFS in `app/fonts`
  (aus dem Card-Conjurer-Repo, siehe `app/fonts/README.md`).
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
