# Eigene Schriften

Die Schriften echter Magic-Karten sind proprietär und werden deshalb nicht mitgeliefert.
Ohne eigene Dateien nutzt die App frei lizenzierte Ersatzschriften (Alegreya, Crimson Pro,
Alegreya Sans), die per npm lokal im Image liegen.

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
