// Sender-Chef: Oberfläche (HUD, Räume, Sendeabend, Bilanz, Titel)
'use strict';
(function (SC) {
  const $ = id => document.getElementById(id);
  const sim = () => SC.sim;
  const S = () => SC.S;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const aud = (fn, ...a) => { try { if (SC.audio && typeof SC.audio[fn] === 'function') SC.audio[fn](...a); } catch (e) { /* Audio darf nie die Spielschleife killen */ } };
  function syncSoundBtn() {
    const b = $('btn-sound'); if (!b || !SC.audio) return;
    b.textContent = SC.audio.isMuted() ? 'Ton aus' : 'Ton an';
    const v = $('vol'); if (v) v.value = String(Math.round((SC.audio.getVolume() || 0) * 100));
  }
  const money = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('de-DE') + ' €';
  const viewers = v => v >= 1000 ? (v / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mio.' : Math.round(v) + ' Tsd.';
  const clock = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
  const qbar = q => '<span class="qbox"><span class="qbar" style="width:' + Math.round(q * 0.6) + 'px"></span></span> ' + q;
  const fitStars = (g, h) => { const v = SC.GENRES[g].fit[h - 18]; return v >= 1.1 ? '★★★' : v >= 0.9 ? '★★' : v >= 0.6 ? '★' : '–'; };
  const genre = g => '<span style="color:' + SC.GENRES[g].col + '">' + SC.GENRES[g].name + '</span>';
  const allChannels = () => [SC.PLAYER].concat(S().rivals);
  const hh = h => String(h % 24).padStart(2, '0') + ':00';
  const imgBar = s => { const c = allChannels(); const v = [s.image].concat(s.rivals.map(r => r.image)); return '<span class="imgbar">' + v.map((x, i) => '<span style="width:' + x + '%;background:' + c[i].col + '"></span>').join('') + '</span>'; };

  const UI = {
    paused: false, speed: 1, room: null, overlay: null, fast: /[?&]fast=1/.test(location.search), evTimer: null, toastT: 0
  };

  function toast(msg, bad) { const t = $('ticker'); t.innerHTML = '<span class="' + (bad ? 'bad' : 'good') + '">' + esc(msg) + '</span>'; UI.toastT = 6; }
  UI.toast = toast;

  // ---------- HUD ----------
  let hudCache = '';
  UI.hud = function (dt) {
    const s = S(); if (!s) return;
    const k = [s.day, Math.floor(s.minute), s.money, s.credit, s.mood, s.image, s.heart, UI.paused, UI.speed, s.phase].join('|');
    if (k !== hudCache) {
      hudCache = k;
      $('hud-day').textContent = 'Tag ' + s.day;
      $('hud-clock').textContent = clock(s.minute);
      $('hud-money').textContent = money(s.money);
      $('hud-money').className = 'hud-item' + (s.money < 0 ? ' bad' : '');
      $('hud-credit').innerHTML = 'Image ' + imgBar(s) + ' ' + s.image;
      $('hud-mood').innerHTML = 'Chef <span class="moodbar"><span style="width:' + s.mood + '%"></span></span> ' + s.mood + ' · <span class="heart">♥</span> ' + s.heart;
      $('btn-pause').textContent = UI.paused ? 'Weiter' : 'Pause';
      $('btn-speed').textContent = 'Tempo ' + UI.speed + 'x';
      $('btn-evening').disabled = s.phase !== 'tag';
    }
    if (UI.toastT > 0) { UI.toastT -= dt || 0; if (UI.toastT <= 0) showLog(); }
    UI.bar();
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
    toast('Das Büro von ' + d.label + ' ist abgeschlossen. Spionage kommt in einer späteren Version.');
  }

  // ---------- Räume ----------
  UI.openRoom = function (room) {
    if (!S() || S().phase !== 'tag') { SC.building.showPlayer(); return; }
    UI.room = room; renderRoom(); $('room').classList.remove('hidden'); $('room').scrollTop = 0;
    aud('jingle', 'door');
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
    else if (r === 'chef') h = roomChef(s);
    else if (r === 'lena') h = roomLena(s);
    else if (r === 'kiosk') h = roomKiosk(s);
    else h = roomLobby(s);
    $('room').innerHTML = h;
    if (r === 'chef') drawBoss($('boss-cv'), s.mood);
    if (r === 'lena') drawLena($('lena-cv'), s.heart);
  }
  UI.refresh = function () { if (UI.room) { const st = $('room').scrollTop; renderRoom(); $('room').scrollTop = st; } };

  function adOptions(s, sel) {
    let o = '<option value="">– keine –</option>';
    s.ads.forEach(a => { o += '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.sponsor) + ' (ab ' + viewers(a.minV) + ', ' + a.done + '/' + a.spots + ')</option>'; });
    return o;
  }
  function roomBuero(s) {
    let h = head('BÜRO · PROGRAMMPLAN');
    h += '<p class="dim">Jede Stunde von 18 bis 1 Uhr: Nachrichten, dann die Sendung, dann ein Werbespot. Jeder Film läuft höchstens einmal pro Abend, jeder Vertrag höchstens ' + SC.SPOTS_PER_DAY + ' Spots pro Abend. Ein Spot zählt nur, wenn die Zuschauer die Mindestquote erreichen. Prognose = Schätzung gegen das heutige Programm der Konkurrenz.</p>';
    h += '<table><tr><th>Zeit</th><th>News</th><th>Sendung</th><th>Passt</th><th>Prognose</th><th>Werbespot</th></tr>';
    const adSlots = {};
    for (const hr of SC.HOURS) {
      const p = s.plan[hr] || {}; const f = p.film ? sim().filmById(s, p.film) : null;
      if (p.ad) adSlots[p.ad] = (adSlots[p.ad] || 0) + 1;
      let o = '<option value="">– Testbild –</option>';
      s.films.forEach(x => {
        const bad = hr + x.len - 1 > SC.HOURS[SC.HOURS.length - 1];
        o += '<option value="' + x.id + '"' + (f && f.id === x.id ? ' selected' : '') + (bad ? ' disabled' : '') + '>' + esc(x.title) + ' · ' + SC.GENRES[x.genre].name + ' · Q' + x.q + ' · ' + x.len + 'h · ' + Math.round(x.top * 100) + '%</option>';
      });
      const fc = sim().forecast(s, hr);
      const ad = p.ad ? s.ads.find(a => a.id === p.ad) : null;
      const adOk = ad ? (fc >= ad.minV ? '<span class="good">✔</span>' : '<span class="bad">✘</span>') : '';
      const gcol = f ? SC.GENRES[f.genre].col : '';
      const gbox = f ? '<span class="gbox" style="background:' + gcol + '" title="' + esc(SC.GENRES[f.genre].name) + '"></span>' : '<span class="gbox off" title="Testbild"></span>';
      h += '<tr><td>' + hh(hr) + '</td><td class="small">' + (s.news.length ? '+' + Math.round((sim().newsBonus(s, hr) - 1) * 100) + ' %' : '<span class="dim">leer</span>') + '</td><td class="filmcell">' + gbox + '<select data-act="slot" data-h="' + hr + '">' + o + '</select>' + (p.part ? ' <span class="dim">(Teil 2)</span>' : '') + '</td>' +
        '<td>' + (f ? fitStars(f.genre, hr) : '') + '</td><td>' + viewers(fc) + ' ' + adOk + '</td>' +
        '<td><select data-act="ad" data-h="' + hr + '">' + adOptions(s, p.ad) + '</select></td></tr>';
    }
    h += '</table>';
    s.ads.forEach(a => {
      if ((adSlots[a.id] || 0) > SC.SPOTS_PER_DAY)
        h += '<p class="bad">Achtung: »' + esc(a.sponsor) + '« liegt ' + adSlots[a.id] + ' Mal im Plan, zählt aber nur ' + SC.SPOTS_PER_DAY + ' Spots pro Abend (Limit erreicht).</p>';
    });
    h += '<p class="dim">★★★ = Genre passt sehr gut zur Uhrzeit. Prozent = Aktualität: jede Ausstrahlung nutzt einen Film ab, pro Tag erholt er sich etwas. Nachrichten: ' + s.news.length + ' von ' + SC.MAX_NEWS + ' Meldungen auf der Tafel, sie wirken am stärksten am frühen Abend.</p>';
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
    const a = s.auction;
    if (a) {
      const who = a.bidder === -1 ? 'noch kein Gebot' : a.bidder === 0 ? '<span class="good">Du bist vorn!</span>' : '<span class="bad">' + esc(s.rivals[a.bidder - 1].name) + ' führt</span>';
      h += '<h3>Auktion des Tages (Zuschlag um 16:00 Uhr)</h3><table><tr><th>Film</th><th>Genre</th><th>Länge</th><th>Qualität</th><th>Gebot</th><th>Stand</th><th></th></tr>' +
        '<tr><td>' + esc(a.film.title) + '</td><td>' + genre(a.film.genre) + '</td><td>' + a.film.len + ' h</td><td>' + qbar(a.film.q) + '</td><td>' + money(a.bid) + '</td><td>' + (a.done ? 'beendet' : who) + '</td>' +
        '<td>' + (a.done ? '' : '<button data-act="bid"' + (a.bidder === 0 || s.minute >= a.ends ? ' disabled' : '') + '>' + (a.bidder === -1 ? 'Bieten' : '+' + money(a.step)) + '</button>') + '</td></tr></table>' +
        '<p class="dim">Die Konkurrenz bietet im Laufe des Tages mit. Bezahlt wird beim Zuschlag.</p>';
    }
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
    h += '<p class="dim">Jeder gesendete Spot mit genug Zuschauern bringt sofort Geld. Ist die Frist um und fehlen Spots, wird die Strafe fällig. Höchstens ' + SC.MAX_ADS + ' Verträge gleichzeitig. Unter 15 Imagepunkten unterschreibt niemand.</p>';
    h += '<h3>Angebote</h3>' + adsTable(s.adsOffer, s, true);
    h += '<h3>Deine Verträge (' + s.ads.length + '/' + SC.MAX_ADS + ')</h3>' + adsTable(s.ads, s, false);
    return h;
  }
  function roomNews(s) {
    let h = head('NACHRICHTENSTUDIO');
    h += '<p class="dim">Gute Nachrichten am Abend machen den ganzen Sender attraktiver. Bis zu ' + SC.MAX_NEWS + ' Meldungen pro Tag. Wirkung um 18 Uhr: <b>+' + Math.round((sim().newsBonus(s, 18) - 1) * 100) + ' %</b> Zuschauer (höchstens +25 %), danach veralten die Meldungen.</p>';
    h += '<h3>Agenturen</h3><p>' + Object.keys(SC.AGENCIES).map(k => { const A = SC.AGENCIES[k]; return k === 'politik' ? '<span class="tag on">' + A.name + ' (frei)</span>' : '<button data-act="agency" data-k="' + k + '" class="' + (s.agencies[k] ? 'on' : '') + '">' + A.name + ': ' + (s.agencies[k] ? 'abonniert' : 'abonnieren') + ' (' + money(A.fee) + '/Tag)</button>'; }).join(' ') + '</p>';
    h += '<table><tr><th>Meldung</th><th>Ressort</th><th>Wirkung</th><th>Kosten</th><th></th></tr>';
    s.newsOffer.forEach(n => { h += '<tr><td>' + esc(n.title) + '</td><td>' + n.cat + '</td><td>' + '▮'.repeat(Math.ceil(n.appeal / 2)) + '</td><td>' + money(n.cost) + '</td><td><button data-act="news" data-id="' + n.id + '"' + (s.news.length >= SC.MAX_NEWS || s.money < n.cost ? ' disabled' : '') + '>Einkaufen</button></td></tr>'; });
    h += '</table><h3>Heute in der Sendung</h3>';
    h += s.news.length ? '<ul>' + s.news.map(n => '<li>' + esc(n.title) + '</li>').join('') + '</ul>' : '<p class="dim">Noch keine Meldungen gekauft.</p>';
    return h;
  }
  function roomChef(s) {
    let h = head('CHEFETAGE · ' + SC.BOSS.name.toUpperCase());
    const m = s.mood;
    const say = m >= 80 ? 'Hmpf. Läuft ja. Gewöhnen Sie sich bloß nicht daran.' :
      m >= 55 ? 'Ich will den ersten Platz sehen. Jeden. Einzelnen. Abend.' :
        m >= 30 ? 'Die Konkurrenz lacht über uns! Und ich lache nicht mit!' : 'Noch ein schlechter Abend, und Sie können Ihren Schreibtisch räumen!';
    h += '<div class="chefin"><canvas id="boss-cv" width="64" height="64"></canvas><div><p class="say">„' + say + '“</p>';
    h += '<p>Laune: <span class="moodbar big"><span style="width:' + m + '%"></span></span> ' + m + ' / 100</p>';
    if (s.history.length) { const l = s.history[s.history.length - 1]; h += '<p class="dim">Gestern: Platz ' + l.rank + ' mit ' + viewers(l.totals[0]) + ' Zuschauern insgesamt.</p>'; }
    h += '</div></div>';
    h += '<h3>Kredit</h3><p>Kontostand: <b>' + money(s.money) + '</b> · Kredit: <b>' + money(s.credit) + '</b> von ' + money(s.creditMax) + ' · Zinsen ' + Math.round(SC.INTEREST * 100) + ' % pro Tag</p>';
    h += '<p><button data-act="credit" data-v="50000">+50.000 € leihen</button> <button data-act="credit" data-v="100000">+100.000 € leihen</button> ' +
      '<button data-act="repay" data-v="50000">50.000 € tilgen</button> <button data-act="repay" data-v="999999999">Alles tilgen</button></p>';
    h += '<p class="dim">Rutscht das Konto am Abend ins Minus, bucht der Chef automatisch Kredit nach, solange der Rahmen reicht.</p>';
    h += '<h3>Spielregeln</h3><ul><li><b>Sieg:</b> Gewinne das Herz von ' + SC.LOVE.name + ' (100 ♥). Ihr Herz kann nie höher sein als dein Image mal zwei, du brauchst also mindestens 50 Imagepunkte.</li>' +
      '<li><b>Image-Kampf:</b> Die drei Sender teilen sich 100 Imagepunkte. Wer eine Stunde gewinnt, nimmt dem Letzten einen Punkt ab.</li>' +
      '<li><b>Niederlage:</b> Laune des Chefs 0 oder Image unter 8 (gefeuert), Konto im Minus bei vollem Kreditrahmen (pleite), oder ein Konkurrent erobert Lena zuerst.</li></ul>';
    if (s.history.length) {
      h += '<h3>Letzte Tage</h3><table><tr><th>Tag</th><th>Platz</th><th>Zuschauer</th><th>Einnahmen</th><th>Image</th><th>Kontostand</th></tr>';
      s.history.slice(-7).reverse().forEach(x => { h += '<tr><td>' + x.day + '</td><td>' + x.rank + '</td><td>' + viewers(x.totals[0]) + '</td><td>' + money(x.income) + '</td><td>' + (x.image != null ? x.image : '–') + '</td><td>' + money(x.money) + '</td></tr>'; });
      h += '</table>';
    }
    return h;
  }
  function roomLena(s) {
    let h = head('KULTURREDAKTION · ' + SC.LOVE.name.toUpperCase());
    const cap = sim().heartCap(s.image), hv = s.heart;
    const say = hv >= 80 ? 'Du bist der Einzige in diesem Haus, der Kultur versteht.' : hv >= 50 ? 'Schön, dass du vorbeischaust. Lief gestern nicht eine Kultursendung bei euch?' :
      hv >= 20 ? 'Ach, du schon wieder. Na gut, setz dich.' : 'Ich habe zu tun. Die Kunst wartet nicht.';
    h += '<div class="chefin"><canvas id="lena-cv" width="64" height="64"></canvas><div><p class="say">„' + say + '“</p>';
    h += '<p><span class="heart">♥</span> Herz: <span class="moodbar big heartbar"><span style="width:' + hv + '%"></span></span> ' + hv + ' / 100 <span class="dim">(Deckel durch dein Image: ' + cap + ')</span></p>';
    h += '</div></div><h3>Geschenke in deiner Aktentasche</h3>';
    h += s.gifts.length ? '<p>' + s.gifts.map((g, i) => '<button data-act="give" data-id="' + i + '">' + esc(SC.GIFTS.find(x => x.id === g).name) + ' überreichen</button>').join(' ') + '</p>' : '<p class="dim">Keine. Der Kiosk im Erdgeschoss hat etwas Passendes.</p>';
    h += '<h3>Was Lena mag</h3><ul><li>Kultursendungen zwischen 19 und 24 Uhr (je Stunde +2 ♥), auch wenn sie wenig Quote bringen.</li><li>Erfolg: Platz 1 am Abend +4 ♥, Platz 2 +2 ♥.</li><li>Geschenke, aber nicht ständig dasselbe.</li></ul>';
    h += '<h3>Konkurrenz um Lena</h3><table><tr><th>Sender</th><th>Herz</th></tr>' + allChannels().map((c, i) => '<tr><td style="color:' + c.col + '">' + esc(c.name) + '</td><td>' + (i === 0 ? s.heart : c.heart) + '</td></tr>').join('') + '</table>';
    return h;
  }
  function roomKiosk(s) {
    let h = head('KIOSK „ZUM GOLDENEN BILDSCHIRM“');
    h += '<p class="say">„Na, was Schönes für die Dame aus der Kulturredaktion? Hab ich alles da!“</p>';
    h += '<table><tr><th>Geschenk</th><th>Wirkung</th><th>Preis</th><th></th></tr>' + SC.GIFTS.map(g => '<tr><td>' + esc(g.name) + '</td><td class="heart">' + '♥'.repeat(Math.ceil(g.heart / 5)) + '</td><td>' + money(g.price) + '</td><td><button data-act="gift" data-k="' + g.id + '"' + (s.money < g.price || s.gifts.length >= 3 ? ' disabled' : '') + '>Kaufen</button></td></tr>').join('') + '</table>';
    h += '<p class="dim">In der Aktentasche: ' + (s.gifts.length ? s.gifts.map(g => esc(SC.GIFTS.find(x => x.id === g).name)).join(', ') : 'nichts') + ' (höchstens 3). Überreichen in der Kulturredaktion, 4. Etage.</p>';
    return h;
  }
  function roomLobby(s) {
    let h = head('PFÖRTNER · SCHWARZES BRETT');
    h += '<p class="say">„Morgen, Chef! ' + SC.BOSS.name + ' ist schon wieder schlecht gelaunt, und ' + SC.LOVE.name + ' sitzt ganz oben in der Kultur. Die von Blitz TV und Kanal Krawall schleichen auch hier rum, also Augen auf!“</p>';
    h += '<h3>So läuft ein Tag</h3><ol>' +
      '<li>Bis 18:00 Uhr gehst du durchs Haus: Filme kaufen und ersteigern (1. Etage), Werbung unterschreiben (2.), Nachrichten einkaufen (3.), Geschenke am Kiosk (EG).</li>' +
      '<li>Im <b>Büro</b> legst du fest, was von 18 bis 1 Uhr läuft und welcher Spot nach der Sendung kommt.</li>' +
      '<li>Um 18:00 Uhr (oder per „Sendeabend starten“) wird gesendet. Danach kommt die Tagesbilanz.</li>' +
      '<li>Ziel: Image hochkämpfen und das Herz von ' + SC.LOVE.name + ' (4. Etage) gewinnen. Den grantigen Chef nebenan bei Laune halten.</li></ol>';
    h += '<h3>Konkurrenz</h3><table><tr><th>Sender</th><th>Filme</th><th>Image</th><th>Gestern</th></tr>';
    const l = s.history[s.history.length - 1];
    allChannels().forEach((c, i) => {
      const img = i === 0 ? s.image : c.image, n = i === 0 ? s.films.length : c.films.length;
      h += '<tr><td style="color:' + c.col + '">' + esc(c.name) + '</td><td>' + n + '</td><td>' + img + ' Punkte</td><td>' + (l ? viewers(l.totals[i]) : '–') + '</td></tr>';
    });
    h += '</table><p>Image: ' + imgBar(s) + '</p><h3>Meldungen</h3><ul class="log">' + s.log.slice(0, 10).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
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
    if (a === 'bid') r = sim().bid(s);
    if (a === 'agency') r = sim().toggleAgency(s, b.dataset.k);
    if (a === 'gift') r = sim().buyGift(s, b.dataset.k);
    if (a === 'give') r = sim().giveGift(s, id);
    if (r && r.ok && (a === 'buy' || a === 'sell' || a === 'sign' || a === 'news' || a === 'gift' || a === 'give' || a === 'bid')) aud('jingle', 'buy');
    if (r && r.ok && r.msg) { toast(r.msg); UI.refresh(); return; }
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

  function drawLena(c, mood) {
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

  function drawBoss(c, mood) {
    if (!c) return; const g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(0, 0, 64, 64, '#552200'); R(0, 48, 64, 16, '#331100');
    R(10, 42, 44, 22, '#303848'); R(28, 42, 8, 22, '#fff'); R(30, 44, 4, 18, '#c02020');
    R(18, 10, 28, 30, mood < 30 ? '#f09070' : '#e8b080');
    R(18, 8, 28, 5, '#bbb'); R(16, 12, 4, 12, '#bbb'); R(44, 12, 4, 12, '#bbb'); R(24, 6, 16, 3, '#e8b080');
    R(22, 18, 8, 2, '#333'); R(34, 18, 8, 2, '#333');
    if (mood < 55) { R(22, 17, 3, 1, '#333'); R(39, 17, 3, 1, '#333'); }
    R(24, 21, 4, 3, '#fff'); R(36, 21, 4, 3, '#fff'); R(25, 22, 2, 2, '#000'); R(37, 22, 2, 2, '#000');
    R(30, 24, 4, 6, '#d09060'); R(22, 31, 20, 3, '#777');
    if (mood >= 70) { R(26, 35, 12, 2, '#802020'); R(25, 34, 2, 1, '#802020'); R(37, 34, 2, 1, '#802020'); }
    else { R(26, 35, 12, 2, '#802020'); R(25, 36, 2, 1, '#802020'); R(37, 36, 2, 1, '#802020'); }
    R(48, 50, 8, 9, '#f0f0f0'); R(56, 52, 2, 4, '#f0f0f0'); R(49, 51, 6, 2, '#603010'); // Kaffeetasse
  }

  // ---------- Unterleiste: Fernseher, Werte, Familie ----------
  UI.tvChan = 0;
  UI.bar = function () {
    const c = $('bar'); const s = S(); if (!c || !s) return;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const T = (txt, x, y, col, size, al) => { g.font = 'bold ' + (size || 8) + 'px monospace'; g.textAlign = al || 'left'; g.textBaseline = 'top'; g.fillStyle = '#000'; g.fillText(txt, x + 1, y + 1); g.fillStyle = col; g.fillText(txt, x, y); };
    R(0, 0, 480, 64, '#3a3a50'); R(0, 0, 480, 1, '#9a9ab8');
    const ch = allChannels()[UI.tvChan];
    R(4, 4, 132, 56, '#6a4a2a'); R(8, 8, 104, 48, '#000');
    let f = null;
    if (UI.tvChan === 0) { const p = s.plan[20]; f = p && p.film ? sim().filmById(s, p.film) : null; }
    else { const r = s.rivals[UI.tvChan - 1]; f = r.plan[20] ? r.films.find(x => x.id === r.plan[20]) : null; }
    if (f) { const col = SC.GENRES[f.genre].col; for (let y = 8; y < 56; y += 3) R(8, y, 104, 2, y % 6 ? col : '#000'); g.globalAlpha = 0.6; R(8, 8, 104, 48, '#000'); g.globalAlpha = 1; }
    else ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f'].forEach((col, i) => R(8 + i * 15, 8, 15, 36, col));
    T(ch.name, 11, 10, ch.col, 8); T('HEUTE 20 UHR', 11, 20, '#fff', 7);
    T(f ? (f.title.length > 17 ? f.title.slice(0, 16) + '…' : f.title) : 'Testbild', 11, 32, '#fff', 7);
    if (f) T(SC.GENRES[f.genre].name + ' Q' + f.q, 11, 42, '#ccc', 7);
    R(116, 10, 16, 6, '#202020'); R(118, 20, 12, 12, '#888'); R(118, 36, 12, 12, '#888');
    T('+', 121, 21, '#000', 9); T('-', 121, 37, '#000', 9);
    T(clock(s.minute) + ' UHR', 146, 6, '#ff8800', 12);
    T('Tag ' + s.day, 146, 22, '#fff', 8);
    T(money(s.money), 146, 33, s.money < 0 ? '#ff6060' : '#80ff80', 9);
    const fc = sim().forecast(s, 20);
    T('20 Uhr ca. ' + viewers(fc), 146, 46, '#9cf', 8);
    R(258, 8, 32, 48, '#202030'); const hv = s.heart;
    R(262, 52 - Math.round(hv * 0.32), 24, Math.round(hv * 0.32), '#ff3070');
    T('♥', 268, 10, '#ff3070', 12); T(String(hv), 274, 42, '#fff', 8, 'center');
    let x0 = 296; const iv = [s.image].concat(s.rivals.map(r => r.image)); const ac = allChannels();
    iv.forEach((v, i) => { const w = Math.round(v * 0.38); R(x0, 10, w, 8, ac[i].col); x0 += w; });
    T('IMAGE', 296, 22, '#fff', 7); T(String(s.image), 296, 32, SC.PLAYER.col, 10);
    R(338, 4, 138, 56, '#6a4a2a'); R(342, 8, 130, 48, '#c8a878');
    R(342, 8, 130, 4, '#a08060'); R(446, 16, 22, 18, '#8090a0'); R(448, 18, 18, 14, f && UI.tvChan === 0 ? SC.GENRES[f.genre].col : '#40c0ff');
    R(350, 38, 84, 12, '#a03030'); R(346, 32, 6, 18, '#802020'); R(432, 32, 6, 18, '#802020'); R(350, 32, 84, 8, '#b04040');
    const share = Math.max(0, Math.min(1, fc / (SC.AUDIENCE[20] * 0.45)));
    const n = Math.max(0, Math.min(4, Math.round(share * 4)));
    const fam = [['#e0b080', '#603010', '#4060c0'], ['#f0c090', '#c08020', '#c04080'], ['#e0b080', '#402010', '#40a040'], ['#f0d0a0', '#ffe060', '#e08020']];
    for (let i = 0; i < 4; i++) {
      if (i >= n) continue;
      const fx = 358 + i * 19, dy = i < 2 ? 0 : 4;
      R(fx, 20 + dy, 8, 8, fam[i][0]); R(fx, 18 + dy, 8, 3, fam[i][1]); R(fx - 1, 28 + dy, 10, 10, fam[i][2]); R(fx + 2, 23 + dy, 1, 1, '#000'); R(fx + 5, 23 + dy, 1, 1, '#000');
    }
    if (n === 0) T('niemand schaut …', 352, 18, '#604020', 7);
    T('FAMILIE SOFA', 392, 51, '#402010', 6, 'center');
  };

  // ---------- Sendeabend ----------
  UI.overlayOpen = () => !!UI.overlay;
  function openOverlay(kind, html) { UI.overlay = kind; const o = $('overlay'); o.innerHTML = html; o.classList.remove('hidden'); }
  function closeOverlay() { UI.overlay = null; $('overlay').classList.add('hidden'); $('overlay').innerHTML = ''; }

  UI.startEvening = function () {
    const s = S(); if (!s || s.phase !== 'tag' || UI.overlay) return;
    if (UI.room) UI.closeRoom();
    s.minute = SC.EVENING;
    const res = sim().runEvening(s);
    sim().save(s);
    aud('play', 'evening');
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
  function adResult(ad) {
    if (!ad) return '–';
    if (ad.ok) return '<span class="good">✔ ' + esc(ad.sponsor) + ' +' + money(ad.pay) + '</span>';
    if (ad.skip) return '<span class="dim">✘ ' + esc(ad.sponsor) + ' (Limit erreicht)</span>';
    return '<span class="bad">✘ ' + esc(ad.sponsor) + ' (zu wenig)</span>';
  }
  function addTvRow(hr, ch) {
    const max = Math.max.apply(null, hr.views);
    let r = '<tr><td>' + hh(hr.h) + (hr.news ? '<div class="small dim">+News</div>' : '') + '</td>';
    hr.views.forEach((v, i) => { r += '<td' + (v === max ? ' class="best"' : '') + '><div class="small">' + esc(hr.titles[i]) + '</div><span class="vbar" style="width:' + Math.round(v / 40) + 'px;background:' + ch[i].col + '"></span> ' + viewers(v) + '</td>'; });
    r += '<td>' + adResult(hr.ad) + '</td></tr>';
    $('tvtab').insertAdjacentHTML('beforeend', r);
    if (hr.ad && !hr.ad.skip) aud('jingle', hr.ad.ok ? 'spotOk' : 'spotFail');
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
    $('tvinfo').innerHTML = '<div class="big">' + hh(hr.h) + ' Uhr</div><div>' + esc(hr.titles[0]) + '</div><div class="dim">' + (gid ? SC.GENRES[gid].name : 'kein Programm') + '</div><div>' + viewers(hr.views[0]) + ' schauen zu</div><div class="small">Image ' + hr.imgs.join(' / ') + '</div>';
  }

  function showBilanz() {
    const s = S(), r = s.last; if (!r) return;
    const ch = allChannels();
    let h = '<div class="box"><h2>TAGESBILANZ · TAG ' + r.day + '</h2>';
    h += '<table><tr><th>Platz</th><th>Sender</th><th>Zuschauer gesamt</th></tr>';
    r.order.forEach((ci, k) => { h += '<tr><td>' + (k + 1) + '.</td><td style="color:' + ch[ci].col + '">' + esc(ch[ci].name) + '</td><td>' + viewers(r.totals[ci]) + '</td></tr>'; });
    h += '</table><table class="money"><tr><td>Werbeeinnahmen (' + r.spotsOk + ' Spots, ' + r.spotsFail + ' geplatzt)</td><td class="good">' + money(r.income) + '</td></tr>' +
      '<tr><td>Grundeinnahmen (Kabelgebühren)</td><td class="good">' + money(r.baseIncome) + '</td></tr>' +
      '<tr><td>Vertragsstrafen</td><td class="bad">' + money(-r.penalties) + '</td></tr>' +
      '<tr><td>Betriebskosten und Filmlizenzen</td><td class="bad">' + money(-r.costs) + '</td></tr>' +
      '<tr><td>Agentur-Abos</td><td class="bad">' + money(-r.fees) + '</td></tr>' +
      '<tr><td>Zinsen</td><td class="bad">' + money(-r.interest) + '</td></tr>' +
      '<tr><td class="dim">Heute schon bezahlt: Nachrichten</td><td class="dim">' + money(-r.newsCost) + '</td></tr>' +
      (r.autoCredit ? '<tr><td>Automatischer Kredit der Bank</td><td>' + money(r.autoCredit) + '</td></tr>' : '') +
      '<tr><th>Kontostand</th><th>' + money(s.money) + '</th></tr></table>';
    if (r.finished.length) h += '<p class="good">Erfüllt: ' + r.finished.map(esc).join(', ') + '</p>';
    if (r.failed.length) h += '<p class="bad">Geplatzt: ' + r.failed.map(esc).join(', ') + '</p>';
    const sg = v => (v >= 0 ? '+' : '') + v;
    h += '<p>Image: ' + imgBar(s) + ' ' + s.image + ' (' + sg(r.imageDelta) + ') · <span class="heart">♥</span> ' + s.heart + ' (' + sg(r.heartDelta) + ')' + (r.culture ? ' · ' + r.culture + ' Kulturstunden' : '') + '</p>';
    if (r.heartCapHit) h += '<p class="bad">Image zu niedrig, Lena wendet sich ab.</p>';
    h += '<div class="chefin"><canvas id="chefin-b" width="64" height="64"></canvas><div><p class="say">' + esc(SC.BOSS.name) + ': „' + esc(r.boss) + '“</p><p>Laune des Chefs: ' + s.mood + ' (' + sg(r.moodDelta) + ')</p></div></div>';
    if (s.over) h += endText(s);
    else h += '<p><button id="btn-next">Nächster Tag</button></p>';
    h += '</div>';
    openOverlay('bilanz', h);
    aud('play', 'balance');
    if (s.over === 'sieg') { aud('stop'); aud('jingle', 'win'); }
    else if (s.over) { aud('stop'); aud('jingle', 'lose'); }
    drawBoss($('chefin-b'), s.mood);
    if ($('btn-next')) $('btn-next').onclick = () => { sim().nextDay(s); sim().save(s); SC.building.reset(); aud('play', 'tower'); showMorning(); };
    if ($('btn-new2')) $('btn-new2').onclick = () => UI.newGame();
  }
  function endText(s) {
    const t = { sieg: ['HOCHZEIT!', SC.LOVE.name + ' sagt Ja! Ihr fahrt auf Traumreise, und ' + SC.PLAYER.name + ' ist der Sender der Stunde.'],
      gefeuert: ['GEFEUERT', SC.BOSS.name + ' hat genug: ' + (s.image < 8 ? 'Das Image ist am Boden.' : 'Seine Laune ist bei null.') + ' Du räumst deinen Schreibtisch.'],
      liebe: ['ZU SPÄT', SC.LOVE.name + ' hat sich für den Chef von ' + (s.rivals.find(r => r.heart >= 100) || s.rivals[0]).name + ' entschieden.'],
      pleite: ['PLEITE', 'Der Kreditrahmen ist ausgeschöpft und das Konto im Minus. Die Bank dreht den Saft ab.'] }[s.over];
    return '<div class="end ' + (s.over === 'sieg' ? 'good' : 'bad') + '"><h2>' + t[0] + '</h2><p>' + t[1] + '</p><p>Gespielt: ' + s.day + ' Tage · Filme gekauft: ' + s.stats.bought + ' · Werbespots: ' + s.stats.spots + ' · Bester Abend: ' + viewers(s.stats.best) + '</p></div><p><button id="btn-new2">Neues Spiel</button></p>';
  }

  // ---------- Titel und Menü ----------
  UI.showTitle = function () {
    const sv = sim().load();
    let h = '<div class="box title"><canvas id="logo" width="320" height="90"></canvas>';
    h += '<p class="big">Du leitest den kleinen Fernsehsender <b style="color:#ffcc00">' + SC.PLAYER.name + '</b>. Kauf und ersteigere Filme, verkauf Werbung, schlag Blitz TV und Kanal Krawall im Image-Kampf, überlebe den grantigen ' + SC.BOSS.name + ' und gewinn das Herz von ' + SC.LOVE.name + '.</p>';
    h += '<p>' + (sv && !sv.over ? '<button id="t-cont">Weiterspielen (Tag ' + sv.day + ')</button> ' : '') + '<button id="t-new">Neues Spiel</button></p>';
    h += '<p class="dim">Klick im Hochhaus auf eine Tür oder nutze die Raumknöpfe unter dem Bild. Der Spielstand wird im Browser gespeichert.</p>';
    h += '<p class="dim small">Inspiriert von Mad TV (1991). Eigenständiges Fanprojekt mit eigener Grafik, eigenen Texten und selbst erzeugter Musik, ohne Original-Inhalte. Version ' + SC.VERSION + '.</p></div>';
    openOverlay('titel', h);
    drawLogo($('logo'));
    aud('play', 'title');
    $('t-new').onclick = () => { aud('unlock'); aud('play', 'tower'); UI.newGame(); };
    if ($('t-cont')) $('t-cont').onclick = () => { aud('unlock'); aud('play', 'tower'); SC.S = sv; afterLoad(); };
  };
  function moodBand(m) { return m >= 70 ? 'high' : m >= 35 ? 'mid' : 'low'; }
  function morningLine(s) {
    const T = SC.BOSS_TEXT.morning;
    const last = s.history[s.history.length - 1];
    const band = moodBand(s.mood);
    if (!last) return T.day1[band];
    return T.rank[last.rank][band];
  }
  function showMorning() {
    const s = S();
    const last = s.history[s.history.length - 1];
    let h = '<div class="box"><h2>MORGENBESPRECHUNG</h2>';
    h += '<div class="chefin"><canvas id="boss-m" width="64" height="64"></canvas><div>';
    h += '<p class="say">„' + esc(morningLine(s)) + '“</p>';
    if (last) h += '<p class="dim">Gestern: Platz ' + last.rank + ' · Laune: ' + s.mood + '</p>';
    else h += '<p class="dim">Tag 1 · Laune: ' + s.mood + '</p>';
    h += '</div></div>';
    h += '<p><button id="btn-work">An die Arbeit</button></p></div>';
    openOverlay('morgen', h);
    drawBoss($('boss-m'), s.mood);
    $('btn-work').onclick = () => {
      closeOverlay();
      showLog();
      if (s.day === 1 && !s.history.length)
        toast('Neues Spiel! Schau zuerst ins Büro (1. Etage) und zur Werbeagentur (2. Etage). Klick auf den linken Fernseher unten schaltet die Sender um.');
      else
        toast('Tag ' + s.day + ' beginnt. Neue Filme, Werbung und Nachrichten sind da.');
    };
  }
  function afterLoad(briefing) {
    closeOverlay(); SC.building.reset(); showLog();
    if (S().phase === 'bilanz') showBilanz();
    else if (briefing) showMorning();
  }
  UI.newGame = function (seed) {
    if (UI.evTimer) { clearInterval(UI.evTimer); UI.evTimer = null; }
    if (UI.room) UI.closeRoom();
    SC.S = sim().newGame(seed || (Date.now() & 0x7fffffff)); sim().save(S()); aud('play', 'tower'); afterLoad(true);
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
      '<p class="dim">Tastatur: Leertaste = Pause, 1/2/4 = Tempo, M = Ton, Esc = Raum verlassen.</p></div>';
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
    if (SC.audio) { SC.audio.init(); syncSoundBtn(); }
    $('btn-sound').onclick = () => {
      const wasReady = SC.audio && SC.audio.state && SC.audio.state().ready;
      aud('unlock');
      if (wasReady) aud('setMuted', !(SC.audio && SC.audio.isMuted()));
      syncSoundBtn();
      if (SC.audio && !SC.audio.isMuted() && !SC.audio.state().track) aud('play', S() && S().phase === 'tag' ? 'tower' : 'title');
    };
    $('vol').oninput = () => { aud('unlock'); aud('setVolume', Number($('vol').value) / 100); syncSoundBtn(); };
    $('bar').addEventListener('click', e => { const r = $('bar').getBoundingClientRect(); const x = (e.clientX - r.left) * 480 / r.width; if (x < 140) UI.tvChan = (UI.tvChan + 1) % 3; });
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
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
      if (UI.overlay) return;
      if (e.key === ' ') { UI.paused = !UI.paused; e.preventDefault(); }
      if (e.key === '1') UI.speed = 1; if (e.key === '2') UI.speed = 2; if (e.key === '4') UI.speed = 4;
      if (e.key === 'Escape') UI.closeRoom();
      if (e.key === 'm' || e.key === 'M') { aud('unlock'); aud('setMuted', !(SC.audio && SC.audio.isMuted())); syncSoundBtn(); e.preventDefault(); }
    });
    window.addEventListener('beforeunload', () => { if (S()) sim().save(S()); });
  };
  UI.clock = clock;
  SC.ui = UI;
})(window.SC);
