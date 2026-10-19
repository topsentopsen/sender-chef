// Sender-Chef: Spiellogik ohne Darstellung (Wirtschaft, Quoten, Image-Kampf, KI-Sender, Auktion, Spielstand)
'use strict';
(function (SC) {
  const KEY = 'senderchef-save-v1'; // fester Schlüssel, Version steht im Feld v
  const SAVE_V = 2;
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
  const lastH = () => SC.HOURS[SC.HOURS.length - 1];
  const canAct = s => s.phase === 'tag' && !s.over;
  const NOT_NOW = { ok: false, msg: 'Das geht jetzt nicht mehr.' };

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

  // Mindestzuschauer orientieren sich an deinen besten Stunden der letzten Tage
  function adRef(s) {
    const h = s.history.slice(-3);
    if (!h.length) return 900;
    return Math.max(300, h.reduce((a, x) => a + (x.best3 || 0), 0) / h.length);
  }
  function makeAd(s) {
    const t = rnd(s);
    const minV = Math.max(100, Math.round((0.35 + 0.8 * t * t) * adRef(s) / 10) * 10);
    const spots = ri(s, 2, 5);
    const days = Math.max(2, Math.ceil(spots / 2) + ri(s, 1, 2));
    const pay = Math.round((minV * 24 + 4000) / 500) * 500;
    const penalty = Math.round(pay * spots * 0.4 / 1000) * 1000;
    return { id: s.nextId++, sponsor: pick(s, SC.SPONSORS), minV, spots, done: 0, days, deadline: 0, pay, penalty };
  }

  function agencyOf(cat) { for (const k in SC.AGENCIES) if (SC.AGENCIES[k].cats.includes(cat)) return k; return 'vermischt'; }
  function makeNews(s, used, agency) {
    const pool = SC.NEWS.filter(n => !used.has(n.t) && (!agency || agencyOf(n.c) === agency) && s.agencies[agencyOf(n.c)]);
    if (!pool.length) return null;
    const n = pick(s, pool); used.add(n.t);
    const appeal = clamp(n.a + ri(s, -2, 2), 1, 12);
    return { id: s.nextId++, title: n.t, cat: n.c, agency: agencyOf(n.c), appeal, cost: Math.round((appeal * 1000 + ri(s, 0, 2000)) / 500) * 500 };
  }

  function dealerRange(s) { return [Math.min(55, 10 + s.day * 2), Math.min(90, 60 + s.day * 2)]; }
  function refreshDealer(s) { const [a, b] = dealerRange(s); while (s.dealer.length < 8) s.dealer.push(makeFilm(s, a, b)); }
  function refreshAds(s) { while (s.adsOffer.length < 6) s.adsOffer.push(makeAd(s)); }
  function refreshNews(s) {
    const used = new Set(); s.newsOffer = []; s.news = [];
    for (let i = 0; i < 6; i++) { const n = makeNews(s, used); if (n) s.newsOffer.push(n); }
  }
  function newAuction(s) {
    const [, b] = dealerRange(s);
    const f = makeFilm(s, Math.min(85, b - 5), Math.min(99, b + 15));
    const start = Math.round(f.price * 0.6 / 1000) * 1000;
    const step = Math.max(1000, Math.round(f.price * 0.08 / 1000) * 1000);
    s.auction = { film: f, bid: start, step, bidder: -1, ends: 16 * 60, done: false, tick: -1,
      limits: s.rivals.map(() => rnd(s) < 0.6 ? Math.round(f.price * (0.7 + rnd(s) * 0.5)) : 0) };
  }

  function newGame(seed) {
    const s = {
      v: SAVE_V, rs: ((seed | 0) ^ 0x9E3779B9) | 0 || 1, seed: seed | 0, nextId: 1, titleUse: {}, day: 1, minute: SC.DAY_START, phase: 'tag',
      money: 250000, credit: 0, creditMax: 500000, mood: 50, image: 33, heart: 0, gifts: [], giftUse: {},
      agencies: { politik: true, showbiz: false, vermischt: false },
      films: [], dealer: [], adsOffer: [], ads: [], newsOffer: [], news: [], plan: {}, auction: null,
      rivals: [], history: [], log: [], last: null, over: null, stats: { bought: 0, spots: 0, best: 0 }
    };
    for (let i = 0; i < 6; i++) s.films.push(makeFilm(s, 25, 50));
    SC.RIVALS.forEach((r, i) => {
      const rv = { name: r.name, col: r.col, image: i === 0 ? 33 : 34, heart: 0, films: [], plan: {} };
      for (let k = 0; k < 8; k++) rv.films.push(makeFilm(s, r.qMin, r.qMax));
      s.rivals.push(rv);
    });
    refreshDealer(s); refreshAds(s); refreshNews(s); newAuction(s);
    const a = makeAd(s);
    Object.assign(a, { sponsor: 'Knusperflocken AG', minV: 150, spots: 3, pay: 7500, penalty: 6000, days: 3, deadline: s.day + 2 });
    s.ads.push(a);
    [19, 20, 21, 22].forEach((h, i) => { const f = s.films[i]; if (f && !slot(s, h).film) setSlot(s, h, f.id); });
    slot(s, 19).ad = a.id;
    planRivals(s);
    log(s, 'Willkommen bei ' + SC.PLAYER.name + '! ' + SC.BOSS.name + ' erwartet Quote.');
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
    if (!canAct(s)) return { ok: false, msg: 'Der Plan ist für heute schon gesendet.' };
    if (!fid) { clearFilmAt(s, h); return { ok: true }; }
    const f = filmById(s, fid); if (!f) return { ok: false, msg: 'Film nicht im Archiv.' };
    if (h + f.len - 1 > lastH()) return { ok: false, msg: 'Der Film dauert ' + f.len + ' Stunden und passt hier nicht mehr hinein.' };
    for (const hh of SC.HOURS) { const p = s.plan[hh]; if (p && p.film === fid) clearFilmAt(s, hh); }
    for (let k = 0; k < f.len; k++) { clearFilmAt(s, h + k); const p = slot(s, h + k); p.film = fid; p.part = k; }
    return { ok: true };
  }
  function setAd(s, h, adId) { if (!canAct(s)) return NOT_NOW; slot(s, h).ad = adId || null; return { ok: true }; }

  function buyFilm(s, id) {
    if (!canAct(s)) return NOT_NOW;
    const i = s.dealer.findIndex(f => f.id === id); if (i < 0) return { ok: false, msg: 'Nicht mehr im Angebot.' };
    const f = s.dealer[i];
    if (s.money < f.price) return { ok: false, msg: 'Zu wenig Geld. Vielleicht gibt der Chef Kredit?' };
    s.money -= f.price; s.dealer.splice(i, 1); s.films.push(f); s.stats.bought++;
    log(s, 'Film gekauft: »' + f.title + '«');
    return { ok: true };
  }
  function sellPrice(f) { return Math.max(500, Math.round(f.price * (0.25 + 0.2 * f.top) / 500) * 500); }
  function sellFilm(s, id) {
    if (!canAct(s)) return NOT_NOW;
    const i = s.films.findIndex(f => f.id === id); if (i < 0) return { ok: false };
    const f = s.films[i];
    for (const h of SC.HOURS) { const p = s.plan[h]; if (p && p.film === id) clearFilmAt(s, h); }
    s.money += sellPrice(f); s.films.splice(i, 1);
    log(s, 'Film verkauft: »' + f.title + '«');
    return { ok: true };
  }
  function signAd(s, id) {
    if (!canAct(s)) return NOT_NOW;
    if (s.ads.length >= SC.MAX_ADS) return { ok: false, msg: 'Mehr als ' + SC.MAX_ADS + ' Verträge gleichzeitig gehen nicht.' };
    if (s.image < 15) return { ok: false, msg: 'Bei so schlechtem Image will kein Sponsor unterschreiben.' };
    const i = s.adsOffer.findIndex(a => a.id === id); if (i < 0) return { ok: false };
    const a = s.adsOffer[i]; a.deadline = s.day + a.days - 1;
    s.adsOffer.splice(i, 1); s.ads.push(a);
    log(s, 'Werbevertrag mit ' + a.sponsor + ' unterschrieben.');
    return { ok: true };
  }
  function buyNews(s, id) {
    if (!canAct(s)) return NOT_NOW;
    if (s.news.length >= SC.MAX_NEWS) return { ok: false, msg: 'Mehr als ' + SC.MAX_NEWS + ' Meldungen passen nicht auf die Tafel.' };
    const i = s.newsOffer.findIndex(n => n.id === id); if (i < 0) return { ok: false };
    const n = s.newsOffer[i];
    if (s.money < n.cost) return { ok: false, msg: 'Zu wenig Geld.' };
    s.money -= n.cost; s.newsOffer.splice(i, 1); s.news.push(n);
    return { ok: true };
  }
  function toggleAgency(s, k) {
    if (!canAct(s) || k === 'politik' || !SC.AGENCIES[k]) return NOT_NOW;
    s.agencies[k] = !s.agencies[k];
    if (s.agencies[k]) {
      const used = new Set(s.newsOffer.map(n => n.title).concat(s.news.map(n => n.title)));
      for (let i = 0; i < 3; i++) { const n = makeNews(s, used, k); if (n) s.newsOffer.push(n); }
      log(s, SC.AGENCIES[k].name + ' abonniert (' + SC.AGENCIES[k].fee + ' € pro Tag).');
    } else s.newsOffer = s.newsOffer.filter(n => n.agency !== k);
    return { ok: true };
  }
  function newsBonus(s, h) {
    const base = Math.min(0.25, s.news.reduce((a, n) => a + n.appeal, 0) / 100);
    const age = h ? Math.max(0.3, 1 - 0.12 * (h - 18)) : 1; // Meldungen veralten im Laufe des Abends
    return 1 + base * age;
  }
  function takeCredit(s, amt) {
    if (!canAct(s)) return NOT_NOW;
    amt = Math.min(amt, s.creditMax - s.credit); if (amt <= 0) return { ok: false, msg: 'Kreditrahmen ausgeschöpft.' };
    s.credit += amt; s.money += amt; return { ok: true };
  }
  function repay(s, amt) {
    if (!canAct(s)) return NOT_NOW;
    amt = Math.min(amt, s.credit, Math.max(0, s.money)); if (amt <= 0) return { ok: false, msg: 'Nichts zu tilgen oder kein Geld.' };
    s.credit -= amt; s.money -= amt; return { ok: true };
  }
  function heartCap(img) { return Math.min(100, Math.round(img * 2)); }
  function buyGift(s, gid) {
    if (!canAct(s)) return NOT_NOW;
    const g = SC.GIFTS.find(x => x.id === gid); if (!g) return { ok: false };
    if (s.gifts.length >= 3) return { ok: false, msg: 'Mehr als drei Geschenke passen nicht in die Aktentasche.' };
    if (s.money < g.price) return { ok: false, msg: 'Zu wenig Geld.' };
    s.money -= g.price; s.gifts.push(gid); return { ok: true, msg: g.name + ' gekauft. Jetzt ab in die Kulturredaktion (4. Etage)!' };
  }
  function giveGift(s, idx) {
    if (!canAct(s)) return NOT_NOW;
    const gid = s.gifts[idx]; const g = SC.GIFTS.find(x => x.id === gid); if (!g) return { ok: false };
    s.gifts.splice(idx, 1);
    const use = s.giftUse[gid] || 0; s.giftUse[gid] = use + 1;
    const eff = Math.max(1, Math.round(g.heart / Math.pow(2, Math.floor(use))));
    const cap = heartCap(s.image);
    const before = s.heart;
    s.heart = Math.max(s.heart, Math.min(cap, s.heart + eff)); // Geschenk senkt das Herz nie, auch wenn der Image-Deckel darunter liegt
    const got = s.heart - before;
    let msg = got > 0 ? SC.LOVE.name.split(' ')[0] + ' freut sich über ' + g.name + ' (+' + got + ' Herz).' : 'Sie lächelt höflich. Mehr ist bei eurem Image gerade nicht drin.';
    if (use > 0 && got > 0) msg += ' Schon wieder ' + g.name + '? Das wirkt nicht mehr so gut.';
    return { ok: true, msg };
  }

  function bid(s) {
    const a = s.auction;
    if (!canAct(s) || !a || a.done) return NOT_NOW;
    if (s.minute >= a.ends) return { ok: false, msg: 'Die Auktion ist vorbei.' };
    if (a.bidder === 0) return { ok: false, msg: 'Du bist schon Höchstbietender.' };
    const nb = a.bidder === -1 ? a.bid : a.bid + a.step;
    if (s.money < nb) return { ok: false, msg: 'So viel Geld hast du nicht.' };
    a.bid = nb; a.bidder = 0; return { ok: true, msg: 'Gebot: ' + nb.toLocaleString('de-DE') + ' €' };
  }
  // KI bietet alle 30 Spielminuten mit; Ende um 16 Uhr
  function auctionTick(s) {
    const a = s.auction; if (!a || a.done || s.phase !== 'tag') return null;
    if (s.minute >= a.ends) return settleAuction(s);
    const t = Math.floor(s.minute / 30); if (t === a.tick) return null; a.tick = t;
    let ev = null;
    s.rivals.forEach((r, i) => {
      if (a.bidder === i + 1) return;
      const nb = a.bidder === -1 ? a.bid : a.bid + a.step;
      if (a.limits[i] >= nb && rnd(s) < 0.45) { a.bid = nb; a.bidder = i + 1; ev = r.name + ' bietet ' + nb.toLocaleString('de-DE') + ' € für »' + a.film.title + '«.'; }
    });
    return ev;
  }
  function settleAuction(s) {
    const a = s.auction; if (!a || a.done) return null;
    a.done = true; let ev;
    if (a.bidder === 0) {
      if (s.money >= a.bid) { s.money -= a.bid; a.film.price = a.bid; s.films.push(a.film); s.stats.bought++; ev = 'Zuschlag! »' + a.film.title + '« gehört dir für ' + a.bid.toLocaleString('de-DE') + ' €.'; }
      else { s.mood = clamp(s.mood - 5, 0, 100); ev = 'Auktion geplatzt: Du konntest dein Gebot nicht bezahlen. Der Chef tobt.'; }
    } else if (a.bidder > 0) { const r = s.rivals[a.bidder - 1]; r.films.push(a.film); ev = r.name + ' ersteigert »' + a.film.title + '«.'; }
    else ev = 'Niemand hat »' + a.film.title + '« ersteigert.';
    log(s, ev); return ev;
  }

  const imgF = img => 0.94 + img * 0.002; // Image 0 = 0,94 · 33 ≈ 1,0 · 100 = 1,14 (v0.3 Gummiband)
  function attr(f, h, img, part, bonus) {
    if (!f) return 2; // Testbild
    const fit = SC.GENRES[f.genre].fit[h - 18];
    const fresh = 0.35 + 0.65 * f.top;
    const age = 0.9 + (f.year - 1952) / 39 * 0.2;
    return f.q * fit * fresh * age * imgF(img) * (part ? 0.93 : 1) * (bonus || 1);
  }
  function planRivals(s) {
    const last = lastH();
    s.rivals.forEach(r => {
      r.plan = {}; const used = new Set();
      [20, 21, 19, 22, 18, 23, 24].forEach(h => {
        if (r.plan[h]) return; // schon als Teil 2 eines 2-Stunden-Films belegt
        let best = null, bv = -1;
        r.films.forEach(f => {
          if (used.has(f.id)) return;
          if (h + f.len - 1 > last) return;
          if (f.len === 2 && r.plan[h + 1]) return;
          const v = attr(f, h, 33, 0, 1);
          if (v > bv) { bv = v; best = f; }
        });
        if (best) {
          used.add(best.id);
          r.plan[h] = best.id;
          if (best.len === 2) r.plan[h + 1] = best.id;
        }
      });
    });
  }
  function hourAttrs(s, h, rBonus) {
    const p = s.plan[h] || {};
    const f = p.film ? filmById(s, p.film) : null;
    const list = [{ f, a: attr(f, h, s.image, p.part, newsBonus(s, h)), part: p.part || 0 }];
    s.rivals.forEach((r, i) => {
      const fid = r.plan[h];
      const rf = fid ? r.films.find(x => x.id === fid) : null;
      const part = rf && r.plan[h - 1] === fid ? 1 : 0;
      list.push({ f: rf, a: attr(rf, h, r.image, part, rBonus ? rBonus[i] : 1.0), part });
    });
    return list;
  }
  function forecast(s, h) {
    const l = hourAttrs(s, h, null);
    const sum = l.reduce((a, x) => a + x.a, 0);
    return Math.round(SC.AUDIENCE[h] * l[0].a / (sum + SC.OFF));
  }

  function runEvening(s) {
    if (s.phase !== 'tag' || s.over) return s.last;
    settleAuction(s);
    const res = { day: s.day, hours: [], income: 0, baseIncome: 0, penalties: 0, costs: 0, fees: 0, interest: 0, newsCost: 0, totals: [0, 0, 0],
      spotsOk: 0, spotsFail: 0, empty: 0, finished: [], failed: [], moodDelta: 0, heartDelta: 0, imageDelta: 0, autoCredit: 0, culture: 0 };
    res.newsCost = s.news.reduce((a, n) => a + n.cost, 0);
    const img0 = s.image, heart0 = s.heart;
    const rBonus = s.rivals.map(() => 0.95 + rnd(s) * 0.1);
    const aired = new Set(), rAired = new Set(), spotsToday = {};
    for (const h of SC.HOURS) {
      const l = hourAttrs(s, h, rBonus);
      const sum = l.reduce((a, x) => a + x.a, 0);
      const views = l.map(x => Math.round(SC.AUDIENCE[h] * x.a / (sum + SC.OFF) * (0.95 + rnd(s) * 0.1)));
      l.forEach((x, i) => { if (x.f) (i === 0 ? aired : rAired).add(x.f); });
      if (!l[0].f) res.empty++;
      if (l[0].f && SC.GENRES[l[0].f.genre].culture && h >= 19 && h <= 23) res.culture++;
      const hr = { h, titles: l.map(x => x.f ? x.f.title + (x.part ? ' (Teil 2)' : '') : 'Testbild'), genres: l.map(x => x.f ? x.f.genre : null), views, ad: null, news: s.news.length };
      views.forEach((v, i) => res.totals[i] += v);
      // Image-Kampf: Stundensieger nimmt dem Letzten einen Punkt ab (Summe bleibt 100)
      const imgs = [s.image].concat(s.rivals.map(r => r.image));
      let bi = 0, wi = 0; views.forEach((v, i) => { if (v > views[bi]) bi = i; if (v < views[wi]) wi = i; });
      if (bi !== wi && imgs[wi] > 12 && imgs[bi] < 60) { imgs[wi]--; imgs[bi]++; }
      s.image = imgs[0]; s.rivals.forEach((r, i) => r.image = imgs[i + 1]);
      hr.best = bi; hr.imgs = imgs.slice();
      const p = s.plan[h];
      if (p && p.ad) {
        const ad = s.ads.find(a => a.id === p.ad);
        if (ad && ad.done < ad.spots && (spotsToday[ad.id] || 0) < SC.SPOTS_PER_DAY) {
          spotsToday[ad.id] = (spotsToday[ad.id] || 0) + 1;
          const ok = views[0] >= ad.minV;
          if (ok) { ad.done++; res.income += ad.pay; res.spotsOk++; s.stats.spots++; } else res.spotsFail++;
          hr.ad = { sponsor: ad.sponsor, ok, minV: ad.minV, pay: ad.pay };
        } else if (ad) hr.ad = { sponsor: ad.sponsor, ok: false, skip: true };
      }
      res.hours.push(hr);
    }
    aired.forEach(f => { f.top = Math.max(0.05, f.top * (f.len === 2 ? 0.6 : 0.7)); f.plays++; });
    rAired.forEach(f => { f.top = Math.max(0.05, f.top * 0.7); f.plays++; });
    res.baseIncome = Math.round(res.totals[0] * SC.BASE_INCOME / 100) * 100;
    s.money += res.income + res.baseIncome;
    s.ads = s.ads.filter(ad => {
      if (ad.done >= ad.spots) { res.finished.push(ad.sponsor); return false; }
      if (s.day >= ad.deadline) { const pen = Math.round(ad.penalty * (ad.spots - ad.done) / ad.spots / 500) * 500; res.penalties += pen; res.failed.push(ad.sponsor); return false; }
      return true;
    });
    for (const h of SC.HOURS) { const p = s.plan[h]; if (p && p.ad && !s.ads.find(a => a.id === p.ad)) p.ad = null; }
    s.money -= res.penalties;
    res.costs = SC.BASE_COST + SC.FILM_COST * s.films.length;
    for (const k in s.agencies) if (s.agencies[k]) res.fees += SC.AGENCIES[k].fee;
    res.interest = Math.round(s.credit * SC.INTEREST);
    s.money -= res.costs + res.fees + res.interest;

    const order = [0, 1, 2].sort((a, b) => res.totals[b] - res.totals[a]);
    res.rank = order.indexOf(0) + 1; res.order = order;
    const all = res.totals.reduce((a, b) => a + b, 0);
    res.share = all ? res.totals[0] / all : 0;
    res.imageDelta = s.image - img0;

    if (s.money < 0) {
      const need = Math.min(s.creditMax - s.credit, Math.ceil(-s.money / 10000) * 10000);
      if (need > 0) { s.credit += need; s.money += need; res.autoCredit = need; }
    }
    let md = [5, 1, -2][res.rank - 1] + Math.round((res.share - 0.333) * 15) - 2 * res.empty - res.spotsFail - 3 * res.failed.length;
    if (s.money < 0) md -= 5;
    s.mood = clamp(s.mood + md, 0, 100); res.moodDelta = md;
    // Herz: Lena mag Kultur und Erfolg. Der Image-Deckel gilt, aber das Herz fällt höchstens um 5 pro Tag.
    function applyHeart(cur, delta, img) {
      const cap = heartCap(img);
      let next = clamp(cur + delta, 0, cap);
      if (next < cur - 5) next = cur - 5;
      return clamp(next, 0, 100);
    }
    s.heart = applyHeart(s.heart, [10, 3, 0][res.rank - 1] + 3 * res.culture, s.image);
    res.heartDelta = s.heart - heart0;
    res.heartCapHit = heart0 > heartCap(s.image) && res.heartDelta < 0;
    s.rivals.forEach((r, i) => { const rk = order.indexOf(i + 1); r.heart = applyHeart(r.heart, [4, 1, 0][rk], r.image); });

    const T = SC.BOSS_TEXT; const lines = [pick(s, T.rank[res.rank])];
    if (res.empty) lines.push(T.empty);
    if (res.failed.length) lines.push(T.penalty);
    if (res.autoCredit || s.money < 0) lines.push(T.broke);
    if (s.image < 15) lines.push(T.lowimage);
    res.boss = lines.join(' ');
    const sorted = res.hours.map(x => x.views[0]).sort((a, b) => b - a);
    s.stats.best = Math.max(s.stats.best, res.totals[0]);
    s.history.push({ day: s.day, totals: res.totals.slice(), rank: res.rank, money: s.money, income: res.income + res.baseIncome, image: s.image, best3: Math.round((sorted[0] + sorted[1] + sorted[2]) / 3) });
    if (s.history.length > 60) s.history.shift();
    if (s.money < 0) s.over = 'pleite';
    else if (s.mood <= 0 || s.image < 8) s.over = 'gefeuert';
    else if (s.heart >= 100) s.over = 'sieg';
    else if (s.rivals.some(r => r.heart >= 100)) s.over = 'liebe';
    s.last = res; s.phase = 'bilanz';
    return res;
  }

  function nextDay(s) {
    if (s.phase !== 'bilanz' || s.over) return;
    s.day++; s.minute = SC.DAY_START; s.phase = 'tag'; s.last = null;
    s.films.forEach(f => f.top = Math.min(1, f.top + 0.18));
    s.rivals.forEach(r => r.films.forEach(f => f.top = Math.min(1, f.top + 0.18)));
    for (const k in s.giftUse) s.giftUse[k] = Math.max(0, s.giftUse[k] - 0.34); // Geschenke wirken nach ein paar Tagen wieder voll
    s.dealer.splice(0, 3);
    s.rivals.forEach(r => {
      if (s.dealer.length && rnd(s) < 0.15) {
        const top3 = s.dealer.map((f, i) => [f.q, i]).sort((a, b) => b[0] - a[0]).slice(0, 3);
        const bi = pick(s, top3)[1];
        const f = s.dealer.splice(bi, 1)[0]; r.films.push(f);
        log(s, r.name + ' hat »' + f.title + '« beim Filmhändler weggeschnappt.');
      } else if (rnd(s) < 0.7) {
        r.films.push(makeFilm(s, Math.min(34, 14 + 0.45 * s.day), Math.min(66, 42 + 1.0 * s.day)));
      }
      if (r.films.length > 14) { r.films.sort((a, b) => b.q * b.top - a.q * a.top); r.films.length = 14; }
    });
    refreshDealer(s);
    s.adsOffer.splice(0, 2); refreshAds(s);
    refreshNews(s); newAuction(s);
    planRivals(s);
  }

  // Spielstand
  function migrate(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
    if (s.v === 1) { // v0.1: Image als Faktor, Chefin-Laune
      if (!Array.isArray(s.rivals) || !Array.isArray(s.newsOffer)) return null;
      s.image = 33; s.heart = 0; s.gifts = []; s.giftUse = {}; s.agencies = { politik: true, showbiz: false, vermischt: false };
      s.rivals.forEach((r, i) => { if (r && typeof r === 'object') { r.image = i === 0 ? 33 : 34; r.heart = 0; } });
      s.newsOffer.forEach(n => { if (n) n.agency = agencyOf(n.cat); });
      s.auction = null; s.v = 2;
      if (s.over === 'sieg') s.over = null;
    }
    if (s.v !== SAVE_V) return null;
    const need = ['films', 'dealer', 'adsOffer', 'ads', 'newsOffer', 'news', 'rivals', 'history', 'log'];
    if (need.some(k => !Array.isArray(s[k]))) return null;
    if (s.plan == null || typeof s.plan !== 'object' || Array.isArray(s.plan)) return null;
    if (!Number.isFinite(s.money) || !Number.isFinite(s.day) || !Number.isFinite(s.minute) || !Number.isFinite(s.mood)) return null;
    if (!Number.isFinite(s.credit)) s.credit = 0;
    if (!Number.isFinite(s.creditMax)) s.creditMax = 500000;
    if (!Number.isFinite(s.image)) s.image = 33;
    if (!Number.isFinite(s.heart)) s.heart = 0;
    if (!Number.isFinite(s.nextId)) s.nextId = 1;
    if (!Number.isFinite(s.rs)) s.rs = 1;
    if (!s.titleUse || typeof s.titleUse !== 'object') s.titleUse = {};
    if (!Array.isArray(s.gifts)) s.gifts = [];
    if (!s.giftUse || typeof s.giftUse !== 'object') s.giftUse = {};
    if (!s.agencies || typeof s.agencies !== 'object') s.agencies = {};
    if (typeof s.agencies.politik !== 'boolean') s.agencies.politik = true;
    if (typeof s.agencies.showbiz !== 'boolean') s.agencies.showbiz = false;
    if (typeof s.agencies.vermischt !== 'boolean') s.agencies.vermischt = false;
    if (!s.stats || typeof s.stats !== 'object') s.stats = { bought: 0, spots: 0, best: 0 };
    ['bought', 'spots', 'best'].forEach(k => { if (!Number.isFinite(s.stats[k])) s.stats[k] = 0; });
    if (typeof s.phase !== 'string') s.phase = 'tag';
    if (s.rivals.length !== SC.RIVALS.length) return null;
    for (let i = 0; i < s.rivals.length; i++) {
      const r = s.rivals[i];
      if (!r || typeof r !== 'object' || !Array.isArray(r.films)) return null;
      if (!r.plan || typeof r.plan !== 'object' || Array.isArray(r.plan)) r.plan = {};
      if (!Number.isFinite(r.image)) r.image = i === 0 ? 33 : 34;
      if (!Number.isFinite(r.heart)) r.heart = 0;
    }
    if (s.phase === 'tag' && !s.auction) newAuction(s);
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function load() {
    try { const t = localStorage.getItem(KEY); if (!t) return null; return migrate(JSON.parse(t)); }
    catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* egal */ } }

  SC.sim = { newGame, runEvening, nextDay, setSlot, setAd, buyFilm, sellFilm, sellPrice, signAd, buyNews, toggleAgency, newsBonus,
    takeCredit, repay, buyGift, giveGift, heartCap, bid, auctionTick, settleAuction, forecast, attr, filmById, slot, planRivals,
    save, load, migrate, clearSave, log, KEY };
})(window.SC);
