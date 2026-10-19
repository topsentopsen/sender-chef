// Headless-Chrome-Prüfung: lädt das Spiel, spielt einen Tag, macht Screenshots.
// Aufruf: NODE_PATH=/workspace/tmp-check/node_modules node test/browser-check.js [url]
'use strict';
const puppeteer = require('puppeteer-core');
const url = process.argv[2] || 'file://' + require('path').resolve(__dirname, '..', 'index.html') + '?fast=1';
const out = process.env.SHOTS || '/workspace/sender-chef';
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 820 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: out + '-1-titel.png' });
  await page.click('#t-new');
  await page.waitForSelector('#btn-work', { timeout: 5000 });
  await page.click('#btn-work');
  // zur Filmhandlung laufen (per Raumknopf), Film kaufen
  await page.click('#rooms button[data-room="filme"]');
  await page.waitForFunction(() => window.SC.ui.room === 'filme', { timeout: 20000 });
  const before = await page.evaluate(() => window.SC.S.films.length);
  const buyBtn = await page.$('#room button[data-act="buy"]:not([disabled])');
  if (buyBtn) await buyBtn.click();
  const after = await page.evaluate(() => window.SC.S.films.length);
  const bidBtn = await page.$('#room button[data-act="bid"]:not([disabled])');
  if (bidBtn) await bidBtn.click();
  const auction = await page.evaluate(() => window.SC.S.auction.bidder);
  await page.screenshot({ path: out + '-5-filmhandel.png' });
  // Kiosk: Blumen kaufen, bei Lena überreichen
  await page.click('#rooms button[data-room="kiosk"]');
  await page.waitForFunction(() => window.SC.ui.room === 'kiosk', { timeout: 20000 });
  await page.click('#room button[data-act="gift"]');
  await page.click('#rooms button[data-room="lena"]');
  await page.waitForFunction(() => window.SC.ui.room === 'lena', { timeout: 30000 });
  await page.click('#room button[data-act="give"]');
  const heart = await page.evaluate(() => window.SC.S.heart);
  await page.screenshot({ path: out + '-6-lena.png' });
  // Werbung unterschreiben
  await page.click('#rooms button[data-room="werbung"]');
  await page.waitForFunction(() => window.SC.ui.room === 'werbung', { timeout: 20000 });
  await page.click('#room button[data-act="sign"]');
  // Büro: Plan setzen
  await page.click('#rooms button[data-room="buero"]');
  await page.waitForFunction(() => window.SC.ui.room === 'buero', { timeout: 20000 });
  await page.evaluate(() => {
    const s = window.SC.S; const f = s.films[s.films.length - 1];
    const sel = document.querySelector('select[data-act="slot"][data-h="18"]');
    if (sel && f.len === 1) { sel.value = String(f.id); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    const ad = document.querySelector('select[data-act="ad"][data-h="20"]');
    if (ad && ad.options.length > 1) { ad.value = ad.options[ad.options.length - 1].value; ad.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.screenshot({ path: out + '-2-buero.png' });
  await page.click('#room button[data-act="leave"]');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: out + '-3-hochhaus.png' });
  // Sendeabend
  await page.click('#btn-evening');
  await page.waitForSelector('#btn-next, #btn-new2', { timeout: 20000 });
  await page.screenshot({ path: out + '-4-bilanz.png' });
  const day1 = await page.evaluate(() => ({ rank: window.SC.S.last.rank, totals: window.SC.S.last.totals, money: window.SC.S.money }));
  if (await page.$('#btn-next')) await page.click('#btn-next');
  if (await page.$('#btn-work')) await page.click('#btn-work');
  const day = await page.evaluate(() => window.SC.S.day);
  // Neu laden: Spielstand muss erhalten bleiben
  await page.reload({ waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 500));
  const cont = await page.$('#t-cont');
  console.log(JSON.stringify({ filmsBefore: before, filmsAfter: after, auctionBidder: auction, heart, day1, dayAfter: day, continueButton: !!cont, errors: errs }, null, 1));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
