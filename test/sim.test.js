'use strict';
const test = require('node:test');
const assert = require('node:assert');
const SC = require('./helper');
const sim = SC.sim;

test('neues Spiel ist reproduzierbar', () => {
  const a = sim.newGame(42), b = sim.newGame(42);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.films.length, 6);
  assert.strictEqual(a.dealer.length, 8);
  assert.strictEqual(a.rivals.length, 2);
});

test('Zweistunden-Film belegt zwei Slots und passt nicht um 0 Uhr', () => {
  const s = sim.newGame(7);
  const f = sim.buyFilm(s, s.dealer[0].id) && s.films[s.films.length - 1];
  f.len = 2;
  assert.strictEqual(sim.setSlot(s, 24, f.id).ok, false);
  assert.strictEqual(sim.setSlot(s, 18, f.id).ok, true);
  assert.strictEqual(s.plan[18].film, f.id); assert.strictEqual(s.plan[19].film, f.id); assert.strictEqual(s.plan[19].part, 1);
  sim.setSlot(s, 19, null);
  assert.strictEqual(s.plan[18].film, null);
});

test('Ein Film läuft höchstens einmal pro Abend', () => {
  const s = sim.newGame(3); const f = s.films[0];
  sim.setSlot(s, 18, f.id); sim.setSlot(s, 22, f.id);
  const n = sim.HOURS ? 0 : SC.HOURS.filter(h => s.plan[h] && s.plan[h].film === f.id && !s.plan[h].part).length;
  assert.strictEqual(n, 1);
});

test('Abend, Bilanz und nächster Tag laufen durch', () => {
  const s = sim.newGame(99);
  const money0 = s.money;
  const r = sim.runEvening(s);
  assert.strictEqual(s.phase, 'bilanz');
  assert.strictEqual(r.hours.length, 7);
  assert.ok(r.rank >= 1 && r.rank <= 3);
  assert.ok(s.money !== money0);
  sim.nextDay(s);
  assert.strictEqual(s.day, 2); assert.strictEqual(s.phase, 'tag');
  assert.strictEqual(s.dealer.length, 8); assert.strictEqual(s.newsOffer.length, 6);
});

test('Vertragsstrafe bei Fristablauf', () => {
  const s = sim.newGame(5);
  const ad = s.ads[0]; ad.minV = 999999; ad.deadline = s.day;
  sim.runEvening(s);
  assert.ok(s.last.failed.includes(ad.sponsor));
  assert.strictEqual(s.last.penalties, ad.penalty);
});

test('Spielstand speichern und laden', () => {
  const s = sim.newGame(11); sim.save(s);
  assert.deepStrictEqual(sim.load(), JSON.parse(JSON.stringify(s)));
});

test('Passiver Spieler verliert irgendwann, Spiel endet', () => {
  const s = sim.newGame(1234);
  for (let i = 0; i < 60 && !s.over; i++) { sim.runEvening(s); sim.nextDay(s); }
  assert.ok(s.over);
});

test('Image-Summe bleibt 100', () => {
  const s = sim.newGame(77);
  for (let i = 0; i < 5 && !s.over; i++) {
    sim.runEvening(s);
    assert.strictEqual(s.image + s.rivals[0].image + s.rivals[1].image, 100);
    sim.nextDay(s);
  }
});

test('Herz nie über Image-Deckel, Geschenke wirken weniger bei Wiederholung', () => {
  const s = sim.newGame(8); s.money = 1e6;
  sim.buyGift(s, 'konzert'); sim.buyGift(s, 'konzert');
  sim.giveGift(s, 0); const h1 = s.heart; sim.giveGift(s, 0);
  assert.ok(h1 === 20); assert.ok(s.heart - h1 === 10);
  s.heart = 0; s.image = 10; s.gifts = ['konzert']; sim.giveGift(s, 0);
  assert.ok(s.heart <= sim.heartCap(10));
});

test('Auktion: KI bietet mit, Zuschlag um 16 Uhr', () => {
  const s = sim.newGame(21); s.auction.limits = [9e9, 0];
  assert.ok(sim.bid(s).ok);
  for (let m = 8 * 60; m <= 16 * 60; m += 30) { s.minute = m; sim.auctionTick(s); }
  assert.ok(s.auction.done);
  assert.strictEqual(s.rivals[0].films.includes(s.auction.film), true);
});

test('Höchstens 2 Spots je Vertrag und Abend', () => {
  const s = sim.newGame(13); const ad = s.ads[0]; ad.minV = 1; ad.spots = 5; ad.deadline = 99;
  SC.HOURS.forEach(h => sim.setAd(s, h, ad.id));
  sim.runEvening(s);
  assert.strictEqual(ad.done, 2);
});

test('Keine Aktionen in der Bilanzphase', () => {
  const s = sim.newGame(4); sim.runEvening(s);
  assert.strictEqual(sim.buyFilm(s, s.dealer[0].id).ok, false);
  assert.strictEqual(sim.takeCredit(s, 1000).ok, false);
});

test('migrate hebt v1 auf v2', () => {
  const raw = JSON.parse(JSON.stringify(sim.newGame(1)));
  raw.v = 1;
  delete raw.heart; delete raw.gifts; delete raw.giftUse; delete raw.agencies;
  raw.image = 1.2;
  raw.rivals.forEach(r => { delete r.image; delete r.heart; });
  raw.newsOffer.forEach(n => { delete n.agency; });
  raw.over = 'sieg';
  const m = sim.migrate(raw);
  assert.ok(m);
  assert.strictEqual(m.v, 2);
  assert.strictEqual(m.image, 33);
  assert.strictEqual(m.heart, 0);
  assert.deepStrictEqual(m.gifts, []);
  assert.strictEqual(m.agencies.politik, true);
  assert.strictEqual(m.over, null);
  assert.strictEqual(m.rivals[0].image, 33);
  assert.strictEqual(m.rivals[1].image, 34);
  assert.ok(m.newsOffer[0].agency);
});

test('migrate lehnt kaputte Spielstände ab', () => {
  assert.strictEqual(sim.migrate(null), null);
  assert.strictEqual(sim.migrate({ v: 99, money: 1, plan: {}, films: [], dealer: [], adsOffer: [], ads: [], newsOffer: [], news: [], rivals: [], history: [], log: [] }), null);
  const s = JSON.parse(JSON.stringify(sim.newGame(1)));
  const a = JSON.parse(JSON.stringify(s)); a.plan = null;
  assert.strictEqual(sim.migrate(a), null);
  const b = JSON.parse(JSON.stringify(s)); b.money = NaN;
  assert.strictEqual(sim.migrate(b), null);
  const c = JSON.parse(JSON.stringify(s)); delete c.films;
  assert.strictEqual(sim.migrate(c), null);
  const d = JSON.parse(JSON.stringify(s)); d.rivals[0].films = null;
  assert.strictEqual(sim.migrate(d), null);
});

test('migrate füllt fehlende Felder auf', () => {
  const s = JSON.parse(JSON.stringify(sim.newGame(2)));
  delete s.agencies; delete s.gifts; delete s.giftUse; delete s.titleUse; delete s.stats;
  s.rivals[0].plan = null;
  const m = sim.migrate(s);
  assert.ok(m);
  assert.deepStrictEqual(m.agencies, { politik: true, showbiz: false, vermischt: false });
  assert.deepStrictEqual(m.gifts, []);
  assert.ok(m.giftUse);
  assert.ok(m.titleUse);
  assert.ok(m.stats);
  assert.deepStrictEqual(m.rivals[0].plan, {});
});

test('KI plant 2-Stunden-Filme über zwei Slots', () => {
  const s = sim.newGame(1);
  const r = s.rivals[0];
  r.films.forEach(f => { f.len = 1; f.q = 10; });
  r.films[0].len = 2; r.films[0].q = 99;
  sim.planRivals(s);
  const hs = SC.HOURS.filter(h => r.plan[h] === r.films[0].id);
  assert.strictEqual(hs.length, 2);
  assert.strictEqual(hs[1], hs[0] + 1);
  assert.ok(hs[0] + 1 <= 24);
  const res = sim.runEvening(s);
  const part2 = res.hours.find(hr => hr.h === hs[1]);
  assert.ok(part2.titles[1].includes('Teil 2'));
});

test('KI setzt keinen 2-Stunden-Film um 0 Uhr an', () => {
  const s = sim.newGame(1);
  s.rivals.forEach(r => r.films.forEach(f => { f.len = 2; f.q = 50; }));
  sim.planRivals(s);
  s.rivals.forEach(r => {
    SC.HOURS.forEach(h => {
      const id = r.plan[h]; if (!id) return;
      const f = r.films.find(x => x.id === id);
      if (!f || f.len !== 2) return;
      const other = SC.HOURS.find(hh => hh !== h && r.plan[hh] === id);
      assert.ok(other != null);
      assert.strictEqual(Math.abs(other - h), 1);
    });
    assert.ok(!r.plan[24] || r.plan[23] === r.plan[24]);
  });
});

test('überzählige Spots gelten als übersprungen', () => {
  const s = sim.newGame(13); const ad = s.ads[0]; ad.minV = 1; ad.spots = 5; ad.deadline = 99;
  SC.HOURS.forEach(h => sim.setAd(s, h, ad.id));
  const res = sim.runEvening(s);
  const skips = res.hours.filter(hr => hr.ad && hr.ad.skip);
  assert.ok(skips.length >= SC.HOURS.length - 2);
  assert.ok(skips.every(hr => hr.ad.ok === false));
  assert.strictEqual(ad.done, 2);
});

test('Herz fällt durch Image-Deckel höchstens um 5', () => {
  const s = sim.newGame(8);
  s.heart = 80; s.image = 10;
  s.rivals[0].image = 45; s.rivals[1].image = 45;
  SC.HOURS.forEach(h => sim.setSlot(s, h, null));
  const res = sim.runEvening(s);
  assert.strictEqual(s.heart, 75);
  assert.strictEqual(res.heartDelta, -5);
  assert.ok(res.heartCapHit);
});
