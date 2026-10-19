# Sender-Chef

Retro-Fernsehsender-Manager für den Browser im Amiga-Stil. **Inspiriert von Mad TV (1991)**, eigenständiges Fanprojekt mit eigener Grafik, eigenen Namen und eigenen Texten, ohne Original-Inhalte.

**Spielen:** https://topsentopsen.github.io/sender-chef/ (oder `index.html` lokal öffnen)

## Worum geht es?
Du leitest den kleinen Sender **Welle 7** in einem Hochhaus, in dem auch die Konkurrenz **Blitz TV** und **Kanal Krawall** sitzt. Bis 18 Uhr läufst du mit dem Aufzug durchs Haus, kaufst Filme, unterschreibst Werbeverträge und holst Nachrichten. Von 18 bis 24 Uhr wird gesendet, danach kommt die Tagesbilanz. Bring die Chefin mit Quoten auf Laune 100.

## Technik
- Reines HTML/CSS/JavaScript, kein Build, keine Pakete. Grafik prozedural per Canvas.
- Spielstand im `localStorage` (Schlüssel `senderchef-save-v1`).
- `js/data.js` Daten, `js/sim.js` Spiellogik (ohne DOM, mit Seed-Zufall), `js/building.js` Hochhaus, `js/ui.js` Oberfläche, `js/main.js` Schleife.
- Tests: `node --test test/*.test.js`; Browserprüfung: `node test/browser-check.js` (puppeteer-core und Chrome nötig).
- Plan und Phasen: `docs/PLAN.md`.
