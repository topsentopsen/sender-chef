# Balance v0.3 – Spezifikation (kein Code geändert)

Grundlage: `js/sim.js` (Stand v0.2.1), `js/data.js`, `tools/bot.js`, `docs/PLAN.md` §4.1, `docs/REVIEW-v0.2.md`.
Messung IST (`node tools/bot.js 300`, von Tobi geliefert): passiv 300/300 gefeuert, Median Tag 5. Einfach: Sieg 29/300 (9,7 %), Median Siegtag 26 (18–35), gefeuert 268 (Median Tag 21), Liebe verloren 3.
Ziel: einfacher Bot 25–35 % Siege, Siegtag 10–14. Passiv scheitert weiter früh, Niederlagen bleiben möglich.

Hinweis: Ich konnte den Bot in dieser Sitzung nicht selbst ausführen. Die Wirkungsabschätzung in C ist aus dem Code hergeleitet und muss gemessen werden. Als Erstes sollte ein Diagnoselauf (siehe D) die Endgründe aufschlüsseln.

## A) Ursachenanalyse

1. **Das Herz ist der Engpass, nicht die Chef-Laune.** Herz-Zuwachs pro Abend: Rang 1 `+4`, Rang 2 `+2`, Rang 3 `0`, dazu `+2` je Kultur-Slot (`sim.js:360`). Für Herz 100 braucht es also mindestens 25 Abende auf Rang 1. Das passt zum gemessenen Siegtag 26 (min 18). Die Laune dagegen steigt auf Rang 1 um etwa 7 pro Abend (`sim.js:350`) und ist nach rund 7 Tagen bei 100, ohne dass das ein Sieg wäre. Der Siegtag 10–14 ist mit den heutigen Herzwerten rechnerisch unmöglich (Maximum 100/4 = 25 Tage, Geschenke ausgenommen).
2. **Wer langsam siegt, läuft in die Rivalen-Entwicklung.** Rivalen-Neufilme wachsen auf `makeFilm(min(40,15+0.6·Tag), min(75,45+1.2·Tag))` (`sim.js:397`). Dazu holen sie mit p=0,25 einen der drei besten Händlerfilme (`sim.js:391`) und behalten die besten 14 Filme nach `q·top` (`sim.js:399`). Ab etwa Tag 15 ist ihr Top-7-Plan deutlich besser als der Startbestand. Spieler, die bis dahin nicht gewonnen haben, werden überholt. Das ist der »Schneeball ab Tag 15«. Die Mehrheit der gefeuerten Läufe (Median Tag 21) hätte bei schnellerem Herz vorher gewonnen.
3. **Rivalen haben einen systematischen Bonus.** `rBonus = 1 + rnd·0.1` (`sim.js:295`) hat den Mittelwert 1,05. PLAN §4.1 wollte 0,96–1,04, das ist nie umgesetzt worden. Außerdem rechnet `forecast` die Rivalen mit festem `1.05` (`sim.js:278`). Das ist zufällig derselbe Mittelwert, bleibt aber bei jeder Änderung von `rBonus` falsch.
4. **Image-Kampf ohne Gegenkraft.** Stundensieger nimmt dem Letzten einen Punkt (`sim.js:306-310`), ohne Boden und ohne Deckel. Das Image wirkt zusätzlich auf die Anziehungskraft (`imgF = 0.9 + img·0.003`, `sim.js:240`, Spanne 0,9–1,2 bei 0–100). Wer führt, bekommt mehr Zuschauer und gewinnt weitere Stunden. Beispiel aus dem Review: ein Rivale fällt auf 0, der andere läuft auf 87 davon, danach ist das Spiel entschieden.
5. **Image-Entzug als zweiter Verlustpfad.** `image < 8` feuert (`sim.js:376`). Ein Spieler, der drei Tage Letzter ist, verliert Image doppelt: in der Anziehungskraft und über den Herz-Deckel `heartCap = 2·Image` (`sim.js:184`). Das Herz fällt dann ebenfalls (höchstens 5 pro Tag).
6. **Werbung verstärkt Gewinner und Verlierer.** `pay = minV·24 + 4000` (`sim.js:48`) belohnt Quote. Fehlschläge kosten Laune (`−1` je verfehlter Spot, `−3` je gescheitertem Vertrag, `sim.js:350`). `minV` hängt an deinen eigenen besten drei Stunden (`adRef`), kann also bei einem Einbruch nicht allein steigen. Die Spirale ist schwächer als im PLAN befürchtet. Sie ist **nicht** die Hauptursache und wird deshalb nur als Reservehebel geführt.
7. **Passiv ist richtig bestraft** (Median Tag 5): leere Slots `−2` je Stunde, Testbild, keine Einnahmen. Die vorgeschlagenen Änderungen berühren Laune und Leerslot-Strafe nicht und lassen das Passiv-Ergebnis stabil.

## B) Stellschrauben (7 Änderungen)

| # | Datei:Symbol | Alt | Neu | Begründung |
|---|--------------|-----|-----|------------|
| 1 | `sim.js:360` Herz Spieler | `[4,2,0][rank-1] + 2·culture` | `[9,3,0][rank-1] + 3·culture` | Hauptschraube für den Siegtag. Rang 1 an 11–12 Abenden ergibt Herz 100, mit Geschenken und Kultur früher. Rang 2 bringt noch etwas, Rang 3 nichts. |
| 2 | `sim.js:363` Herz Rivalen | `[3,1,0]` | `[4,1,0]` | Verhältnis zum Spieler bleibt etwa 1:2. Rivalen brauchen auf Rang 1 weiter 25 Abende. »Liebe verloren« bleibt möglich, wenn der Spieler lange Letzter ist. |
| 3 | `sim.js:295` `rBonus` | `1 + rnd(s)·0.1` (Mittel 1,05) | `0.95 + rnd(s)·0.1` (Mittel 1,00) | Nimmt den Dauer-Vorteil der KI. Zufallsverbrauch bleibt gleich (ein `rnd` je Rivale). |
| 4 | `sim.js:278` Default in `hourAttrs` | `rBonus ? rBonus[i] : 1.05` | `rBonus ? rBonus[i] : 1.0` | `forecast` passt zum neuen Mittelwert. Nur Anzeige, kein Einfluss auf Zufall. |
| 5 | `sim.js:240` `imgF` | `0.9 + img·0.003` | `0.94 + img·0.002` | Gummiband über Dämpfung der positiven Rückkopplung: Spanne Image 0–100 von ±20 % auf 0,94–1,14. Bei Image 33 bleibt der Faktor praktisch 1,0. |
| 6 | `sim.js:309` Image-Kampf | `if (bi !== wi && imgs[wi] > 0)` | `if (bi !== wi && imgs[wi] > 12 && imgs[bi] < 60)` | Boden 12 und Deckel 60 halten die Summe 100 und verhindern 0/87-Läufe. Der Deckel 60 liegt über der für Herz 100 nötigen Schwelle 50. Folge: Der Pfad `image < 8` (`sim.js:376`) wird praktisch unerreichbar, Entlassung läuft über die Laune. `signAd` sperrt weiter unter 15 (Boden 12 bleibt spürbar). |
| 7 | `sim.js:391` und `sim.js:397` Rivalen-Zufluss | Händlerklau `p=0.25`; Neufilm `min(40,15+0.6·Tag)` bis `min(75,45+1.2·Tag)` | Händlerklau `p=0.15`; Neufilm `min(34,14+0.45·Tag)` bis `min(66,42+1.0·Tag)` | Rivalen werden langsamer stark, die Obergrenze liegt bei 66 statt 75. Die Wahrscheinlichkeit 0,7 für einen Neufilm bleibt. Der Spieler muss bei Tag 20 gegen Filme im Schnitt um 42 statt 48 antreten. |

### Reserve-Hebel (nur bei Bedarf, nicht gleichzeitig)
- **R1 Siegsperre:** Wenn der früheste Siegtag unter 7 liegt: `if (s.day < 8) s.heart = Math.min(s.heart, 99)` vor der Sieg-Prüfung (`sim.js:377`).
- **R2 Werbe-`minV`:** `0.35 + 0.8·t²` (`sim.js:45`) auf `0.30 + 0.7·t²`, wenn die Verlierer zu früh auf Spot-Fehlschläge zurückgehen.
- **R3 Herz Rang 1:** `9` auf `10` oder `8`, je nachdem, ob der Siegtag über 14 oder unter 10 liegt.
- **R4 Rivalen-Neufilm:** Obergrenze `66` ↔ `70`, wenn die Siegquote über 35 % steigt.

## C) Erwartete Wirkung und Messprotokoll

**Erwartung (Schätzung aus Code, nicht gemessen):**
- Siegtag: schnellster Weg mit nur Rang 1 etwa Tag 11. Ein Bot mit ~85 % Rang-1-Abenden erreicht Herz 100 rund um Tag 12–16, mit Geschenken (Pralinen `+8`, Parfüm `+14`, halbiert bei Wiederholung) etwas früher.
- Siegquote: Wer vor Tag 15 gewinnt, entgeht der späteren KI-Stärke. Erwartet werden 25–35 %. Der Bot ist 2 h-blind und spielt keine Kultur. Das ist ein Grund, die Zahl eher am unteren Rand zu erwarten.
- Passiv: unverändert früh gefeuert (Median Tag 4–6).
- Verlierer: enden breiter verteilt (Tag 12–35), weil Image-Boden und Gummiband die Abwärtsspirale bremsen und nur die Laune endet.

**Messprotokoll:**
1. Vorher: `node tools/bot.js 300` auf einem sauberen Stand aufschreiben (die Werte oben). Zusätzlich den Diagnoselauf (D) einmal fahren.
2. Änderungen in vier Schritten einspielen, nach jedem Schritt `node tools/bot.js 300` und `node --test`:
   - Schritt 1: #1 und #2 (Herz). Erwartet: Siegtag fällt stark, Siegquote steigt deutlich.
   - Schritt 2: #3 und #4 (rBonus). Erwartet: Quote leicht höher, Verlierer-Tag später.
   - Schritt 3: #5 und #6 (Image). Erwartet: weniger Extrem-Läufe, weniger Entlassung durch Image.
   - Schritt 4: #7 (Rivalen-Zufluss). Erwartet: Quote und Verlierer-Tag steigen leicht.
   - Nicht mehr als zwei Parameter je Lauf (PLAN §4.1).
3. Validierung auf frischen Seeds: einmal Seeds `1..300` (wie bisher), einmal einen anderen Bereich, z. B. Bot-Schleife `seed*7919 + 100000`. Beide müssen im Zielkorridor liegen, damit nicht auf die 300 Seeds angepasst wird.
4. Ergebnisse mit Datum und Parameterstand in `docs/BALANCE.md` protokollieren.

**Zielkorridor einfacher Bot:** Siegquote 25–35 %, Median Siegtag 10–14, früheste Siege nicht vor Tag 7, Verlierer ohne Cluster (kein Tag mit über 20 % aller Endungen), unter 10 % enden vor Tag 8, passiv Median Tag 4–7.

**Abbruchkriterien (zu leicht, Parameter zurück oder Reserve-Hebel):**
- Siegquote über 45 %: zuerst R4, dann #1 zurück auf `[8,3,0]`.
- Median Siegtag unter 8: #1 zurück auf `[7,2,0]`, R1 einführen.
- Passiv überlebt länger als Tag 10 oder gewinnt irgendwo: Schritt zurücknehmen, dann prüfen.
- Siegquote unter 20 % oder Median Siegtag über 16: R3 auf 10 und Schritt 4 zurücknehmen.
- Kein Lauf endet mehr durch `liebe` oder `pleite` und die Quote der gefeuerten Läufe fällt unter 40 %: Niederlagen sind zu selten, Rivalen-Neufilm anheben.

## D) Bot (nur Diagnose, kein Genre-Mix)

Ein Genre-Mix ist **nicht nötig** für faires Messen: Der Bot wählt schon pro Stunde den Film mit der besten Anziehungskraft (`sim.attr` mit Genre-Eignung, `tools/bot.js:18`). Kultur und 2-h-Filme werden nicht gezielt gespielt, das macht die Messung eher konservativ (Quote im echten Spiel höher).

Sinnvoll und klein: `tools/bot.js` soll am Ende zusätzlich pro Strategie ausgeben
- Endgrund getrennt (`mood`, `image`, `pleite`, `sieg`, `liebe`),
- 10/50/90-Perzentil des Endtags,
- Anteil Rang-1-Abende.

Damit lässt sich prüfen, ob die Entlassungen wirklich über die Laune laufen (Annahme in A5 und B6). Wird dafür kein Eingriff in `sim.js` gebraucht, ist das Ergebnis `s.over` plus `s.mood`/`s.image` am Spielende.

## E) Bewusst offen

- Serien und Mehrteiler, Archivlimit-Anpassungen (PLAN Phase 2).
- Hausmeister als Info-NPC, Sabotage und Spionage, Ereignisse (Phase 4).
- Zielgruppen und Gegenprogrammierung der KI (Phase 3), insbesondere dass die KI aus deinem Vorabend lernt.
- Chef-Auftritt über die Morgenbesprechung hinaus, Eigenproduktion, Hotseat.
- Nachrichten-Balance (+25 %-Deckel) und Spielerpreise der Filme (`q²`-Kurve) werden in v0.3 nicht angefasst.
- Kein Schwierigkeitsgrad-Schalter. Falls das Zielfenster nicht in einem Lauf trifft, wäre ein späterer Schalter über genau diese Parameter (#1, #3, #7) die naheliegende Lösung.
