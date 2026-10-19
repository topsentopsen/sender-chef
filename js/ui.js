// Sender-Chef: Oberfläche (HUD, Räume, Sendeabend, Bilanz, Titel)
'use strict';
(function (SC) {
  const $ = id => document.getElementById(id);
  const sim = () => SC.sim;
  const S = () => SC.S;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('de-DE') + ' €';
  const viewers = v => v >= 1000 ? (v / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mio.' : Math.round(v) + ' Tsd.';
  const clock = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
  const qbar = q => '<span class="qbox"><span class="qbar" style="width:' + Math.round(q * 0.6) + 'px"></span></span> ' + q;
  const fitStars = (g, h) => { const v = SC.GENRES[g].fit[h - 18]; return v >= 1.1 ? '★★★' : v >= 0.9 ? '★★' : v >= 0.6 ? '★' : '–'; };
  const genre = g => '<span style="color:' + SC.GENRES[g].col + '">' + SC.GENRES[g].name + '</span>';
  const allChannels = () => [SC.PLAYER].concat(S().rivals);

  const UI = {
    paused: false, speed: 1, room: null, overlay: null, fast: /[?&]fast=1/.test(location.search), evTimer: null, toastT: 0
  };

  function toast(msg, bad) { const t = $('ticker'); t.innerHTML = '<span class="' + (bad ? 'bad' : 'good') + '">' + esc(msg) + '</span>'; UI.toastT = 6; }
  UI.toast = toast;

  // ---------- HUD ----------
  let hudCache = '';
  UI.hud = function (dt) {
    const s = S(); if (!s) return;
    const k = [s.day, Math.floor(s.minute), s.money, s.credit, s.mood, UI.paused, UI.speed, s.phase].join('|');
    if (k !== hudCache) {
      hudCache = k;
      $('hud-day').textContent = 'Tag ' + s.day;
      $('hud-clock').textContent = clock(s.minute);
      $('hud-money').textContent = money(s.money);
      $('hud-money').className = 'hud-item' + (s.money < 0 ? ' bad' : '');
      $('hud-credit').textContent = 'Kredit ' + money(s.credit);
      $('hud-mood').innerHTML = 'Chefin <span class="moodbar"><span style="width:' + s.mood + '%"></span></span> ' + s.mood;
      $('btn-pause').textContent = UI.paused ? 'Weiter' : 'Pause';
      $('btn-speed').textContent = 'Tempo ' + UI.speed + 'x';
      $('btn-evening').disabled = s.phase !== 'tag';
    }
    if (UI.toastT > 0) { UI.toastT -= dt || 0; if (UI.toastT <= 0) showLog(); }
  };
  function showLog() { const s = S(); $('ticker').textContent = s && s.log[0] ? s.log[0] : ''; }

  // ---------- Raummenü ----------
  function buildRoomMenu() {
    const nav = $('rooms'); nav.innerHTML = '';
    SC.FLOORS.forEach((fl, f) => fl.doors.forEach(d => {
      if (d.deco) return;
      const b = document.createElement('button');
      b.textContent = (f === 0 ? 'EG' : f + '.') + ' ' + SC.ROOM_NAMES[d.room];
      b.dataset.room = d.room;
      b.onclick = () => UI.walkTo(d.room);
      nav.appendChild(b);
    }));
  }
  function doorOf(room) { for (let f = 0; f < SC.FLOORS.length; f++) for (const d of SC.FLOORS[f].doors) if (d.room === room) return { f, d }; return null; }
  UI.walkTo = function (room) {
    if (!S() || S().phase !== 'tag' || UI.overlay) return;
    if (UI.room) UI.closeRoom();
    const t = doorOf(room); if (!t) return;
    if (t.d.deco) { decoMsg(t.d); }
    SC.building.goTo(t.f, t.d.x, t.d.deco ? null : room);
  };
  function decoMsg(d) {
    if (d.room === 'studio') toast('Das Studio ist nur für Technik und Moderatoren. Bitte nicht stören!');
    else toast('Das Büro von ' + d.label + ' ist abgeschlossen. Spionage kommt in einer späteren Version.');
  }

  // ---------- Räume ----------
  UI.openRoom = function (room) {
    if (!S() || S().phase !== 'tag') { SC.building.showPlayer(); return; }
    UI.room = room; renderRoom(); $('room').classList.remove('hidden'); $('room').scrollTop = 0;
  };
  UI.closeRoom = function () {
    if (!UI.room) return;
    UI.room = null; $('room').classList.add('hidden'); SC.building.showPlayer(); sim().save(S());
  };
  function head(title) {
    return '<div class="room-head"><h2>' + title + '</h2><div><span class="dim">' + clock(S().minute) + ' · ' + money(S().money) + '</span> <button data-act="leave">Raum verlassen</button></div></div>';
  }
  function renderRoom() {
    const s = S(), r = UI.room; if (!r) return;
    let h = '';
    if (r === 'buero') h = roomBuero(s);
    else if (r === 'filme') h = roomFilme(s);
    else if (r === 'werbung') h = roomWerbung(s);
    else if (r === 'news') h = roomNews(s);
    else if (r === 'chefin') h = roomChefin(s);
    else if (r === 'bank') h = roomBank(s);
    else h = roomLobby(s);
    $('room').innerHTML = h;
    if (r === 'chefin') drawChefin($('chefin-cv'), s.mood);
  }
  UI.refresh = function () { if (UI.room) { const st = $('room').scrollTop; renderRoom(); $('room').scrollTop = st; } };

  function adOptions(s, sel) {
    let o = '<option value="">– keine –</option>';
    s.ads.forEach(a => { o += '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.sponsor) + ' (ab ' + viewers(a.minV) + ', ' + a.done + '/' + a.spots + ')</option>'; });
    return o;
  }
  function roomBuero(s) {
    let h = head('BÜRO · PROGRAMMPLAN');
    h += '<p class="dim">Plane den Abend von 18 bis 24 Uhr. Jeder Film läuft höchstens einmal pro Abend. Ein Werbespot zählt nur, wenn die Zuschauerzahl die Mindestquote des Sponsors erreicht. Prognose = Schätzung gegen das heutige Programm der Konkurrenz.</p>';
    h += '<table><tr><th>Zeit</th><th>Sendung</th><th>Passt</th><th>Prognose</th><th>Werbung</th></tr>';
    for (const hr of SC.HOURS) {
      const p = s.plan[hr] || {}; const f = p.film ? sim().filmById(s, p.film) : null;
      let o = '<option value="">– Testbild –</option>';
      s.films.forEach(x => {
        const bad = hr + x.len - 1 > 23;
        o += '<option value="' + x.id + '"' + (f && f.id === x.id ? ' selected' : '') + (bad ? ' disabled' : '') + '>' + esc(x.title) + ' · ' + SC.GENRES[x.genre].name + ' · Q' + x.q + ' · ' + x.len + 'h · ' + Math.round(x.top * 100) + '%</option>';
      });
      const fc = sim().forecast(s, hr);
      const ad = p.ad ? s.ads.find(a => a.id === p.ad) : null;
      const adOk = ad ? (fc >= ad.minV ? '<span class="good">✔</span>' : '<span class="bad">✘</span>') : '';
      h += '<tr><td>' + hr + ':00</td><td><select data-act="slot" data-h="' + hr + '">' + o + '</select>' + (p.part ? ' <span class="dim">(Teil 2)</span>' : '') + '</td>' +
        '<td>' + (f ? fitStars(f.genre, hr) : '') + '</td><td>' + viewers(fc) + ' ' + adOk + '</td>' +
        '<td><select data-act="ad" data-h="' + hr + '">' + adOptions(s, p.ad) + '</select></td></tr>';
    }
    h += '</table><p class="dim">★★★ = Genre passt sehr gut zur Uhrzeit. Prozent = Aktualität: jede Ausstrahlung nutzt einen Film ab, pro Tag erholt er sich etwas. Nachrichten heute: +' + Math.round((sim().newsBonus(s) - 1) * 100) + ' % Zuschauer.</p>';
    h += '<h3>Laufende Werbeverträge</h3>' + adsTable(s.ads, s, false);
    h += '<h3>Dein Filmarchiv (' + s.films.length + ')</h3>' + filmTable(s.films, null);
    return h;
  }
  function filmTable(list, btn) {
    if (!list.length) return '<p class="dim">Keine Filme.</p>';
    let h = '<table><tr><th>Titel</th><th>Genre</th><th>Jahr</th><th>Länge</th><th>Qualität</th><th>Aktuell</th><th>Preis</th>' + (btn ? '<th></th>' : '') + '</tr>';
    list.forEach(f => {
      h += '<tr><td>' + esc(f.title) + '</td><td>' + genre(f.genre) + '</td><td>' + f.year + '</td><td>' + f.len + ' h</td><td>' + qbar(f.q) + '</td><td>' + Math.round(f.top * 100) + ' %</td><td>' + money(btn === 'sell' ? sim().sellPrice(f) : f.price) + '</td>';
      if (btn === 'buy') h += '<td><button data-act="buy" data-id="' + f.id + '"' + (S().money < f.price ? ' disabled' : '') + '>Kaufen</button></td>';
      if (btn === 'sell') h += '<td><button data-act="sell" data-id="' + f.id + '">Verkaufen</button></td>';
      h += '</tr>';
    });
    return h + '</table>';
  }
  function roomFilme(s) {
    let h = head('FILMHÄNDLER');
    h += '<p class="dim">„Frische Ware, Chef! Jeden Morgen kommt Neues rein, und die Konkurrenz kauft nachts gern das Beste weg.“</p>';
    h += filmTable(s.dealer, 'buy');
    h += '<h3>Ankauf: deine Filme</h3><p class="dim">Der Händler zahlt je nach Aktualität 25 bis 45 % vom Neupreis.</p>' + filmTable(s.films, 'sell');
    return h;
  }
  function adsTable(list, s, offer) {
    if (!list.length) return '<p class="dim">Keine Verträge.</p>';
    let h = '<table><tr><th>Sponsor</th><th>Mindestquote</th><th>Spots</th><th>Frist</th><th>je Spot</th><th>Strafe</th>' + (offer ? '<th></th>' : '') + '</tr>';
    list.forEach(a => {
      const frist = offer ? a.days + ' Tage' : (a.deadline === s.day ? '<span class="bad">heute</span>' : 'bis Tag ' + a.deadline);
      h += '<tr><td>' + esc(a.sponsor) + '</td><td>' + viewers(a.minV) + '</td><td>' + (offer ? a.spots : a.done + ' / ' + a.spots) + '</td><td>' + frist + '</td><td class="good">' + money(a.pay) + '</td><td class="bad">' + money(a.penalty) + '</td>';
      if (offer) h += '<td><button data-act="sign" data-id="' + a.id + '"' + (s.ads.length >= SC.MAX_ADS ? ' disabled' : '') + '>Unterschreiben</button></td>';
      h += '</tr>';
    });
    return h + '</table>';
  }
  function roomWerbung(s) {
    let h = head('WERBEAGENTUR');
    h += '<p class="dim">Jeder gesendete Spot mit genug Zuschauern bringt sofort Geld. Ist die Frist um und fehlen Spots, wird die Strafe fällig. Höchstens ' + SC.MAX_ADS + ' Verträge gleichzeitig.</p>';
    h += '<h3>Angebote</h3>' + adsTable(s.adsOffer, s, true);
    h += '<h3>Deine Verträge (' + s.ads.length + '/' + SC.MAX_ADS + ')</h3>' + adsTable(s.ads, s, false);
    return h;
  }
  function roomNews(s) {
    let h = head('NACHRICHTENSTUDIO');
    h += '<p class="dim">Gute Nachrichten am Abend machen den ganzen Sender attraktiver. Bis zu ' + SC.MAX_NEWS + ' Meldungen pro Tag. Wirkung heute: <b>+' + Math.round((sim().newsBonus(s) - 1) * 100) + ' %</b> Zuschauer (höchstens +25 %).</p>';
    h += '<table><tr><th>Meldung</th><th>Ressort</th><th>Wirkung</th><th>Kosten</th><th></th></tr>';
    s.newsOffer.forEach(n => { h += '<tr><td>' + esc(n.title) + '</td><td>' + n.cat + '</td><td>' + '▮'.repeat(Math.ceil(n.appeal / 2)) + '</td><td>' + money(n.cost) + '</td><td><button data-act="news" data-id="' + n.id + '"' + (s.news.length >= SC.MAX_NEWS || s.money < n.cost ? ' disabled' : '') + '>Einkaufen</button></td></tr>'; });
    h += '</table><h3>Heute in der Sendung</h3>';
    h += s.news.length ? '<ul>' + s.news.map(n => '<li>' + esc(n.title) + '</li>').join('') + '</ul>' : '<p class="dim">Noch keine Meldungen gekauft.</p>';
    return h;
  }
  function roomChefin(s) {
    let h = head('CHEFIN · ' + SC.CHEFIN.name.toUpperCase());
    const m = s.mood;
    const say = m >= 80 ? 'Sie machen das hervorragend. Noch ein wenig, und ich mache Sie zum Intendanten!' :
      m >= 55 ? 'Ordentlich. Aber ich will den ersten Platz sehen, jeden Abend.' :
        m >= 30 ? 'Ich bin nicht zufrieden. Die Konkurrenz lacht über uns.' : 'Noch ein schlechter Abend, und Sie können Ihren Schreibtisch räumen!';
    h += '<div class="chefin"><canvas id="chefin-cv" width="64" height="64"></canvas><div><p class="say">„' + say + '“</p>';
    h += '<p>Laune: <span class="moodbar big"><span style="width:' + m + '%"></span></span> ' + m + ' / 100</p>';
    if (s.history.length) { const l = s.history[s.history.length - 1]; h += '<p class="dim">Gestern: Platz ' + l.rank + ' mit ' + viewers(l.totals[0]) + ' Zuschauern insgesamt.</p>'; }
    h += '</div></div><h3>Spielziel</h3><ul><li><b>Sieg:</b> Laune der Chefin auf 100 bringen.</li><li><b>Niederlage:</b> Laune fällt auf 0 (gefeuert) oder das Konto bleibt trotz vollem Kreditrahmen im Minus (pleite).</li>' +
      '<li>Platz 1 am Abend: +7, Platz 2: +2, Platz 3: −3, dazu Marktanteil. Testbild, geplatzte Spots und Vertragsstrafen ärgern sie.</li></ul>';
    return h;
  }
  function roomBank(s) {
    let h = head('BANK');
    h += '<p>Kontostand: <b>' + money(s.money) + '</b> · Kredit: <b>' + money(s.credit) + '</b> von ' + money(s.creditMax) + ' · Zinsen: ' + Math.round(SC.INTEREST * 100) + ' % pro Tag</p>';
    h += '<p><button data-act="credit" data-v="50000">+50.000 € leihen</button> <button data-act="credit" data-v="100000">+100.000 € leihen</button> ' +
      '<button data-act="repay" data-v="50000">50.000 € tilgen</button> <button data-act="repay" data-v="999999999">Alles tilgen</button></p>';
    h += '<p class="dim">Rutscht das Konto am Abend ins Minus, gleicht die Bank automatisch mit Kredit aus, solange der Rahmen reicht.</p>';
    h += '<h3>Letzte Tage</h3>';
    if (!s.history.length) h += '<p class="dim">Noch keine Abrechnung.</p>';
    else {
      h += '<table><tr><th>Tag</th><th>Platz</th><th>Zuschauer</th><th>Werbung</th><th>Kontostand</th></tr>';
      s.history.slice(-7).reverse().forEach(x => { h += '<tr><td>' + x.day + '</td><td>' + x.rank + '</td><td>' + viewers(x.totals[0]) + '</td><td>' + money(x.income) + '</td><td>' + money(x.money) + '</td></tr>'; });
      h += '</table>';
    }
    return h;
  }
  function roomLobby(s) {
    let h = head('PFÖRTNER · SCHWARZES BRETT');
    h += '<p class="say">„Morgen, Chef! Die Chefin sitzt ganz oben. Die Konkurrenz von Blitz TV und Kanal Krawall hat sich bei uns eingemietet, also Augen auf!“</p>';
    h += '<h3>So läuft ein Tag</h3><ol><li>Bis 18:00 Uhr gehst du durchs Haus: Filme kaufen (1. Etage), Werbung unterschreiben (2.), Nachrichten einkaufen (3.).</li>' +
      '<li>Im <b>Büro</b> legst du fest, was von 18 bis 24 Uhr läuft und welche Werbung in welche Stunde kommt.</li>' +
      '<li>Um 18:00 Uhr (oder per „Sendeabend starten“) wird gesendet. Danach kommt die Tagesbilanz.</li>' +
      '<li>Ziel: die Chefin (4. Etage) mit Quoten begeistern, bis ihre Laune 100 erreicht.</li></ol>';
    h += '<h3>Konkurrenz</h3><table><tr><th>Sender</th><th>Filme</th><th>Image</th><th>Gestern</th></tr>';
    const l = s.history[s.history.length - 1];
    allChannels().forEach((c, i) => {
      const img = i === 0 ? s.image : c.image, n = i === 0 ? s.films.length : c.films.length;
      h += '<tr><td style="color:' + c.col + '">' + esc(c.name) + '</td><td>' + n + '</td><td>' + Math.round(img * 100) + ' %</td><td>' + (l ? viewers(l.totals[i]) : '–') + '</td></tr>';
    });
    h += '</table><h3>Meldungen</h3><ul class="log">' + s.log.slice(0, 10).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    return h;
  }

  function onRoomClick(e) {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
    const s = S(), id = Number(b.dataset.id), a = b.dataset.act;
    let r = { ok: true };
    if (a === 'leave') { UI.closeRoom(); return; }
    if (a === 'buy') r = sim().buyFilm(s, id);
    if (a === 'sell') r = sim().sellFilm(s, id);
    if (a === 'sign') r = sim().signAd(s, id);
    if (a === 'news') r = sim().buyNews(s, id);
    if (a === 'credit') r = sim().takeCredit(s, Number(b.dataset.v));
    if (a === 'repay') r = sim().repay(s, Number(b.dataset.v));
    if (r && !r.ok && r.msg) toast(r.msg, true); else if (r && r.ok) showLog();
    UI.refresh();
  }
  function onRoomChange(e) {
    const t = e.target; if (t.tagName !== 'SELECT') return;
    const s = S(), h = Number(t.dataset.h), v = t.value ? Number(t.value) : null;
    let r = t.dataset.act === 'slot' ? sim().setSlot(s, h, v) : sim().setAd(s, h, v);
    if (r && !r.ok && r.msg) toast(r.msg, true);
    UI.refresh();
  }

  function drawChefin(c, mood) {
    if (!c) return; const g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(0, 0, 64, 64, '#0055aa'); R(0, 48, 64, 16, '#002a66');
    R(14, 40, 36, 24, '#a01040'); R(28, 40, 8, 10, '#fff'); // Kostüm, Bluse
    R(18, 6, 28, 12, '#802010'); R(14, 12, 8, 26, '#802010'); R(42, 12, 8, 26, '#802010'); // Haare
    R(20, 12, 24, 26, '#f0c090'); // Gesicht
    R(18, 4, 28, 8, '#a03018');
    R(24, 20, 5, 3, '#fff'); R(35, 20, 5, 3, '#fff'); R(26, 21, 2, 2, '#204080'); R(37, 21, 2, 2, '#204080');
    const brow = mood < 30 ? 1 : 0; R(23, 17 + brow, 7, 1, '#401008'); R(34, 17 + brow, 7, 1, '#401008');
    if (mood < 30) { R(23, 16, 2, 1, '#401008'); R(39, 16, 2, 1, '#401008'); }
    R(31, 24, 2, 5, '#d8a070'); // Nase
    if (mood >= 55) { R(26, 31, 12, 2, '#c02030'); R(25, 30, 2, 1, '#c02030'); R(37, 30, 2, 1, '#c02030'); }
    else if (mood >= 30) R(27, 31, 10, 2, '#c02030');
    else { R(26, 32, 12, 2, '#c02030'); R(25, 33, 2, 1, '#c02030'); R(37, 33, 2, 1, '#c02030'); }
    R(16, 26, 3, 4, '#ffd040'); R(45, 26, 3, 4, '#ffd040'); // Ohrringe
  }

  // ---------- Sendeabend ----------
  UI.overlayOpen = () => !!UI.overlay;
  function openOverlay(kind, html) { UI.overlay = kind; const o = $('overlay'); o.innerHTML = html; o.classList.remove('hidden'); }
  function closeOverlay() { UI.overlay = null; $('overlay').classList.add('hidden'); $('overlay').innerHTML = ''; }

  UI.startEvening = function () {
    const s = S(); if (!s || s.phase !== 'tag') return;
    if (UI.room) UI.closeRoom();
    s.minute = SC.EVENING;
    const res = sim().runEvening(s);
    sim().save(s);
    showBroadcast(res);
  };
  function showBroadcast(res) {
    const ch = allChannels();
    let h = '<div class="box tv"><h2>SENDEABEND · TAG ' + res.day + '</h2><div class="tvwrap"><canvas id="tvc" width="160" height="100"></canvas><div id="tvinfo"></div></div>';
    h += '<table id="tvtab"><tr><th>Zeit</th>' + ch.map(c => '<th style="color:' + c.col + '">' + esc(c.name) + '</th>').join('') + '<th>Werbung</th></tr></table>';
    h += '<p><button id="tvskip">Überspringen</button></p></div>';
    openOverlay('sendung', h);
    let i = 0; const step = UI.fast ? 40 : 1500;
    const tick = () => {
      if (i >= res.hours.length) { clearInterval(UI.evTimer); UI.evTimer = null; showBilanz(); return; }
      const hr = res.hours[i]; addTvRow(hr, ch); drawTv(hr, ch); i++;
    };
    $('tvskip').onclick = () => { while (i < res.hours.length) { addTvRow(res.hours[i], ch); i++; } tick(); };
    tick(); UI.evTimer = setInterval(tick, step);
  }
  function addTvRow(hr, ch) {
    const max = Math.max.apply(null, hr.views);
    let r = '<tr><td>' + hr.h + ':00</td>';
    hr.views.forEach((v, i) => { r += '<td' + (v === max ? ' class="best"' : '') + '><div class="small">' + esc(hr.titles[i]) + '</div><span class="vbar" style="width:' + Math.round(v / 40) + 'px;background:' + ch[i].col + '"></span> ' + viewers(v) + '</td>'; });
    r += '<td>' + (hr.ad ? (hr.ad.ok ? '<span class="good">✔ ' + esc(hr.ad.sponsor) + ' +' + money(hr.ad.pay) + '</span>' : '<span class="bad">✘ ' + esc(hr.ad.sponsor) + ' (zu wenig)</span>') : '–') + '</td></tr>';
    $('tvtab').insertAdjacentHTML('beforeend', r);
  }
  function drawTv(hr, ch) {
    const c = $('tvc'); if (!c) return; const g = c.getContext('2d');
    const gid = hr.genres[0];
    g.fillStyle = '#111'; g.fillRect(0, 0, 160, 100);
    if (!gid) { // Testbild
      const cols = ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f', '#000'];
      cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 20, 0, 20, 70); });
      g.fillStyle = '#000'; g.fillRect(0, 70, 160, 30);
    } else {
      const col = SC.GENRES[gid].col;
      for (let y = 0; y < 100; y += 4) { g.fillStyle = y % 8 ? col : '#000'; g.globalAlpha = 0.25 + (y / 100) * 0.5; g.fillRect(0, y, 160, 4); }
      g.globalAlpha = 1;
      for (let k = 0; k < 120; k++) { g.fillStyle = Math.random() < 0.5 ? '#fff' : '#000'; g.fillRect(Math.random() * 160 | 0, Math.random() * 100 | 0, 1, 1); }
      g.fillStyle = '#000'; g.fillRect(30, 40, 100, 30); g.fillStyle = col; g.fillRect(32, 42, 96, 26);
    }
    g.fillStyle = '#ff8800'; g.font = 'bold 9px monospace'; g.textAlign = 'left'; g.fillText('W7', 4, 10);
    $('tvinfo').innerHTML = '<div class="big">' + hr.h + ':00 Uhr</div><div>' + esc(hr.titles[0]) + '</div><div class="dim">' + (gid ? SC.GENRES[gid].name : 'kein Programm') + '</div><div>' + viewers(hr.views[0]) + ' schauen zu</div>';
  }

  function showBilanz() {
    const s = S(), r = s.last; if (!r) return;
    const ch = allChannels();
    let h = '<div class="box"><h2>TAGESBILANZ · TAG ' + r.day + '</h2>';
    h += '<table><tr><th>Platz</th><th>Sender</th><th>Zuschauer gesamt</th></tr>';
    r.order.forEach((ci, k) => { h += '<tr><td>' + (k + 1) + '.</td><td style="color:' + ch[ci].col + '">' + esc(ch[ci].name) + '</td><td>' + viewers(r.totals[ci]) + '</td></tr>'; });
    h += '</table><table class="money"><tr><td>Werbeeinnahmen (' + r.spotsOk + ' Spots, ' + r.spotsFail + ' geplatzt)</td><td class="good">' + money(r.income) + '</td></tr>' +
      '<tr><td>Vertragsstrafen</td><td class="bad">' + money(-r.penalties) + '</td></tr>' +
      '<tr><td>Betriebskosten und Filmlizenzen</td><td class="bad">' + money(-r.costs) + '</td></tr>' +
      '<tr><td>Zinsen</td><td class="bad">' + money(-r.interest) + '</td></tr>' +
      '<tr><td class="dim">Heute schon bezahlt: Nachrichten</td><td class="dim">' + money(-r.newsCost) + '</td></tr>' +
      (r.autoCredit ? '<tr><td>Automatischer Kredit der Bank</td><td>' + money(r.autoCredit) + '</td></tr>' : '') +
      '<tr><th>Kontostand</th><th>' + money(s.money) + '</th></tr></table>';
    if (r.finished.length) h += '<p class="good">Erfüllt: ' + r.finished.map(esc).join(', ') + '</p>';
    if (r.failed.length) h += '<p class="bad">Geplatzt: ' + r.failed.map(esc).join(', ') + '</p>';
    h += '<div class="chefin"><canvas id="chefin-b" width="64" height="64"></canvas><div><p class="say">„' + esc(r.chefin) + '“</p><p>Laune der Chefin: ' + s.mood + ' (' + (r.moodDelta >= 0 ? '+' : '') + r.moodDelta + ')</p></div></div>';
    if (s.over) h += endText(s);
    else h += '<p><button id="btn-next">Nächster Tag</button></p>';
    h += '</div>';
    openOverlay('bilanz', h);
    drawChefin($('chefin-b'), s.mood);
    if ($('btn-next')) $('btn-next').onclick = () => { sim().nextDay(s); sim().save(s); SC.building.reset(); closeOverlay(); showLog(); toast('Tag ' + s.day + ' beginnt. Neue Filme, Werbung und Nachrichten sind da.'); };
    if ($('btn-new2')) $('btn-new2').onclick = () => UI.newGame();
  }
  function endText(s) {
    const t = { sieg: ['SIEG!', 'Die Chefin ist begeistert und macht dich zum Intendanten von ' + SC.PLAYER.name + '.'],
      gefeuert: ['GEFEUERT', 'Die Chefin hat genug. Du räumst deinen Schreibtisch.'],
      pleite: ['PLEITE', 'Der Kreditrahmen ist ausgeschöpft und das Konto im Minus. Die Bank dreht den Saft ab.'] }[s.over];
    return '<div class="end ' + (s.over === 'sieg' ? 'good' : 'bad') + '"><h2>' + t[0] + '</h2><p>' + t[1] + '</p><p>Gespielt: ' + s.day + ' Tage · Filme gekauft: ' + s.stats.bought + ' · Werbespots: ' + s.stats.spots + ' · Bester Abend: ' + viewers(s.stats.best) + '</p></div><p><button id="btn-new2">Neues Spiel</button></p>';
  }

  // ---------- Titel und Menü ----------
  UI.showTitle = function () {
    const sv = sim().load();
    let h = '<div class="box title"><canvas id="logo" width="320" height="90"></canvas>';
    h += '<p class="big">Du leitest den kleinen Fernsehsender <b style="color:#ffcc00">' + SC.PLAYER.name + '</b>. Kauf Filme, verkauf Werbung, schlag Blitz TV und Kanal Krawall bei der Quote und bring die Chefin zum Strahlen.</p>';
    h += '<p>' + (sv && !sv.over ? '<button id="t-cont">Weiterspielen (Tag ' + sv.day + ')</button> ' : '') + '<button id="t-new">Neues Spiel</button></p>';
    h += '<p class="dim">Klick im Hochhaus auf eine Tür oder nutze die Raumknöpfe unter dem Bild. Der Spielstand wird im Browser gespeichert.</p>';
    h += '<p class="dim small">Inspiriert von Mad TV (1991). Eigenständiges Fanprojekt mit eigener Grafik und eigenen Texten, ohne Original-Inhalte. Version ' + SC.VERSION + '.</p></div>';
    openOverlay('titel', h);
    drawLogo($('logo'));
    $('t-new').onclick = () => UI.newGame();
    if ($('t-cont')) $('t-cont').onclick = () => { SC.S = sv; afterLoad(); };
  };
  function afterLoad() {
    closeOverlay(); SC.building.reset(); showLog();
    if (S().phase === 'bilanz') showBilanz();
  }
  UI.newGame = function (seed) {
    if (UI.evTimer) { clearInterval(UI.evTimer); UI.evTimer = null; }
    if (UI.room) UI.closeRoom();
    SC.S = sim().newGame(seed || (Date.now() & 0x7fffffff)); sim().save(S()); afterLoad();
    toast('Neues Spiel! Schau zuerst ins Büro (1. Etage) und zur Werbeagentur (2. Etage).');
  };
  function drawLogo(c) {
    if (!c) return; const g = c.getContext('2d');
    const cols = ['#200040', '#400080', '#6000c0', '#8020ff', '#c040ff', '#ff60c0', '#ff8040', '#ffc020', '#ffff60', '#ffc020', '#ff8040', '#ff60c0', '#c040ff', '#8020ff', '#6000c0', '#400080', '#200040'];
    cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 90 / cols.length, 320, 90 / cols.length + 1); });
    g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#000'; g.fillText('SENDER-CHEF', 163, 47);
    g.fillStyle = '#fff'; g.fillText('SENDER-CHEF', 160, 44);
    g.font = 'bold 11px monospace'; g.fillStyle = '#000'; g.fillText('DER FERNSEH-MANAGER', 161, 79); g.fillStyle = '#ffff60'; g.fillText('DER FERNSEH-MANAGER', 160, 78);
  }
  function showMenu() {
    if (UI.overlay) return;
    const h = '<div class="box"><h2>MENÜ</h2><p><button id="m-back">Zurück zum Spiel</button> <button id="m-save">Speichern</button> <button id="m-new">Neues Spiel</button></p>' +
      '<p class="dim">Tastatur: Leertaste = Pause, 1/2/4 = Tempo, Esc = Raum verlassen.</p></div>';
    openOverlay('menu', h);
    $('m-back').onclick = closeOverlay;
    $('m-save').onclick = () => { toast(sim().save(S()) ? 'Gespeichert.' : 'Speichern fehlgeschlagen.', false); closeOverlay(); };
    $('m-new').onclick = () => { if (confirm('Wirklich ein neues Spiel beginnen? Der alte Spielstand geht verloren.')) UI.newGame(); };
  }

  UI.init = function () {
    buildRoomMenu();
    $('room').addEventListener('click', onRoomClick);
    $('room').addEventListener('change', onRoomChange);
    $('btn-pause').onclick = () => { UI.paused = !UI.paused; };
    $('btn-speed').onclick = () => { UI.speed = UI.speed === 1 ? 2 : UI.speed === 2 ? 4 : 1; };
    $('btn-evening').onclick = () => UI.startEvening();
    $('btn-menu').onclick = showMenu;
    const cv = $('cv');
    cv.addEventListener('mousemove', e => {
      const [x, y] = SC.building.toLogical(e); const p = SC.building.pick(x, y);
      SC.building.setHover(p); cv.style.cursor = p ? 'pointer' : 'default';
    });
    cv.addEventListener('click', e => {
      if (!S() || S().phase !== 'tag' || UI.overlay) return;
      const [x, y] = SC.building.toLogical(e); const p = SC.building.pick(x, y);
      if (p) { if (p.d.deco) { decoMsg(p.d); SC.building.goTo(p.f, p.d.x, null); } else UI.walkTo(p.d.room); return; }
      const f = SC.building.floorAt(y);
      if (f !== null && x > 70 && x < 410) SC.building.goTo(f, Math.round(x), null);
    });
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'SELECT') return;
      if (e.key === ' ') { UI.paused = !UI.paused; e.preventDefault(); }
      if (e.key === '1') UI.speed = 1; if (e.key === '2') UI.speed = 2; if (e.key === '4') UI.speed = 4;
      if (e.key === 'Escape') UI.closeRoom();
    });
    window.addEventListener('beforeunload', () => { if (S()) sim().save(S()); });
  };
  UI.clock = clock;
  SC.ui = UI;
})(window.SC);
