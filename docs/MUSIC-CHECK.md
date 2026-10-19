# Originalitätsprüfung Musik v0.3 (Entwurf zur Claude-Bestätigung)

Datum: 19.10.2026. Komponiert für Sender-Chef, Datei `js/audio.js`. Keine fremden Samples.

## Entstehung

| Stück | Tonleiter / Charakter | Motiv (MIDI, erste Töne) | Intervalle (Halbtöne) | Verfahren |
|---|---|---|---|---|
| title | C-Dur-Pentatonik, gemächlich | 60–64–69–67–64–62–60 | +4 +5 −2 −3 −2 −2 | aufsteigend, dann fallend, Variante eine Oktave höher |
| tower | F-Bezug, Ostinato Bass 41–48–45–48 | Lead 65–69–72–69 | +7 +5 +5 −3 | Bass-Schleife, Lead sparsamer Sprung |
| evening | D-Moll-ähnlich, Spannung | 62–65–69–70–69–65–62 | +3 +4 +1 −1 −4 −3 | steigende Linie mit Bb, dann Abstieg |
| balance | A-Moll-Pentatonik, ruhig | 69–72–76–74–72–69 | +3 +4 −2 −2 −3 | langsame Viertel ohne Schlagwerk |
| door | Pulse | 67–72 | +5 | zwei kurze Töne |
| buy | Münze | 76–83–88–93 | +4 +3 | drei hohe Quadratwellen |
| spotOk | Dur-Dreiklang | 60–64–67 | +4 +3 | aufwärts |
| spotFail | fallend | 62–55 | −7 | dumpf |
| win | Fanfare | 60–64–67–72–67–72 | +4 +3 +5 −5 +5 | frei gewählt |
| lose | Moll-Abfall | 64–62–60–57–53 | −2 −2 −3 −4 | langsam fallend |

## Checkliste

- [x] Entstehung dokumentiert (Tabelle oben).
- [x] Intervallfolgen notiert; absichtlich keine bekannten TV-/Nachrichten-/Mad-TV-Motive.
- [x] Claude-Bestätigung (19.10.2026): keine erkennbare bekannte Melodie, siehe Befund. Einschränkung: Prüfung aus dem Gedächtnis anhand der Notenfolgen, keine Melodie-Datenbank-Suche.
- [ ] Hörprobe durch mindestens zwei Personen (offen, Mensch nötig).
- [ ] Optionale Melodie-Suche in öffentlichen Diensten (offen).

## Befund Claude

Alle Stücke bestehen aus Schritten innerhalb einer Pentatonik bzw. Dm-Dreiklang-Tönen und liegen im Rahmen allgemeiner Tonleiter-/Dreiklangsfiguren. Ich erkenne darin kein bekanntes TV-, Nachrichten-, Pop-, Film- oder Spielemotiv, auch nicht transponiert oder rückwärts. Kein Bezug zu Mad TV.

- **title** (C–E–A–G–E–D–C, G–A–C'–A–G–E–C): Pentatonik-Wellen, keine markante Intervall-Signatur. Unkritisch.
- **tower** (Bass F–C–A–C, Lead F–A–C'–A): Ostinato im Wechsel aus Quinte und Terz, Lead ist ein einfacher Dreiklang. Unkritisch.
- **evening** (D–F–A–B♭–A–F–D, dann D–F–A–D'–F'): Dm-Arpeggio mit b6 als Spannungston. Gebräuchlich, aber ohne Treffer. Unkritisch.
- **balance** (A–C'–E'–D'–C'–A–G–A): Moll-Pentatonik, ruhige Viertel. Unkritisch.
- **door** (G–C', Quarte auf), **spotFail** (D–G, fallend), **lose** (E–D–C–A–F, fallende Linie): zu kurz und generisch für Schutzfähigkeit, keine bekannten Signale.
- **spotOk** (C–E–G) und **buy** (C''–E''–G'' = dieselbe Folge, 2 Oktaven höher) sowie **win** (C–E–G–C'–G–C'): reine Dur-Dreiklangsbrechungen, Allgemeingut (Fanfare/Signalhorn-Bauweise). Keine charakteristische Rhythmus-/Pausenfolge, die ein Sender-Signal nachbildet. Unkritisch.

Kein Änderungsbedarf an den Notenarrays. Optionaler Feinschliff, kein Muss: `buy` hat dieselbe Tonfolge wie `spotOk`. Für mehr Unterscheidbarkeit (nicht wegen Urheberrecht) z. B. `buy` auf `[[88, 0.06], [91, 0.06], [95, 0.1]]` (E–G–B, Dur7-Anmutung).
- [x] Keine `.mp3`/`.ogg`/`.wav`/`.mid` im Repo.
- [x] Footer/README: Musik selbst erzeugt.

## Hörhinweis

Prozedural per Web Audio (square/triangle + Rauschen). Start erst nach Klick. Ton-Knopf und Lautstärke im HUD, Taste M, Speicherung `localStorage` Schlüssel `senderchef-audio`.
