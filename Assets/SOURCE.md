# Herkunft der Assets

Quelle: https://github.com/fiahdrgn473/CardConjurer (Community-Mirror von Card Conjurer)
Commit: 0eb50b03ccbfb65c20acc9a940f8aa699ce16523 (2024-07-14)

Die Ordnerstruktur entspricht 1:1 dem Original-Repo.

| Pfad | Inhalt |
|---|---|
| `img/frames/` | Rahmen-Grafiken (PNG, teils SVG), je Rahmenstil/Set ein Unterordner (m15, old, seventh, planeswalker, saga, modal, token, …) |
| `img/manaSymbols/` | Mana- und Textsymbole (SVG/PNG), inkl. alternativer Stile |
| `img/setSymbols/` | Set-/Edition-Symbole (`official/` u. a.) |
| `img/watermarks/` | Wasserzeichen (Gilden, Fraktionen, …) |
| `js/frames/` | Frame-Pack-Definitionen: welche Bilder, Masken, Ebenen, Textboxen und Bounds ein Rahmen nutzt |
| `js/creator-23.js` | Die eigentliche Zeichenlogik (Canvas-Rendering, Masken, Textsatz, Symbole) |
| `js/frameSearch.js` | Hilfslogik zur Rahmen-Suche |
| `CARDCONJURER_README.md` | README des Quell-Repos |

Hinweis: Die Pfade in `js/frames/*.js` und `creator-23.js` sind relativ zur Webroot
des Originals (z. B. `/img/frames/m15/...`).
