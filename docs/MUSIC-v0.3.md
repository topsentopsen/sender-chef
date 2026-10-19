# Musik v0.3 – Spezifikation (kein Code geändert)

Ziel: prozedurale Hintergrundmusik und kurze Jingles per Web Audio API in `js/audio.js`. Kein Build, keine Audiodateien, keine fremden Samples, keine Netzzugriffe. Alles entsteht zur Laufzeit aus Oszillatoren und selbst geschriebenen Zahlenfolgen.

## 1. Urheberrecht und Originalität (verbindlich)

- Alle Melodien, Bässe und Rhythmen sind **eigene Kompositionen**. Nichts wird nachgespielt oder »angelehnt«: weder Mad TV noch Nachrichten-Jingles bekannter Sender, noch Pop-, Film- oder Fernsehmelodien.
- Kompositionsweg: Tonleiter wählen, Motiv von 3–5 Tönen frei erfinden, per Verschiebung und Umkehrung variieren. Nicht »aus dem Kopf« einer bekannten Melodie ableiten.
- Melodien liegen als Zahlenarrays im Code (MIDI-ähnlich: Tonnummer, `0` = Pause, Dauer in Schritten). Loops dauern 4–8 Takte.
- Checkliste für die spätere Originalitätsprüfung steht in Abschnitt 8.

## 2. Datei, Schnittstelle und Einbindung

`js/audio.js` als klassisches Skript, Namespace `window.SC.audio`. In `index.html` nach `ui.js` und vor `main.js` laden (`<script src="js/audio.js">`). `sim.js`, `data.js` und `building.js` bleiben unberührt. Es gibt keinen Audio-Zustand im Spielstand-Objekt `s`.

```
SC.audio = {
  unlock(),               // erzeugt/aktiviert AudioContext nach User-Geste
  play(trackId),          // 'title' | 'tower' | 'evening' | 'balance'; wechselt mit Überblendung (0,6 s)
  stop(),                 // Musik ausblenden
  jingle(id),             // 'door' | 'buy' | 'spotOk' | 'spotFail' | 'win' | 'lose'
  setMuted(bool), isMuted(),
  setVolume(0..1), getVolume(),
  state()                 // { muted, volume, ready } für das HUD
}
```

Sämtliche Aufrufe sind **No-Ops**, solange der Kontext nicht freigeschaltet ist oder kein `AudioContext` existiert (altes Browser, Node-Tests). Kein Wurf von Ausnahmen aus `audio.js` in die Spielschleife.

## 3. Klangerzeugung

- Ein `AudioContext`, ein Master-`GainNode` (Lautstärke), dahinter optional ein `DynamicsCompressorNode` gegen Übersteuern.
- Stimmen: Melodie (`square` oder `triangle`), Bass (`triangle`), Arpeggio/Begleitung (`square`, kleine Lautstärke), Schlagwerk (Rauschen aus einem einmal erzeugten `AudioBuffer`, kurze Hüllkurve für Hi-Hat und Snare; Bassdrum als `sine` mit fallender Frequenz).
- Hüllkurve pro Ton: `GainNode` mit `linearRampToValueAtTime` (Attack 5 ms, Release 40–120 ms), damit es nicht knackt.
- Tonhöhe: `freq = 440 · 2^((note − 69)/12)`.
- Zeitplanung: Lookahead-Scheduler (Timer alle 25 ms plant Noten, die in den nächsten 120 ms anfallen, mit `ctx.currentTime`). Kein `setTimeout` pro Note. Beim Wechsel eines Stücks werden die noch offenen Stimmen mit kurzem Release beendet, dann neue geplant.
- Schrittraster: Sechzehntel, 1 Schritt = `60 / bpm / 4` Sekunden. Takt = 16 Schritte.
- Performance: höchstens etwa 8 gleichzeitige Oszillatoren; jede Stimme räumt sich nach `stop()` selbst ab (`onended` → `disconnect`).

## 4. Datenformat der Stücke

```
SC.audio.TRACKS = {
  title: { bpm: 96, bars: 8, scale: 'moll', lead: [[note, dauerInSchritten], ...], bass: [...], perc: [...] },
  ...
}
```

- `lead`/`bass`: Listen von `[midiNote, länge]`, Pause als `[0, länge]`; Summe der Längen = `bars · 16`.
- `perc`: String pro Takt (z. B. `'k.h.s.h.k.h.s.hh'`, k = Bassdrum, s = Snare, h = Hi-Hat, `.` = Pause), 16 Zeichen je Takt.
- Alle Stücke laufen als Loop. Der Scheduler startet nach Ende bei Takt 1 neu.
- Tonart je Stück ist frei gewählt (siehe Tabelle). Die Notenwerte werden **erst beim Komponieren** festgelegt (Abschnitt 8 gilt dafür).

## 5. Stücke und Jingles

| ID | Einsatz | Charakter | Tempo | Länge | Stimmen |
|----|---------|-----------|-------|-------|---------|
| `title` | Titelbild, Menü | gemächlich, leicht verwegen, Dur-Pentatonik | 92 | 8 Takte | Lead (square), Bass, leichter Beat |
| `tower` | Tag im Hochhaus (08–18 Uhr) | geschäftig, treibend, ruhig genug für Dauerbetrieb | 108 | 8 Takte | Bass-Ostinato, Arpeggio, spärliche Lead-Figur, Hi-Hat |
| `evening` | Sendeabend (Animation) | gespannt, steigernd, etwas dichter | 120 | 6 Takte | Lead, Bass, Beat mit Snare auf 2/4 |
| `balance` | Tagesbilanz | ruhig, abschließend, Moll-Pentatonik, ohne Schlagwerk | 80 | 4 Takte | Lead (triangle), Bass |

Jingles (nicht loopend, Lautstärke etwas über der Musik, Musik läuft währenddessen weiter, kurzer Duck auf 70 %):

| ID | Wann | Idee | Dauer |
|----|------|------|-------|
| `door` | Tür betreten (`building.js` Rückruf) | zwei kurze Töne, aufsteigend, Pulse | ca. 0,2 s |
| `buy` | Kauf/Verkauf erfolgreich (`buyFilm`, `signAd`, Verkauf) | Münzklang aus zwei hohen Quadratwellen | ca. 0,25 s |
| `spotOk` | Spot erfüllt (Sendeabend-Tabelle) | kurzer Dur-Dreiklang aufwärts | ca. 0,3 s |
| `spotFail` | Spot verfehlt | zwei fallende Töne, dumpf (triangle) | ca. 0,3 s |
| `win` | Sieg | kurze Fanfare, 5–6 Töne, Dur | ca. 1,5 s |
| `lose` | Niederlage (gefeuert/Pleite/Liebe verloren) | langsam fallende Linie, Moll | ca. 1,5 s |

Alle Jingle-Notenfolgen sind frei erfunden, ohne Anlehnung an bekannte Signale oder Erkennungsmelodien.

## 6. Bedienung, Zustimmung und Speicherung

- **Start erst nach Geste:** `AudioContext` wird erst beim ersten Klick/Tastendruck erzeugt oder `resume()`d (Titelbild: Klick auf »Neues Spiel«/»Weiterspielen« reicht). Vor der Geste passiert nichts, auch keine Fehlermeldung.
- **HUD:** In `index.html` im Block `.hud-btns` ein Knopf `#btn-sound` (Beschriftung »Ton an«/»Ton aus«) und ein Lautstärkeregler `<input type="range" id="vol" min="0" max="100">`, beide mit `title`/`aria-label`. Auf kleinen Bildschirmen reicht der Knopf, der Regler darf ausgeblendet werden. Stil per `css/style.css` im bestehenden Look.
- **Speicherung:** Eigener `localStorage`-Schlüssel `senderchef-audio` mit `{"muted":false,"volume":0.5}` in `try/catch` (wie `sim.save`). Kein Eintrag im Spielstand-Objekt, damit alte Spielstände und `migrate` unberührt bleiben. Fehlt der Eintrag: `muted=false`, `volume=0.5`. Werte mit `Number.isFinite` und Bereichsprüfung laden.
- **Voreinstellung:** Lautstärke moderat (0,5 × interner Master 0,25), damit niemand erschrickt.
- **Tabwechsel:** `document.visibilitychange` → bei `hidden` `ctx.suspend()`, bei `visible` `ctx.resume()`.
- **Tastatur:** Taste `M` schaltet Ton um. Eintrag im bestehenden `keydown`-Handler (`ui.js:548`), gleiche Overlay-/Button-Fokus-Regeln wie für die anderen Tasten (siehe REVIEW-v0.2, Punkt 6).

## 7. Anbindung (ohne Logik in `sim.js`)

Nur Aufrufe aus der Darstellungsschicht. Jeder Aufruf geht über `SC.audio && SC.audio.xyz(...)`, damit nichts ausfällt, wenn die Datei fehlt.

| Ort | Auslöser | Aufruf |
|-----|----------|--------|
| `ui.js` `showTitle` | Titel sichtbar | `play('title')` (wirksam erst nach `unlock`) |
| `ui.js` Klickhandler `t-new`/`t-continue` | erste Geste | `unlock()`, danach `play('tower')` |
| `ui.js` `afterLoad` / `nextDay`-Rückkehr | neuer Tag | `play('tower')` |
| `ui.js` `startEvening` | Sendeabend startet | `play('evening')` |
| `ui.js` `showBilanz` | Bilanz | `play('balance')` |
| `ui.js` Endbildschirm (Sieg/Niederlage) | `s.over` gesetzt | `jingle('win')` oder `jingle('lose')`, Musik ausblenden |
| `ui.js` `openRoom` (aus `building.update`-Rückruf) | Tür betreten | `jingle('door')` |
| `ui.js` Kauf/Verkauf/Vertrag erfolgreich (Ergebnis `ok`) | Aktion | `jingle('buy')` |
| `ui.js` Sendeabend-Animation `addTvRow` | Spot erfüllt/verfehlt (`hr.ad.ok`) | `jingle('spotOk')` / `jingle('spotFail')` |
| `index.html` / `ui.js` `init` | HUD-Knopf, Regler | `setMuted`, `setVolume`, Beschriftung aktualisieren |

`main.js` braucht keine Änderung, außer dem Eintrag in `SC.debug` (`audio: () => SC.audio.state()`) und optional einer `SC.audio.init()` in `DOMContentLoaded`, die den gespeicherten Zustand liest.

Unter `?debug` oder in Tests: `SC.audio` darf nicht scheitern, wenn es kein `AudioContext` gibt (Node `test/helper.js`). Dort wird `audio.js` nicht geladen.

## 8. Checkliste Originalitätsprüfung (vor Veröffentlichung)

Für jedes Stück und jeden Jingle ausfüllen, Ergebnis in `docs/MUSIC-CHECK.md` ablegen.

- [ ] Entstehung dokumentiert: Tonleiter, Motiv (Tonfolge), Variationsverfahren, Datum, wer es geschrieben hat.
- [ ] Intervallfolge des Hauptmotivs (erste 8–12 Töne) notiert. Sie ergibt **keine** bekannte Melodie, auch nicht transponiert, im anderen Rhythmus oder rückwärts.
- [ ] Kein Motiv aus TV-Themen, Nachrichten-Erkennungsmelodien, Werbejingles, Filmmusik, Videospielen oder Popsongs, insbesondere nicht aus Mad TV (1991) oder anderen Aufgaben aus der Genre-Vorlage.
- [ ] Keine charakteristische Akkordfolge samt Rhythmus eines bekannten Stücks (zum Beispiel keine bekannte Signal-Dreiklangsfolge mit Pause und Wiederholung als Nachrichten-Anmutung).
- [ ] Fanfaren (`win`) und Signale (`door`, `buy`) nicht aus bekannten Konsolen-, Quiz- oder Sender-Signalen übernommen. Töne und Reihenfolge sind frei gewählt.
- [ ] Hörprobe durch mindestens zwei Personen: »Erinnert das an etwas?« Bei Zweifel Motiv ändern (andere Intervalle und Rhythmus), nicht nur die Tonart.
- [ ] Optionale Gegenprobe: Melodie-Suche in öffentlichen Diensten (z. B. per Notenfolge oder Summen) ohne Treffer.
- [ ] Keine Samples, Audiodateien oder Soundfonts im Repo (`git ls-files | grep -Ei '\.(mp3|ogg|wav|mid)$'` bleibt leer).
- [ ] Lizenzhinweis im Footer oder README: »Musik und Klänge im Spiel sind selbst erzeugt.«

## 9. Tests

- `tests/audio.test.mjs` (Node): Notentabellen prüfen, ohne Audio zu erzeugen. Für jedes Stück: Längen-Summen gleich `bars·16`, alle Noten Ganzzahlen im Bereich 0 oder 24–96, `perc`-Strings 16 Zeichen je Takt. Das schützt vor kaputten Loops.
- Smoke-Test im Browser (bestehendes `test/browser-check.js`): kein Konsolenfehler beim Laden, Klick auf Ton-Knopf wechselt Beschriftung, `localStorage['senderchef-audio']` ändert sich.
- Manuell: Pegel zwischen Stücken und Jingles, Wechsel ohne Knacken, Tab im Hintergrund.

## 10. Bewusst offen

- Dynamische Musik (Intensität nach Quote), mehrere Varianten pro Tag.
- Geräusche für Aufzug, Kasse, Applaus (PLAN Phase 5).
- Stereo-Panning, Hall, Filter-Effekte.
- Eigener Musikeditor für Notenfolgen.
