'use strict';
const test = require('node:test');
const assert = require('node:assert');
const SC = require('./helper');
const sim = SC.sim;

test('neues Spiel ist reproduzierbar', () => {
  const a = sim.newGame(42), b = sim.newGame(42);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.films.length, 4);
  assert.strictEqual(a.dealer.length, 8);
  assert.strictEqual(a.rivals.length, 2);
});

test('Zweistunden-Film belegt zwei Slots und passt nicht um 23 Uhr', () => {
  const s = sim.newGame(7);
  const f = sim.buyFilm(s, s.dealer[0].id) && s.films[s.films.length - 1];
  f.len = 2;
  assert.strictEqual(sim.setSlot(s, 23, f.id).ok, false);
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
  assert.strictEqual(r.hours.length, 6);
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
