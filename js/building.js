// Sender-Chef: Hochhaus im Querschnitt, Aufzug und Figuren (Canvas, Pixel-Look)
'use strict';
(function (SC) {
  const W = 480, H = 300, FH = 50, GROUND = 288, BX0 = 64, BX1 = 416, EX = 240, EW = 30;
  const WALLS = ['#c8b48c', '#9fb4cc', '#d4b0bc', '#a8c89c', '#dcc890'];
  let cv, ctx, hover = null, blink = 0;
  const P = { x: 190, f: 0, dir: 1, moving: false, anim: 0, visible: true, inLift: false, queue: [] };
  const lift = { pos: 0 };
  const npcs = [
    { f: 2, x: 330, dir: -1, col: '#ff4040', wait: 0 },
    { f: 3, x: 300, dir: 1, col: '#40d050', wait: 0 },
    { f: 0, x: 90, dir: 1, col: '#8080ff', wait: 0 }
  ];
  const floorY = f => GROUND - f * FH;

  // Skyline einmal fest erzeugen
  const sky = [];
  (function () {
    let s = 7, x = 0;
    const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    while (x < W) { const w = 18 + Math.floor(r() * 30), h = 40 + Math.floor(r() * 120); sky.push({ x, w, h, win: Math.floor(r() * 1000) }); x += w + 2; }
  })();

  function lerpCol(a, b, t) {
    const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
    return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')';
  }
  function skyCols(min) {
    const day = ['#1040b0', '#80c8ff'], dusk = ['#402080', '#ff9040'], night = ['#000018', '#182060'];
    const h = min / 60;
    if (h < 16) return day;
    if (h < 18) { const t = (h - 16) / 2; return [lerpCol(day[0], dusk[0], t), lerpCol(day[1], dusk[1], t)]; }
    if (h < 19) { const t = h - 18; return [lerpCol(dusk[0], night[0], t), lerpCol(dusk[1], night[1], t)]; }
    return night;
  }

  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function text(t, x, y, c, size, align) {
    ctx.font = 'bold ' + (size || 7) + 'px monospace'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#000'; ctx.fillText(t, x + 1, y + 1); ctx.fillStyle = c; ctx.fillText(t, x, y);
  }

  function drawSky(min) {
    const [top, bot] = skyCols(min);
    const bands = 20;
    for (let i = 0; i < bands; i++) { // Copper-Balken
      ctx.fillStyle = lerpCol(rgbHex(top), rgbHex(bot), i / (bands - 1));
      ctx.fillRect(0, Math.floor(i * H / bands), W, Math.ceil(H / bands) + 1);
    }
    const night = min >= 18 * 60 + 30;
    if (night) for (let i = 0; i < 40; i++) rect((i * 97) % W, (i * 53) % 120, 1, 1, '#fff');
    // Sonne/Mond
    const h = min / 60;
    if (h < 18.5) { const sy = 30 + Math.max(0, (h - 12)) * 22; rect(440, sy, 14, 14, '#ffe060'); rect(438, sy + 2, 18, 10, '#ffe060'); }
    else { rect(30, 24, 10, 10, '#f0f0c0'); rect(33, 24, 7, 7, lerpCol(rgbHex(top), rgbHex(top), 0)); }
    sky.forEach(b => {
      rect(b.x, GROUND - b.h, b.w, b.h, night ? '#101830' : '#3a4870');
      if (min > 17 * 60) for (let y = GROUND - b.h + 4; y < GROUND - 4; y += 7) for (let x = b.x + 3; x < b.x + b.w - 3; x += 6)
        if (((x * 7 + y * 13 + b.win) % 5) === 0) rect(x, y, 2, 3, '#ffd860');
    });
  }
  function rgbHex(c) {
    if (c[0] === '#') return c;
    const m = c.match(/\d+/g).map(Number); return '#' + m.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function drawMan(x, y, col, anim, moving, dir) {
    x = Math.round(x); y = Math.round(y);
    const s = moving ? Math.round(Math.sin(anim) * 2) : 0;
    rect(x - 3, y - 8, 2, 8 - Math.max(0, s), '#202048');
    rect(x + 1, y - 8, 2, 8 - Math.max(0, -s), '#202048');
    rect(x - 4, y - 17, 8, 9, col);
    rect(x - 5, y - 16, 1, 6, col); rect(x + 4, y - 16, 1, 6, col);
    rect(x - 1, y - 17, 2, 5, '#ffffff'); rect(x, y - 16, 1, 4, '#c02020'); // Hemd und Krawatte
    rect(x - 2, y - 22, 5, 5, '#f0c090');
    rect(x - 2, y - 23, 5, 2, '#402010');
    rect(x + (dir < 0 ? -2 : 2), y - 21, 1, 1, '#000');
  }

  function drawFloor(f, min) {
    const top = floorY(f + 1) + 4, bot = floorY(f), h = bot - top;
    rect(BX0 + 4, top, BX1 - BX0 - 8, h, WALLS[f]);
    rect(BX0 + 4, bot - 9, BX1 - BX0 - 8, 9, shade(WALLS[f], -40)); // Sockel
    rect(BX0 + 4, bot - 10, BX1 - BX0 - 8, 1, shade(WALLS[f], 30));
    for (let x = BX0 + 30; x < BX1 - 20; x += 70) { rect(x, top, 12, 2, '#555'); rect(x + 2, top + 2, 8, 2, min > 17 * 60 ? '#fff8c0' : '#ddd'); } // Lampen
    // Bilder und Pflanzen
    rect(190, top + 10, 18, 12, '#402010'); rect(192, top + 12, 14, 8, ['#60a0ff', '#ff8040', '#80e080', '#e0e060', '#c080ff'][f]);
    rect(272, top + 10, 18, 12, '#402010'); rect(274, top + 12, 14, 8, ['#ff6060', '#60e0e0', '#ffffff', '#ff80c0', '#80ff80'][f]);
    plant(BX0 + 16, bot); plant(BX1 - 16, bot);
    // Türen
    SC.FLOORS[f].doors.forEach(d => {
      const hov = hover && hover.f === f && hover.d === d;
      rect(d.x - 13, bot - 33, 26, 33, hov ? '#ffff00' : '#3a2410');
      rect(d.x - 11, bot - 31, 22, 31, d.deco ? '#706050' : '#8a5a2a');
      rect(d.x - 9, bot - 29, 18, 12, d.deco ? '#605040' : '#9a6a3a');
      rect(d.x + 6, bot - 16, 2, 2, '#ffd040');
      rect(d.x - 26, bot - 43, 52, 9, d.deco ? '#404040' : '#0055aa');
      rect(d.x - 26, bot - 43, 52, 1, '#fff');
      text(d.label, d.x, bot - 42, d.deco ? '#aaa' : '#fff', 7);
    });
    text(String(f === 0 ? 'EG' : f), BX0 + 14, top + 3, '#000', 7);
  }
  function plant(x, y) { rect(x - 4, y - 7, 8, 7, '#a04020'); rect(x - 6, y - 15, 4, 8, '#208020'); rect(x - 2, y - 18, 4, 11, '#30a030'); rect(x + 2, y - 14, 4, 7, '#208020'); }
  function shade(hex, d) { const p = [1, 3, 5].map(i => Math.max(0, Math.min(255, parseInt(hex.substr(i, 2), 16) + d))); return '#' + p.map(v => v.toString(16).padStart(2, '0')).join(''); }

  function drawBuilding(min) {
    const topY = floorY(5);
    rect(BX0 - 4, topY - 6, BX1 - BX0 + 8, GROUND - topY + 6, '#5a5a78');
    rect(BX0 - 4, topY - 6, BX1 - BX0 + 8, 2, '#9a9ab8');
    // Dach mit Leuchtschrift und Sendemast
    rect(EX - 2, 8, 4, topY - 14, '#808090');
    for (let y = 12; y < topY - 6; y += 8) { rect(EX - 6, y, 12, 1, '#808090'); }
    blink += 1;
    rect(EX - 2, 5, 4, 4, (Math.floor(blink / 30) % 2) ? '#ff2020' : '#600000');
    rect(BX0 + 20, topY - 22, 90, 16, '#101010'); text(SC.PLAYER.name.toUpperCase(), BX0 + 65, topY - 19, '#ff8800', 10);
    rect(BX1 - 110, topY - 22, 90, 16, '#101010'); text('SENDER-CHEF', BX1 - 65, topY - 19, '#40e0ff', 9);
    for (let f = 0; f < 5; f++) drawFloor(f, min);
    for (let f = 1; f < 5; f++) rect(BX0, floorY(f), BX1 - BX0, 4, '#4a3a3a');
    rect(BX0 - 10, GROUND, BX1 - BX0 + 20, H - GROUND, '#303030');
    rect(0, GROUND + 4, W, H - GROUND, '#202020');
    // Aufzugsschacht
    rect(EX - EW / 2, floorY(5) + 4, EW, GROUND - floorY(5) - 4, '#26262e');
    rect(EX, floorY(5) + 4, 1, GROUND - floorY(5), '#555');
    for (let f = 0; f < 5; f++) { const b = floorY(f); rect(EX - EW / 2 - 2, b - 36, 2, 36, '#999'); rect(EX + EW / 2, b - 36, 2, 36, '#999'); rect(EX - EW / 2 - 2, b - 38, EW + 4, 2, '#999'); }
    const cy = floorY(lift.pos);
    rect(EX - EW / 2 + 1, cy - 35, EW - 2, 35, '#b09040');
    rect(EX - EW / 2 + 3, cy - 33, EW - 6, 31, '#e0d090');
    rect(EX - EW / 2 + 1, cy - 35, EW - 2, 2, '#705010');
    // Etagenanzeige über dem Aufzug im EG
    text(String(Math.round(lift.pos) === 0 ? 'EG' : Math.round(lift.pos)), EX, floorY(0) - 46, '#ff4040', 7);
  }

  function updateNpcs(dt) {
    npcs.forEach(n => {
      if (n.wait > 0) { n.wait -= dt; n.moving = false; return; }
      n.x += n.dir * 30 * dt; n.moving = true; n.anim = (n.anim || 0) + dt * 8;
      if (n.x < BX0 + 30 || n.x > BX1 - 30 || (Math.abs(n.x - EX) < 18 && Math.random() < 0.02)) { n.dir *= -1; n.wait = 0.5 + Math.random() * 2; n.x = Math.max(BX0 + 30, Math.min(BX1 - 30, n.x)); }
    });
  }

  function moveLift(f, dt) {
    const d = f - lift.pos, sp = 1.4 * dt;
    if (Math.abs(d) <= sp) { lift.pos = f; return true; }
    lift.pos += Math.sign(d) * sp; return false;
  }

  const B = {
    W, H,
    init(canvas) { cv = canvas; ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; },
    reset() { P.x = 190; P.f = 0; P.queue = []; P.visible = true; P.inLift = false; lift.pos = 0; },
    busy() { const st = P.queue[0]; return !!st && (st.t === 'call' || st.t === 'ride'); },
    walking() { return P.queue.length > 0; },
    showPlayer() { P.visible = true; },
    goTo(f, x, room) {
      if (B.busy()) { // im Aufzug: Ziel nach der Fahrt anhängen
        const ride = P.queue.findIndex(s => s.t === 'ride');
        P.queue = P.queue.slice(0, ride + 1);
        if (P.queue[ride].f !== f) P.queue.push({ t: 'walk', x: EX }, { t: 'call' }, { t: 'ride', f });
      } else {
        P.queue = [];
        if (f !== P.f) P.queue.push({ t: 'walk', x: EX }, { t: 'call' }, { t: 'ride', f });
      }
      P.queue.push({ t: 'walk', x });
      if (room) P.queue.push({ t: 'enter', room });
      P.visible = true;
    },
    update(dt, onEnter) {
      P.moving = false;
      const st = P.queue[0];
      if (st) {
        if (st.t === 'walk') {
          const d = st.x - P.x, sp = 80 * dt;
          if (Math.abs(d) <= sp) { P.x = st.x; P.queue.shift(); } else { P.x += Math.sign(d) * sp; P.dir = Math.sign(d); P.moving = true; }
        } else if (st.t === 'call') { if (moveLift(P.f, dt)) P.queue.shift(); }
        else if (st.t === 'ride') { P.inLift = true; if (moveLift(st.f, dt)) { P.f = st.f; P.inLift = false; P.queue.shift(); } }
        else if (st.t === 'enter') { P.queue.shift(); P.visible = false; if (onEnter) onEnter(st.room); }
      }
      if (P.moving) P.anim += dt * 10;
      updateNpcs(dt);
    },
    draw(min) {
      drawSky(min);
      drawBuilding(min);
      npcs.forEach(n => drawMan(n.x, floorY(n.f), n.col, n.anim || 0, n.moving, n.dir));
      if (P.visible) {
        const y = P.inLift ? floorY(lift.pos) : floorY(P.f);
        drawMan(P.x, y, SC.PLAYER.col, P.anim, P.moving, P.dir);
        if (!P.inLift) { rect(P.x - 1, y - 30, 3, 3, '#ffcc00'); }
      }
    },
    // Koordinaten im Canvas (logisch) zu Tür
    pick(lx, ly) {
      const f = Math.floor((GROUND - ly) / FH);
      if (f < 0 || f > 4) return null;
      const bot = floorY(f);
      for (const d of SC.FLOORS[f].doors) if (lx >= d.x - 26 && lx <= d.x + 26 && ly >= bot - 44 && ly <= bot) return { f, d };
      return null;
    },
    floorAt(ly) { const f = Math.floor((GROUND - ly) / FH); return f >= 0 && f <= 4 ? f : null; },
    setHover(h) { hover = h; },
    toLogical(ev) { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height]; },
    player: P
  };
  SC.building = B;
})(window.SC);
