// Sender-Chef: Spiellogik ohne Darstellung (Wirtschaft, Quoten, KI-Sender, Spielstand)
'use strict';
(function (SC) {
  const KEY = 'senderchef-save-v1';
  const ROMAN = ['', '', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function rnd(s) { // mulberry32, Zustand im Spielstand
    let t = (s.rs = (s.rs + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ri = (s, a, b) => a + Math.floor(rnd(s) * (b - a + 1));
  const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function log(s, msg) { s.log.unshift('Tag ' + s.day + ': ' + msg); if (s.log.length > 40) s.log.length = 40; }

  function makeFilm(s, qMin, qMax) {
    const gid = pick(s, SC.GENRE_IDS);
    const g = SC.GENRES[gid];
    const base = pick(s, g.titles);
    const n = (s.titleUse[base] || 0) + 1; s.titleUse[base] = n;
    const title = n === 1 ? base : (n < ROMAN.length ? base + ' ' + ROMAN[n] : base + ' Teil ' + n);
    const q = clamp(ri(s, Math.round(qMin), Math.round(qMax)), 5, 99);
    const len = g.long && rnd(s) < 0.45 ? 2 : 1;
    const year = ri(s, 1952, 1991);
    const ageF = 0.85 + (year - 1952) / 39 * 0.3;
    const price = Math.round(((q * q * 15 + 4000) * (len === 2 ? 1.45 : 1) * ageF) / 1000) * 1000;
    return { id: s.nextId++, title, genre: gid, q, len, year, price, top: 1, plays: 0 };
  }

  function makeAd(s) {
    const t = rnd(s);
    const minV = Math.round((120 + t * t * 1800 + s.day * 25) / 10) * 10;
    const spots = ri(s, 2, 5);
    const days = Math.max(2, Math.ceil(spots / 2) + ri(s, 1, 3));
    const pay = Math.round((minV * 24 + 4000) / 500) * 500;
    const penalty = Math.round(pay * spots * 0.6 / 1000) * 1000;
    return { id: s.nextId++, sponsor: pick(s, SC.SPONSORS), minV, spots, done: 0, days, deadline: 0, pay, penalty };
  }

  function makeNews(s, used) {
    let n, guard = 0;
    do { n = pick(s, SC.NEWS); guard++; } while (used.has(n.t) && guard < 50);
    used.add(n.t);
    const appeal = clamp(n.a + ri(s, -2, 2), 1, 12);
    return { id: s.nextId++, title: n.t, cat: n.c, appeal, cost: Math.round((appeal * 1500 + ri(s, 0, 3000)) / 500) * 500 };
  }

  function dealerRange(s) { return [Math.min(60, 10 + s.day * 2), Math.min(98, 60 + s.day * 3)]; }

  function refreshDealer(s) {
    const [a, b] = dealerRange(s);
    while (s.dealer.length < 8) s.dealer.push(makeFilm(s, a, b));
  }
  function refreshAds(s) { while (s.adsOffer.length < 6) s.adsOffer.push(makeAd(s)); }
  function refreshNews(s) {
    const used = new Set(); s.newsOffer = [];
    for (let i = 0; i < 6; i++) s.newsOffer.push(makeNews(s, used));
    s.news = [];
  }

  function newGame(seed) {
    const s = {
      v: 1, rs: (seed >>> 0) || 1, nextId: 1, titleUse: {}, day: 1, minute: SC.DAY_START, phase: 'tag',
      money: 250000, credit: 0, creditMax: 500000, mood: 50, image: 1,
      films: [], dealer: [], adsOffer: [], ads: [], newsOffer: [], news: [], plan: {},
      rivals: [], history: [], log: [], last: null, over: null, stats: { bought: 0, spots: 0, best: 0 }
    };
    for (let i = 0; i < 4; i++) s.films.push(makeFilm(s, 25, 50));
    SC.RIVALS.forEach(r => {
      const rv = { name: r.name, col: r.col, image: 1, films: [], plan: {} };
      for (let i = 0; i < 7; i++) rv.films.push(makeFilm(s, r.qMin, r.qMax));
      s.rivals.push(rv);
    });
    refreshDealer(s); refreshAds(s); refreshNews(s);
    const a = makeAd(s);
    Object.assign(a, { sponsor: 'Knusperflocken AG', minV: 150, spots: 3, pay: 5500, penalty: 8000, days: 3, deadline: s.day + 2 });
    s.ads.push(a);
    // Beispielplan, damit der erste Abend nicht nur Testbild ist
    [19, 20, 21, 22].forEach((h, i) => { const f = s.films[i]; if (f && !slot(s, h).film) setSlot(s, h, f.id); });
    slot(s, 19).ad = a.id;
    planRivals(s);
    log(s, 'Willkommen bei ' + SC.PLAYER.name + '! Die Chefin erwartet Quote.');
    return s;
  }

  const filmById = (s, id) => s.films.find(f => f.id === id) || null;
  function slot(s, h) { return s.plan[h] || (s.plan[h] = { film: null, part: 0, ad: null }); }

  function clearFilmAt(s, h) {
    const p = s.plan[h]; if (!p || !p.film) return;
    const fid = p.film, start = h - (p.part || 0);
    for (let k = 0; k < 3; k++) { const q = s.plan[start + k]; if (q && q.film === fid) { q.film = null; q.part = 0; } }
  }

  function setSlot(s, h, fid) {
    if (s.phase !== 'tag') return { ok: false, msg: 'Der Plan ist für heute schon gesendet.' };
    if (!fid) { clearFilmAt(s, h); return { ok: true }; }
    const f = filmById(s, fid); if (!f) return { ok: false, msg: 'Film nicht im Archiv.' };
    if (h + f.len - 1 > 23) return { ok: false, msg: 'Der Film dauert ' + f.len + ' Stunden und passt hier nicht mehr hinein.' };
    for (const hh of SC.HOURS) { const p = s.plan[hh]; if (p && p.film === fid) clearFilmAt(s, hh); }
    for (let k = 0; k < f.len; k++) { clearFilmAt(s, h + k); const p = slot(s, h + k); p.film = fid; p.part = k; }
    return { ok: true };
  }
  function setAd(s, h, adId) {
    if (s.phase !== 'tag') return { ok: false };
    slot(s, h).ad = adId || null; return { ok: true };
  }

  function buyFilm(s, id) {
    const i = s.dealer.findIndex(f => f.id === id); if (i < 0) return { ok: false, msg: 'Nicht mehr im Angebot.' };
    const f = s.dealer[i];
    if (s.money < f.price) return { ok: false, msg: 'Zu wenig Geld. Vielleicht hilft die Bank?' };
    s.money -= f.price; s.dealer.splice(i, 1); s.films.push(f); s.stats.bought++;
    log(s, 'Film gekauft: »' + f.title + '«');
    return { ok: true };
  }
  function sellPrice(f) { return Math.round(f.price * (0.25 + 0.2 * f.top) / 500) * 500; }
  function sellFilm(s, id) {
    const i = s.films.findIndex(f => f.id === id); if (i < 0) return { ok: false };
    const f = s.films[i];
    for (const h of SC.HOURS) { const p = s.plan[h]; if (p && p.film === id) clearFilmAt(s, h); }
    s.money += sellPrice(f); s.films.splice(i, 1);
    log(s, 'Film verkauft: »' + f.title + '«');
    return { ok: true };
  }
  function signAd(s, id) {
    if (s.ads.length >= SC.MAX_ADS) return { ok: false, msg: 'Mehr als ' + SC.MAX_ADS + ' Verträge gleichzeitig gehen nicht.' };
    const i = s.adsOffer.findIndex(a => a.id === id); if (i < 0) return { ok: false };
    const a = s.adsOffer[i]; a.deadline = s.day + a.days - 1;
    s.adsOffer.splice(i, 1); s.ads.push(a);
    log(s, 'Werbevertrag mit ' + a.sponsor + ' unterschrieben.');
    return { ok: true };
  }
  function buyNews(s, id) {
    if (s.news.length >= SC.MAX_NEWS) return { ok: false, msg: 'Mehr als ' + SC.MAX_NEWS + ' Meldungen passen nicht in die Sendung.' };
    const i = s.newsOffer.findIndex(n => n.id === id); if (i < 0) return { ok: false };
    const n = s.newsOffer[i];
    if (s.money < n.cost) return { ok: false, msg: 'Zu wenig Geld.' };
    s.money -= n.cost; s.newsOffer.splice(i, 1); s.news.push(n);
    return { ok: true };
  }
  function newsBonus(s) { return 1 + Math.min(0.25, s.news.reduce((a, n) => a + n.appeal, 0) / 120); }
  function takeCredit(s, amt) {
    amt = Math.min(amt, s.creditMax - s.credit); if (amt <= 0) return { ok: false, msg: 'Kreditrahmen ausgeschöpft.' };
    s.credit += amt; s.money += amt; return { ok: true };
  }
  function repay(s, amt) {
    amt = Math.min(amt, s.credit, Math.max(0, s.money)); if (amt <= 0) return { ok: false, msg: 'Nichts zu tilgen oder kein Geld.' };
    s.credit -= amt; s.money -= amt; return { ok: true };
  }

  function attr(f, h, image, part, bonus) {
    if (!f) return 2; // Testbild
    const fit = SC.GENRES[f.genre].fit[h - 18];
    const fresh = 0.35 + 0.65 * f.top;
    const age = 0.9 + (f.year - 1952) / 39 * 0.2;
    return f.q * fit * fresh * age * image * (part ? 0.93 : 1) * (bonus || 1);
  }

  function planRivals(s) {
    s.rivals.forEach(r => {
      r.plan = {}; const used = new Set();
      // Primetime zuerst besetzen
      [20, 21, 19, 22, 18, 23].forEach(h => {
        let best = null, bv = -1;
        r.films.forEach(f => { if (used.has(f.id)) return; const v = attr(f, h, 1, 0, 1); if (v > bv) { bv = v; best = f; } });
        if (best) { used.add(best.id); r.plan[h] = best.id; }
      });
    });
  }

  function hourAttrs(s, h, pBonus, rBonus) {
    const p = s.plan[h] || {};
    const f = p.film ? filmById(s, p.film) : null;
    const list = [{ f, a: attr(f, h, s.image, p.part, pBonus), part: p.part || 0 }];
    s.rivals.forEach((r, i) => {
      const rf = r.plan[h] ? r.films.find(x => x.id === r.plan[h]) : null;
      list.push({ f: rf, a: attr(rf, h, r.image, 0, rBonus ? rBonus[i] : 1.04), part: 0 });
    });
    return list;
  }

  function forecast(s, h) { // erwartete Zuschauer (Tsd.) ohne Zufall
    const l = hourAttrs(s, h, newsBonus(s), null);
    const sum = l.reduce((a, x) => a + x.a, 0);
    return Math.round(SC.AUDIENCE[h] * l[0].a / (sum + SC.OFF));
  }

  function runEvening(s) {
    if (s.phase !== 'tag') return s.last;
    const res = { day: s.day, hours: [], income: 0, penalties: 0, costs: 0, interest: 0, newsCost: 0, totals: [0, 0, 0],
      spotsOk: 0, spotsFail: 0, empty: 0, finished: [], failed: [], moodDelta: 0, autoCredit: 0 };
    res.newsCost = s.news.reduce((a, n) => a + n.cost, 0);
    const pBonus = newsBonus(s);
    const rBonus = s.rivals.map(() => 1 + rnd(s) * 0.08);
    const aired = new Set(); const rAired = new Set();
    for (const h of SC.HOURS) {
      const l = hourAttrs(s, h, pBonus, rBonus);
      const sum = l.reduce((a, x) => a + x.a, 0);
      const views = l.map(x => Math.round(SC.AUDIENCE[h] * x.a / (sum + SC.OFF) * (0.95 + rnd(s) * 0.1)));
      l.forEach((x, i) => { if (x.f) (i === 0 ? aired : rAired).add(x.f); });
      if (!l[0].f) res.empty++;
      const hr = { h, titles: l.map(x => x.f ? x.f.title + (x.part ? ' (Teil 2)' : '') : 'Testbild'), genres: l.map(x => x.f ? x.f.genre : null), views, ad: null };
      views.forEach((v, i) => res.totals[i] += v);
      const p = s.plan[h];
      if (p && p.ad) {
        const ad = s.ads.find(a => a.id === p.ad);
        if (ad && ad.done < ad.spots) {
          const ok = views[0] >= ad.minV;
          if (ok) { ad.done++; res.income += ad.pay; res.spotsOk++; s.stats.spots++; } else res.spotsFail++;
          hr.ad = { sponsor: ad.sponsor, ok, minV: ad.minV, pay: ad.pay };
        }
      }
      res.hours.push(hr);
    }
    aired.forEach(f => { f.top = Math.max(0.05, f.top * (f.len === 2 ? 0.55 : 0.65)); f.plays++; });
    rAired.forEach(f => { f.top = Math.max(0.05, f.top * 0.65); f.plays++; });
    s.money += res.income;
    s.ads = s.ads.filter(ad => {
      if (ad.done >= ad.spots) { res.finished.push(ad.sponsor); return false; }
      if (s.day >= ad.deadline) { res.penalties += ad.penalty; res.failed.push(ad.sponsor); return false; }
      return true;
    });
    for (const h of SC.HOURS) { const p = s.plan[h]; if (p && p.ad && !s.ads.find(a => a.id === p.ad)) p.ad = null; }
    s.money -= res.penalties;
    res.costs = SC.BASE_COST + SC.FILM_COST * s.films.length;
    res.interest = Math.round(s.credit * SC.INTEREST);
    s.money -= res.costs + res.interest;

    const order = [0, 1, 2].sort((a, b) => res.totals[b] - res.totals[a]);
    res.rank = order.indexOf(0) + 1;
    res.order = order;
    const all = res.totals.reduce((a, b) => a + b, 0);
    res.share = all ? res.totals[0] / all : 0;
    s.image = clamp(s.image + (res.share - 0.333) * 0.25, 0.7, 1.6);
    s.rivals.forEach((r, i) => { r.image = clamp(r.image + ((all ? res.totals[i + 1] / all : 0.33) - 0.333) * 0.15, 0.8, 1.4); });

    if (s.money < 0) {
      const need = Math.min(s.creditMax - s.credit, Math.ceil(-s.money / 10000) * 10000);
      if (need > 0) { s.credit += need; s.money += need; res.autoCredit = need; }
    }
    let md = [7, 2, -3][res.rank - 1] + Math.round((res.share - 0.333) * 20) - 3 * res.empty - res.spotsFail - 4 * res.failed.length;
    if (s.money < 0) md -= 5;
    s.mood = clamp(s.mood + md, 0, 100); res.moodDelta = md;
    const C = SC.CHEFIN; const lines = [pick(s, C.rank[res.rank])];
    if (res.empty) lines.push(C.empty);
    if (res.failed.length) lines.push(C.penalty);
    if (res.autoCredit || s.money < 0) lines.push(C.broke);
    res.chefin = lines.join(' ');
    s.stats.best = Math.max(s.stats.best, res.totals[0]);
    s.history.push({ day: s.day, totals: res.totals.slice(), rank: res.rank, money: s.money, income: res.income });
    if (s.history.length > 60) s.history.shift();
    if (s.mood >= 100) s.over = 'sieg';
    else if (s.mood <= 0) s.over = 'gefeuert';
    else if (s.money < 0) s.over = 'pleite';
    s.last = res; s.phase = 'bilanz';
    return res;
  }

  function nextDay(s) {
    if (s.phase !== 'bilanz' || s.over) return;
    s.day++; s.minute = SC.DAY_START; s.phase = 'tag'; s.last = null;
    s.films.forEach(f => f.top = Math.min(1, f.top + 0.15));
    s.rivals.forEach(r => r.films.forEach(f => f.top = Math.min(1, f.top + 0.12)));
    s.dealer.splice(0, 3);
    // KI-Sender kaufen ein: manchmal den besten Film beim Händler
    s.rivals.forEach(r => {
      if (s.dealer.length && rnd(s) < 0.45) {
        let bi = 0; s.dealer.forEach((f, i) => { if (f.q > s.dealer[bi].q) bi = i; });
        const f = s.dealer.splice(bi, 1)[0]; r.films.push(f);
        log(s, r.name + ' hat »' + f.title + '« beim Filmhändler weggeschnappt.');
      } else if (rnd(s) < 0.7) {
        r.films.push(makeFilm(s, 15 + s.day, 45 + s.day * 2));
      }
      if (r.films.length > 14) { r.films.sort((a, b) => b.q * b.top - a.q * a.top); r.films.length = 14; }
    });
    refreshDealer(s);
    s.adsOffer.splice(0, 2); refreshAds(s);
    refreshNews(s);
    planRivals(s);
  }

  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function load() {
    try { const t = localStorage.getItem(KEY); if (!t) return null; const s = JSON.parse(t); return s && s.v === 1 ? s : null; }
    catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* egal */ } }

  SC.sim = { newGame, runEvening, nextDay, setSlot, setAd, buyFilm, sellFilm, sellPrice, signAd, buyNews, newsBonus,
    takeCredit, repay, forecast, attr, filmById, slot, save, load, clearSave, log, KEY };
})(window.SC);
