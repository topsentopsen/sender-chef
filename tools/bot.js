// Balance-Läufe: node tools/bot.js [Seeds]  (passiver und einfacher Bot)
'use strict';
const SC = require('../test/helper');
const sim = SC.sim;
const N = Number(process.argv[2] || 200);
const V = process.argv[3] === 'v';
function smart(s) {
  const df = [...s.dealer].sort((a, b) => b.q - a.q);
  for (const f of df) {
    const worst = [...s.films].sort((a, b) => a.q - b.q)[0];
    if (f.q > worst.q + 10 && s.money + sim.sellPrice(worst) - f.price > 50000) { if (s.films.length >= 14) sim.sellFilm(s, worst.id); sim.buyFilm(s, f.id); }
  }
  while (s.ads.length < 4 && s.adsOffer.length) { const a = [...s.adsOffer].sort((x, y) => x.minV - y.minV)[0]; if (sim.signAd(s, a.id).ok !== true) break; }
  const used = new Set();
  for (const h of SC.HOURS) sim.setSlot(s, h, null);
  for (const h of [20, 21, 19, 22, 18, 23, 24]) {
    const p = sim.slot(s, h); if (p.film) continue; let best = null, bv = -1;
    s.films.forEach(f => { if (used.has(f.id) || h + f.len - 1 > 24 || (f.len === 2 && sim.slot(s, h + 1).film)) return; const v = sim.attr(f, h, 33, 0, 1); if (v > bv) { bv = v; best = f; } });
    if (best) { sim.setSlot(s, h, best.id); used.add(best.id); }
  }
  for (const h of SC.HOURS) { const fc = sim.forecast(s, h); const a = s.ads.filter(a => a.minV <= fc * 0.9).sort((x, y) => (x.deadline - y.deadline) || (y.pay - x.pay))[0]; sim.setAd(s, h, a ? a.id : null); }
  [...s.newsOffer].sort((a, b) => b.appeal - a.appeal).slice(0, 2).forEach(x => sim.buyNews(s, x.id));
  if (s.money > 120000) { sim.buyGift(s, 'pralinen'); sim.giveGift(s, 0); }
  if (s.auction && s.money > s.auction.film.price * 1.5) sim.bid(s);
  for (let m = 8 * 60; m <= 16 * 60; m += 30) { s.minute = m; sim.auctionTick(s); if (s.auction.bidder > 0 && s.money > s.auction.bid * 2 && s.auction.bid < s.auction.film.price) sim.bid(s); }
}
const out = {};
for (const strat of ['passiv', 'einfach']) for (let seed = 1; seed <= N; seed++) {
  const s = sim.newGame(seed * 7919); let d = 0;
  for (; d < 60 && !s.over; d++) { if (strat === 'einfach') smart(s); const r = sim.runEvening(s);
    if (V && strat === 'einfach') console.log(r.day, 'Platz', r.rank, r.totals.join('/'), 'Werbung', r.income, 'Basis', r.baseIncome, 'Strafe', r.penalties, 'Geld', s.money, 'Kredit', s.credit, 'Chef', s.mood, 'Image', s.image + '/' + s.rivals.map(x => x.image).join('/'), 'Herz', s.heart, 'Filme', s.films.length, s.over || '');
    sim.nextDay(s); }
  const k = strat + ':' + (s.over || 'offen'); (out[k] = out[k] || []).push(s.day);
}
for (const k of Object.keys(out).sort()) { const v = out[k].sort((a, b) => a - b); console.log(k.padEnd(22), 'Anzahl', String(v.length).padStart(4), ' Endtag Median', v[v.length >> 1], ' min', v[0], ' max', v[v.length - 1]); }
