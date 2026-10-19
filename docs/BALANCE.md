# Balance-Protokoll

## Vorher (v0.2.1, 19.10.2026)

`node tools/bot.js 300`

| Strategie | Ergebnis | Anzahl | Median Endtag |
|---|---|---|---|
| passiv | gefeuert | 300 | 5 |
| einfach | sieg | 29 (9,7 %) | 26 |
| einfach | gefeuert | 268 | 21 |
| einfach | liebe | 3 | 40 |

## Nachher (v0.3.0, 19.10.2026)

Spezifikation: `docs/BALANCE-v0.3.md`. Zusätzlich Reserve-Hebel R3: Herz Rang 1 von 9 auf 10 (Alt-Seeds lagen sonst bei 21 %).

`node tools/bot.js 300` (Seeds `seed·7919`):

| Strategie | Ergebnis | Anzahl | Median | p10–p90 | min–max |
|---|---|---|---|---|---|
| passiv | gefeuert:mood | 300 | 6 | 5–7 | 5–12 |
| einfach | sieg | 98 (32,7 %) | 11 | 9–15 | 8–18 |
| einfach | gefeuert:mood | 191 | 24 | 19–29 | 15–36 |
| einfach | liebe | 11 | 29 | 28–33 | 27–41 |

Validierung Alt-Seeds (`seed·7919 + 100000`): Sieg 88/300 (29,3 %), Median Tag 11, min 8.

Zielkorridor (25–35 % Siege, Median 10–14, passiv früh raus, Niederlagen möglich): **erreicht**.

Stellschrauben in `js/sim.js`: Herz Spieler `[10,3,0]` + Kultur 3, Rivalen-Herz `[4,1,0]`, rBonus 0,95–1,05, forecast-Default 1,0, imgF `0.94+img·0.002`, Image-Kampf Boden 12 / Deckel 60, Rivalen-Neufilme langsamer, Händlerklau p=0,15.
