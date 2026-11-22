# Schriften

In diesem Ordner liegen (per Git LFS) die Karten-Schriften aus dem Card-Conjurer-Repo
(`fiahdrgn473/CardConjurer`, Commit `0eb50b0`, Ordner `fonts/`): `beleren-b.ttf`, `beleren-bsc.ttf`,
`mplantin.ttf`, `mplantin-i.ttf`, `matrix-b.ttf`, `matrix.ttf`, `goudy-medieval.ttf`, `gotham-medium.ttf`.
Es sind proprietäre Schriften; ohne `git lfs pull` liegen hier nur Platzhalter, die ignoriert werden.

Fehlen die Dateien, nutzt die App frei lizenzierte Ersatzschriften, die per npm lokal im Image liegen:
Tinos (Regeltext), PT Serif Bold (Name/Typzeile), Alegreya (Retro-Titel), Alegreya Sans (Sammlerinfo).
Sie wurden per Pixel-Vergleich mit Kartenscans ausgewählt und in der Laufweite korrigiert.
Eigene Originalschriften werden automatisch ohne Korrektur verwendet.

Lege hier (`.ttf`, `.otf`, `.woff` oder `.woff2`) Dateien mit einem dieser Namen ab
(Groß-/Kleinschreibung, Leer- und Sonderzeichen egal), dann werden sie automatisch verwendet:

| Rolle                     | Dateiname (ohne Endung)                    |
|---------------------------|--------------------------------------------|
| Kartenname, Typzeile, P/T | `beleren-bold`, `beleren2016-bold`         |
| Regeltext                 | `mplantin`                                 |
| Regeltext kursiv          | `mplantin-italic`                          |
| Sammlerinfo unten         | `gotham-medium`, `relay-medium`            |
| Künstlername (M15)        | `beleren-smallcaps`                        |
| Name/Typ 2003-Rahmen      | `matrix-bold`                              |
| Name/Typ Retro-Rahmen     | `goudy-medieval`                           |

Nach dem Ablegen genügt ein Neuladen der Seite (der Ordner ist in den Container gemountet).
