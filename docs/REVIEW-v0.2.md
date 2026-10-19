# Review v0.2 – Sender-Chef

Geprüft: `js/*.js`, `index.html`, `tools/bot.js`, Tests. Nicht geprüft: `test/browser-check.js` (braucht einen Browser, nicht ausgeführt) und `css/style.css` (nicht gelesen).
Ergebnis: `node --test` 12/12 grün. Der Bot läuft durch. In 100 Seeds × 30 Tage blieb die Image-Summe immer exakt 100. Ein Blocker ist nicht gefunden worden.

## Blocker
Keine. Das Spiel ist durchspielbar, Sieg und Niederlage greifen, und es gibt keinen Absturz im normalen Ablauf.

## Wichtig
1. **Spielstand wird kaum validiert** (`sim.js:395-397`). `migrate` prüft nur Arrays, `money` und `plan`. `plan: null` besteht die Prüfung (`typeof null === 'object'`).
   Fehlen `agencies`, `gifts`, `giftUse`, `titleUse`, `image`, `rivals[i].plan` oder `.films`, dann stürzt es erst später ab, etwa in `makeFilm` beim nächsten Tag oder in `hourAttrs`. Die Titelseite zeigt trotzdem „Weiterspielen“ (`ui.js:445`).
   Fix: Felder mit Standardwerten auffüllen, Zahlen mit `Number.isFinite` prüfen. Bei Fehlern `null` zurückgeben, damit „Neues Spiel“ bleibt.
2. **Übersprungene Spots werden als „zu wenig“ angezeigt** (`sim.js:305`, `ui.js:382`). Der Spot kommt aus dem Plan, der Vertrag ist aber schon erfüllt oder hat das Tageslimit von 2 erreicht. Dann steht im Ergebnis `{skip:true}`, und die Sendeabend-Tabelle zeigt „✘ … (zu wenig)“.
   Im Test nicht aufgetreten, spielbar ist es aber leicht (derselbe Vertrag in 3 Stunden). Fix: `hr.ad.skip` in `addTvRow` getrennt behandeln („Limit erreicht“). Dazu im Büro warnen, wenn ein Vertrag mehr als `SPOTS_PER_DAY` Slots hat.
3. **Herz fällt mit dem Image-Deckel stark** (`sim.js:339`). `clamp(…, heartCap(s.image))` kappt das Herz jeden Abend. Im Bot-Lauf fiel Herz von 62 auf 24, weil das Image von 36 auf 12 sank.
   Das kann gewollt sein, ist aber hart und steht nur im Chef-Raum. Vorschlag: einen Bilanz-Hinweis „Image zu niedrig, Lena wendet sich ab“ ergänzen oder das Herz höchstens um 5 pro Tag fallen lassen.
4. **Konkurrenz plant 2-Stunden-Filme als 1-Stunden-Slots** (`sim.js:250-253`). In 100 Seeds kam das 2372-mal vor.
   Die KI bekommt dadurch den Teil-2-Abschlag 0,93 nicht, und ihr Film ist nur 1 Stunde belegt. Das ist ein Vorteil gegenüber dem Spieler. Fix: bei der KI `len` berücksichtigen oder beim Kauf nur 1-h-Filme nehmen.
5. **Balance-Schneeball** (`bot.js` Lauf, Seed 30): ein Rivale wird von 59 auf 0 Image gedrückt, der andere läuft auf 87 davon. Danach ist nichts mehr zu retten. Siehe Abschnitt Balance.
6. **Tastatur** (`ui.js:505-507`). Leertaste schaltet Pause um, und ein fokussierter Knopf löst unter Umständen zusätzlich einen Klick aus (je nach Browser).
   Dazu laufen die Tasten 1/2/4 und Leertaste auch während Titel-, Menü- und Bilanz-Overlay. Fix: `if (UI.overlay) return;` einbauen und den Fokus bei `e.target.tagName === 'BUTTON'` ignorieren.

## Klein
- `ui.js:307,328`: `UI.bar()` läuft jede Frame und ruft jedes Mal `forecast` (Simulation von 3 Sendern) auf. Per Cache-Key wie beim HUD (Zeit, Plan-Hash) drosseln.
- `ui.js:98`: `UI.refresh()` zeichnet den Raum bei Auktions-Toasts komplett neu. Ein geöffnetes Dropdown im Büro klappt dann zu.
- `sim.js:115-116`: Wird ein 1-h-Film in die zweite Stunde eines 2-h-Films gesetzt, verschwindet der ganze 2-h-Film ohne Meldung. Toast „Film X aus dem Plan genommen“ ausgeben.
- `sim.js:165,321`: Agentur-Abo im Tag anschalten, Meldungen kaufen und wieder abschalten spart die Gebühr (`fee` wird nur für aktive Agenturen berechnet). Die Gebühr beim Einschalten sofort abbuchen.
- `sim.js:213,232`: Ein Gebot reserviert kein Geld. Der Spieler kann nach dem Bieten alles ausgeben, dann platzt die Auktion (−5 Laune). Das ist fair, steht aber nicht im Raum. Hinweis ergänzen.
- `ui.js:435,437`: Rivalennamen und Zahlen werden nicht escaped (`qbar`, `style` mit Zahlen, `esc` kennt kein `'`). Aus Spieldaten kommt kein Fremdtext. Ein manipulierter Spielstand im localStorage (Self-XSS) kann Skripte einschleusen. Fix: Zahlen mit `Number()` erzwingen, Namen mit `esc()` ausgeben.
- Fehlende Tests: `migrate` (v1→v2, kaputter Spielstand), `bid`/`settleAuction`, 2-h-Filme (Überlappung, Slot 24), Spot-Limit pro Vertrag.
- Der Klick auf den linken Fernseher zeigt immer 20 Uhr, nicht die aktuelle Sendung. Das reicht für v0.2, passt aber nicht zu „live“.
- `hud-credit` heißt noch so, zeigt aber das Image. Umbenennen.

## Prio-A-Abdeckung (Recherche 4)
| # | Punkt | Stand | Anmerkung |
|---|-------|-------|-----------|
| 1 | Hochhaus, Aufzug, Zeitdruck, 2 Konkurrenzsender | ✔ | Uhr 8–18, Tempo 1/2/4, Aufzug animiert |
| 2 | Stundenraster News → Sendung → Spot | ✔ | News nur als Bonus pro Stunde, keine eigene Zeile |
| 3 | Programmplan am Büro-Computer mit Genre-Kästen | ◐ | Tabelle mit Dropdowns, keine Kästen, kein Ziehen |
| 4 | Filmhändler, Auktion, Archiv mit Aktuell-Anzeige | ✔ | „Aktuell“ nur als Prozent, ohne Balken |
| 5 | Werbeverträge: Mindestquote, Frist, Strafe | ✔ | |
| 6 | Nachrichten: teure frische Meldungen pushen | ✔ | Wirkung altert, +25 % Deckel, 3 Agenturen |
| 7 | Unterleiste: TV, Familie, Geld, Zuschauer, Herz, Uhr | ✔ | TV zeigt nur 20 Uhr, keine Live-Sendung |
| 8 | Liebesziel oben, Kultur, Geschenke, Image-Deckel | ✔ | „Quoten killen Lena“ nicht modelliert, Kultur gibt nur Bonus |
| 9 | Grantiger Chef, Kredit, Rausschmiss | ◐ | Kein Chef-Auftritt am Morgen, nur Raum und Bilanz |
| 10 | Image-Kampf, 100 Punkte | ✔ | Summe immer 100, Stundensieger +1, Letzter −1 |

## Balance (`node tools/bot.js 300`)
- **passiv** (nichts tun): 300/300 gefeuert, Median Tag 5. Das ist gut so, Nichtstun wird bestraft.
- **einfach**: 63 Siege (21 %), 233 gefeuert (78 %), 3× Liebe verloren, 1 offen. Median Siegtag 25.
- Der Bot ist einfach gebaut: nur 1-h-Planung, kein Genre-Mix und keine Nachrichten-Taktik. Das Bild sagt deshalb nur, dass ein Spieler mit Ahnung gewinnen kann.
- Die Schwelle zum Sieg ist hoch: Das Herz braucht Image ≥ 50 von 100, also muss ein Sender beide Rivalen klar schlagen.
- Der Verlauf kippt oft ab Tag 15 (Chef-Laune unter 30, Rivalen mit Q bis 75 und gekauften Top-Filmen). Rubber-Banding fehlt.
- Werbung dominiert die Einnahmen (bis 92k pro Abend gegen etwa 24k Basis). `pay = minV·24+4000` skaliert mit der Quote und belohnt Schneeball-Effekte.
- Vorschläge: Rivalen-Qualität langsamer steigern (`min(75, 45+1.2·Tag)` auf ca. 0,8), Image-Kampf dämpfen (Punkt nur bei Vorsprung über 10 %), Bot um Genre-Mix erweitern, dann neu messen.

## Empfehlung Phase 2
1. Zuerst Abschnitt „Wichtig“ 1, 2, 4, 6 beheben, dazu Tests für `migrate`, Auktion und 2-h-Filme.
2. Danach Balance glätten: Rubber-Banding und Bot mit Genre-Mix, Ziel Siegquote 30–45 %.
3. Prio B zuerst: Genre-Kästen im Programmplan (#3), Chef-Auftritt am Morgen (#9), Hausmeister als Info-NPC, Kulturpreis als Image-Boost und Events (Pfändung, Sabotage).
4. Eigenproduktion (Drehbuch → Studio → Show) erst danach. Sie braucht ein neues Sim-Modul und neue Räume.
5. Browser-Check und Mobil-Layout einmal real testen (nur Node-Tests gelaufen).
