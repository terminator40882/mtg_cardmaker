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
  - Rahmen-Varianten: **Snow**, **Nyx** (Verzauberungs-Kreaturen ab THB), **Devoid** (durchscheinend),
    **Inverted** (durchscheinendes Textfeld, weiße Schrift).
  - Farben: Mono, Gold (zweifarbig mit geteilter Innenkante), Hybrid (geteilter Rahmen), Artefakt, farbige Artefakte,
    Länder (mit Farbakzent), farblos, Vehikel.
  - Legendary-Krone (ab Dominaria 2018), P/T-Box, Standardländer (großes Manasymbol), Holo-Stempel
    (optional, Standard aus – dann ohne Stempel und ohne Bogen der Rahmenkante, auch bei Planeswalkern),
    Randfarbe (schwarz/weiß/silber/gold).
  - Offizielles Set-Symbol in Seltenheitsfarbe (Card Conjurer, sonst Scryfall); Sammlerinfo im jeweiligen Stil (inkl. neuem Format ab 2023).
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
| Rahmen 2015 | M15 „new“ (inkl. Legendary-Krone, Nyx, Snow, Devoid, Fahrzeug, optional Holo-Stempel, Land-/Hybrid-/Gold-Varianten) |
| Rahmen 2015 + Transform / Modal DFC | M15 Transform Front/Back, Modal Front/Back |
| Planeswalker (3 / 4 Fähigkeiten) | Planeswalker Regular / Tall inkl. Loyalitäts-Symbole und Fähigkeitszeilen |
| Saga, Class, Adventure | Saga Regular, Class, Adventure (inkl. Kapitel-Symbolen, Level-Leisten, Buchseite in Abenteuerfarbe) |
| Split, Battle | Split (Hälften je Farbe, zweifarbige Hälften mit Textfeld-/Rahmenübergang), Battle |
| Rahmen 2003 | 8th Edition |
| Rahmen 1997 | Seventh Edition |
| Rahmen 1993 | ABU (Alpha/Beta/Unlimited) bzw. Fourth |

Ebenfalls aus `Assets/` (wie in Card Conjurer): Wasserzeichen, Mana- und Textsymbole (`manaSymbols/`, alte
Farbsymbole vor Ice Age), offizielle Set-Symbole je Seltenheit (`setSymbols/official/`), Flavor-Trennlinie
(`bar.png`), Transform-Symbole (Sonne/Mond, Kompass/Land …), Planeswalker-Loyalitätssymbole und -Zeilen,
Saga-Kapitel und -Trenner, Class-Level-Leisten. Loyalitäts-/Verteidigungs-Schild, MDFC-Pfeil und -Lasche sowie
das Adventure-Buch sind Teil der Rahmenbilder. Der Pinsel vor dem Künstlernamen ist – wie in Card Conjurer – der
Glyph U+FFEE der Originalschriften (Beleren Small Caps, Matrix Bold). Nur ohne `git lfs pull` (bzw. Option
„Rahmengrafik: per Code gezeichnet“) zeichnet der Code-Renderer Rahmen und Elemente selbst; Symbole, die Card Conjurer nicht hat,
kommen von Scryfall. Von Scryfall kommen außerdem Kartendaten, das zugeschnittene Artwork und der Original-Scan.

**Abgleich mit dem Original-Scan** (Option „am Original-Scan ausrichten“, Standard an): Das Artwork wird per
Bildregistrierung (Skalierung + Verschiebung, grob-zu-fein) exakt so ins Bildfenster gelegt wie auf dem Scan,
und Größe sowie Zeilenabstand des Regel-/Fähigkeitstexts werden so gewählt, dass der Satz am besten mit der
Schrift auf dem Scan übereinstimmt.

**Zeilenlayout vom Original** (Option, Standard an): Ist der Text unverändert (gedruckter Text, Reminder- und
Flavortext an, Schriftgröße automatisch), werden Zeilenumbrüche, Grundlinien sowie linker/rechter Rand jeder
Zeile aus dem Scan übernommen (Zeilenerkennung über leere Pixelzeilen, Umbrüche per dynamischer Programmierung
auf die gemessenen Zeilenlängen, max. ±4 % Laufweitenkorrektur je Zeile). Wird der Text angepasst, greift das
automatische Layout. Helle Schrift auf dunklem Textfeld wird erkannt (Helligkeit umgekehrt), das Druckraster alter
Scans vor der Zeilenerkennung leicht weichgezeichnet.

**Gedruckter Wortlaut ohne MTGJSON-Text:** Für viele Sets (30A, ATH, BTD, CED, PTC, SUM, TD0, Promos …) hat MTGJSON
keinen `originalText`. Dann werden aus dem Oracle-Text die Formulierungen früherer Regel-Epochen abgeleitet
(„enters“ → „enters the battlefield“, „mana value“ → „converted mana cost“, „any target“ → „target creature or
player“, „battlefield“ → „play“, „deals N damage to target creature or player“ → „does N damage to one target“).
Welche auf dem Druck steht, entscheidet der Vergleich mit dem Scan (ohne Scan das Erscheinungsdatum); danach wird
auch das Zeilenlayout übernommen.

**Inverted-Rahmen** (Scryfall-Rahmeneffekt `inverted`, z. B. FNM- und Secret-Lair-Drucke): Card-Conjurer-Pack
„Clear Textboxes“ – das Artwork läuft unter Typzeile und Textfeld weiter, beide halbtransparent dunkel, Typ- und
Regeltext weiß mit Schatten. Sonst wird die Farbe des Regeltexts am Scan gemessen (helle Schrift → weiß mit Schatten).

**Farbabgleich** (Option, Standard an): Druckfarben sind dunkler und satter als die Card-Conjurer-Grafiken.
Jeder Rahmenbereich (Textfeld, Namens-/Typleiste, Rahmen, Kontur, P/T-Box – je Maske der Card-Conjurer-Ebene)
wird in Mittelwert und Streuung je Farbkanal an den Scan angeglichen (Farbton, Helligkeit, Kontrast der Struktur);
bei zweifarbigen Rahmen linke und rechte Hälfte getrennt.

**Leistung:** Der Server startet einen Worker-Prozess je CPU-Kern (Node `cluster`, Anzahl per `WEB_CONCURRENCY`);
API-Anfragen an Scryfall bleiben insgesamt bei ~9/s, Bilder vom CDN (`*.scryfall.io`, ohne Rate-Limit) werden parallel
geladen. Im Browser laufen Schriftgrößen-Bestimmung und Artwork-Ausrichtung in Web Workern parallel zum Zeichnen des
Rahmens; Bilder werden parallel dekodiert (`createImageBitmap`), Rahmen und Masken je Sitzung gecacht.

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
