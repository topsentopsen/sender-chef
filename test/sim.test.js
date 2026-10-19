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
