# Sender-Chef – Plan (Stand: v0.1, nur data.js + sim.js vorhanden)

## 1. Spielkonzept und Kernschleife
Du leitest den Fernsehsender »Welle 7« gegen »Blitz TV« und »Kanal Krawall«. Eigene Texte, eigene Grafik, keine Original-Assets.

**Tag (08:00–18:00, 3 Spielminuten pro Sekunde, also ca. 200 s):** Du läufst im Hochhaus (5 Etagen, Aufzug) und erledigst:
Filme kaufen/verkaufen (Filmhändler), Werbeverträge annehmen (Werbeagentur), Meldungen kaufen (Nachrichten), Programmplan 18–23 Uhr belegen (Büro), Kredit (Bank), Chefin besuchen (Laune), Pförtner (Hinweise, Post).
**Abend (18–23 Uhr):** Plan ist gesperrt. Animation Stunde für Stunde: Quoten der drei Sender, Werbespots erfüllt/verfehlt. Danach **Tagesbilanz** (Einnahmen, Strafen, Kosten, Rang, Chefin-Kommentar) und Autosave.
**Sieg:** Chefin-Laune 100. **Niederlage:** Laune 0 (gefeuert) oder Konto < 0 bei ausgeschöpftem Kredit (Pleite). Danach »Weiterspielen (frei)« und Highscore (Tage, Geld).

## 2. Architektur und technische Entscheidungen
- **Dateien:** `index.html`, `css/`, `js/data.js` (statisch), `js/sim.js` (reine Logik), `js/building.js` (Canvas), `js/ui.js` (HTML-Panels), `js/main.js` (Schleife, Verdrahtung). `docs/`, `tests/`, `tools/bot.mjs`.
- **Keine ES-Module, keine Build-Kette:** klassische `<script>`-Tags in fester Reihenfolge, Namespace `window.SC`. Grund: ES-Module scheitern bei `file://` (CORS). Node-Test ohne Codeänderung: `globalThis.window = globalThis; require('../js/data.js'); require('../js/sim.js')`.
- **Modulgrenzen:** `sim.js` kennt weder DOM noch Canvas noch Uhrzeit-Animation. `building.js` zeichnet nur und meldet »Spieler betritt Raum X« (Callback). `ui.js` ruft ausschließlich `SC.sim.*` auf, liest den Zustand und rendert neu; kein Spielzustand in DOM oder Canvas. `main.js` besitzt Uhr, Tempo, Phasenwechsel.
- **Zustand:** ein einziges JSON-serialisierbares Objekt `s` (keine Funktionen, Klassen, Sets, Referenzen außer per `id`). Anzeige-Daten (Animation) liegen nicht in `s`.
- **Zufall:** mulberry32, Zustand `s.rs` im Spielstand. Regel: jede Zufallsziehung nur in sim-Aktionen, nie in `forecast`/UI. Seed aus URL `?seed=123` oder Zeit. Folge: reproduzierbare Bot-Läufe, aber Save-Scumming (Laden, anderen Plan testen) liefert dasselbe Ergebnis pro Plan. Das ist ok, wird aber dokumentiert.
- **Speicherformat:** Schlüssel fest `senderchef-save`, Feld `v` (Ganzzahl) im Objekt. `load()` ruft `migrate(s)` als Kette `v1→v2→…`; unbekannte/neuere Version: nicht überschreiben, Hinweis »Spielstand von neuerer Version«. Zusätzlich Slots `…-auto` und `…-manual`. Aktuell prüft `load()` nur `v===1` und der Schlüssel enthält schon `v1`: ändern. Gespeicherte `over`-Spiele beim Laden als beendet anzeigen.
- **Grafik:** interne Auflösung 320×200 (Amiga-lowres), ganzzahlig skaliert, `image-rendering: pixelated`, feste 32-Farben-Palette in `data.js`, eigener 5×7-Bitmap-Font (Zeichenfolge als Daten, inkl. ÄÖÜß) statt Systemschrift. Panels per CSS im gleichen Look (Rahmen, Bevel, Palette).
- **Tests:** (a) `tests/sim.test.mjs` mit `node --test`: Determinismus (gleicher Seed+Aktionen = gleicher Zustand), Invarianten (kein NaN, ganzzahliges Geld, jeder Plan-Slot verweist auf vorhandenen Film, 2-Stunden-Filme belegen genau 2 Slots, kein Film doppelt), Save/Load-Roundtrip, `setSlot`-Randfälle. (b) `tools/bot.mjs`: Balance-Läufe über Seeds 1..500 mit Bot-Typen passiv/zufällig/einfach/gierig, Ausgabe Siegquote und Histogramm Endtag. (c) `tests/smoke.mjs` mit Playwright/Puppeteer headless: `index.html` per `file://` laden, keine Konsolenfehler, ein Tag per Debug-Hook (`?debug`) durchspielen, Screenshot-Vergleich grob (nicht leer). Optional GitHub Action; Pages-Deploy direkt aus `main`/Root.

## 3. Phasenplan
**Phase 1 – MVP (spielbar, ein Durchlauf bis Sieg/Niederlage)**
- `building.js`: Hochhaus mit 5 Etagen, Aufzug (Tasten/Klick, Fahrtzeit ca. 1 s/Etage), Spielerfigur laufen/Tür betreten, Tür-Beschriftungen aus `SC.FLOORS`, Rival-Türen als Dekoration.
- `ui.js`: Panels Büro (Programmplan 6 Slots, Filmwahl, Werbespot je Slot, Prognose via `forecast`), Filmhändler (Kauf/Verkauf), Werbeagentur (Verträge), Nachrichtenstudio, Chefin, Bank, Pförtner (Tutorial-Hinweise). Fehlermeldungen aus `msg` der sim-Funktionen anzeigen.
- `main.js`: Uhr 08–18 mit Tempo 0/1/2/3, Pause, 18:00 erzwingt Abend (offene Panels schließen, Plan sperren), Sendeanimation (Balken der drei Sender je Stunde, Spot-Ergebnis), Tagesbilanz, `nextDay`, Autosave, Start-/Endbildschirm, Neues Spiel/Weiter.
- Minimaler Retro-Look (Palette, Font), kein Sound. Tutorial: erster Tag mit 3 Hinweisen. Balance-Änderungen aus Abschnitt 4 vor Phase-1-Abnahme.
- Abnahme: Bot-Zielwerte aus Abschnitt 4 erreicht, Smoke-Test grün, 10 Tage ohne Konsolenfehler.

**Phase 2 – Tiefe Wirtschaft:** Filmauktionen (KI-Sender bieten mit), Serien/Mehrteiler (Paket aus 3–5 Folgen, Treue-Bonus), Archivlimit (20) und Verkauf.
**Phase 3 – Publikum:** Zielgruppen (Kinder/Familie/Senioren/Jugend) mit eigener Tageskurve; Senderimage je Zielgruppe; Gegenprogrammierung der KI (reagiert auf deinen Vortagesplan).
**Phase 4 – Konkurrenz:** Sabotage und Spionage (Plan der Rivalen sehen, Film wegkaufen, Gerüchte), Ereignisse (Streik, Panne, Prominentenbesuch).
**Phase 5 – Politur:** Sound per WebAudio (synthetisierte Chiptune-Jingles, Türen, Aufzug, Kasse; Mute), Grafik-Ausbau (Animationen, Tag/Nacht-Fassade, Fernseher-Zuschauerzahl), Hotseat-Mehrspieler (2–3 Spieler abwechselnd am selben Gebäude, gemeinsamer Seed), Highscore-Liste.

## 4. Review-Punkte zu sim.js

### 4.1 Balance (Ursachen der bimodalen Läufe)
Befund: Sieg nach 5–8 Tagen oder Niederlage nach 16–22 Tagen. Gründe:
1. **Laune ist ein Schneeball.** Rang 1 gibt +7 (plus Anteilsbonus ≈ +2) pro Tag, 50→100 in ca. 6 Tagen. Rang 3 gibt −3 −3. Dazu `image` (±0,25·Δ Anteil) verstärkt den Sieger weiter. Vorschlag: Rangwerte `[+5, +1, −3]`, Anteilsbonus `(share−0,333)·15`, Leerslot −2 statt −3, Sieg erst ab Tag 10 (davor Laune auf 99 kappen). Ziel: Siegtag 10–14.
2. **Image ohne Gegenkraft:** `image += (share−0,333)·0,25`, Grenzen 0,7–1,6. Vorschlag: `image += (share−0,333)·0,12 − (image−1)·0,03`, Grenzen 0,85–1,35; Rivalen Faktor 0,08, Grenzen 0,9–1,3.
3. **KI wächst linear unbegrenzt:** `makeFilm(15+day, 45+day·2)` ab Tag 20 ≈ 35–85 und zusätzlich holt sie sich den besten Händlerfilm (`p=0,45`), den der Spieler dann nicht kaufen kann. Vorschlag: Qualität `min(40, 15+0,6·day)` bis `min(75, 45+1,2·day)`; Händlerkauf `p=0,25`, zufällig aus den 3 besten statt immer dem besten; Rivalen-`rBonus` `0,96–1,04` statt `1,00–1,08` (heute systematisch +4 % für die KI).
4. **Werbe-Mindestzuschauer steigen nur mit dem Tag:** `minV = 120+t²·1800+25·day`. Wenn die KI stärker wird, sinken deine Zuschauer, die Mindestwerte steigen weiter → Vertragsstrafen (−4 Laune je Vertrag) → Abwärtsspirale. Vorschlag: `ref = max(300, Mittel der besten 3 Stunden der letzten 3 Tage)`, `minV = round((0,35 + 0,8·t²)·ref / 10)·10`.
5. **Strafen zu hart/binär:** `pay·spots·0,6` auch bei fast erfüllten Verträgen. Vorschlag: `pay·spots·0,4·(spots−done)/spots`.
6. **Filmverbrauch:** Frische-Abbau 0,65 (2h: 0,55), Erholung nur +0,15/Tag. Der Spieler braucht ≈18 Filme für Rotation, zahlt aber 500/Film/Tag und die Preise wachsen mit `q²`. Vorschlag: Abbau 0,70 / 0,60, Erholung +0,18, Lagerkosten 300/Tag, Händler-Obergrenze `min(90, 60+2·day)`, Startarchiv 6 statt 4 Filme.
7. **Einnahmen nur über Spots:** ohne Verträge null Einkommen. Vorschlag (testen): Grundeinnahme `4 € je 1.000 Gesamtzuschauer` (Größenordnung 10–16 k/Tag, deckt ~Betriebskosten), damit Fehler nicht sofort Pleite bedeuten; Laune bleibt der Hauptdruck.
8. **Nachrichten:** bis +25 % Anziehungskraft für alle Stunden bei bis zu ~45 k Kosten; Wirkung und Preis vom Bot prüfen lassen. Vorschlag: Bonus nur für 19 und 22 Uhr, dafür Preis `appeal·1000+0..2000`.

Zielwerte nach Änderung (Bot über 500 Seeds): passiv verliert Median Tag 6–9 (bleibt); einfacher Bot gewinnt 25–35 %, Siegtag 10–14; Verlierer enden Tag 15–30 (kein Cluster); weniger als 10 % der Bot-Läufe enden vor Tag 8. Nicht mehr als zwei Parameter je Lauf ändern, Ergebnisse in `docs/BALANCE.md` protokollieren.

### 4.2 Fehler und Randfälle
- `sim.js` nutzt `window.SC`: im Node-Test `globalThis.window = globalThis` setzen (kein Codeeingriff nötig); `localStorage` ist bereits in `try`.
- `buyFilm`, `signAd`, `buyNews`, `sellFilm`, `takeCredit` prüfen die Phase nicht. In `bilanz` oder `over` änderbar: Guard `if (s.phase!=='tag'||s.over)` ergänzen (UI sperrt ohnehin).
- `s.plan` bleibt über Tage bestehen (gewollt, aber dokumentieren). Verkaufte/ausgelaufene Verträge werden bereinigt, Filme beim Verkauf auch; `part`-Reste prüfen, wenn ein 2h-Film nach `nextDay` entfernt wird (Invariantentest).
- `res.newsCost` wird nicht von `money` abgezogen (bereits beim Kauf bezahlt): in der Bilanz nur als Info zeigen, nicht doppelt abziehen.
- `runEvening` sieht Rivalenfilme mit `len=2` als 1 Slot (`planRivals` ignoriert `len`): ok für MVP, in Phase 3 korrigieren.
- Ein Vertrag kann komplett an einem Tag erfüllt werden (bis zu 6 Spots), `days` hat dann kaum Wirkung. Vorschlag: höchstens 2 Spots je Vertrag und Tag.
- Pleite-Prüfung nach Auto-Kredit: bei `money<0` und Sieg gleichzeitig gewinnt der Sieg. Besser: Pleite zuerst.
- Sieg bei negativem Konto, ohne Mindesttag: siehe 4.1 Punkt 1.
- `rank`-Sortierung bei Gleichstand stabil nach Index (Spieler zuerst); ok, aber Test ergänzen. `share` bei `all=0` abgesichert.
- `makeFilm`: `ROMAN[1]=''` ungenutzt, ab Teil 11 »Teil 11«; Titelzähler wächst unbegrenzt (klein, ok).
- `rs`-Seed `(seed>>>0)||1`: Seed 0 und 1 identisch; als `seed|0 ^ 0x9E3779B9` mischen.
- Preise sind auf 500/1000 gerundet, aber `sellPrice` kann bei Rundung 0 werden (q klein): Mindestpreis 500.
- `load()` ohne Strukturprüfung: fehlende Felder (z. B. nach manuellem Edit) crashen. Mit `migrate` + Feldvorgaben absichern.
