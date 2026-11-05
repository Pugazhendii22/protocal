/* ============================================================
   audit.js — self-QA: screenshots + automated bug hunting
   ============================================================ */
const { chromium } = require('playwright-core');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8080/';
const SHOTS = '/home/user/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const issues = [];
const note = (kind, where, detail) => issues.push({ kind, where, detail });

/* ---------- in-page audit, injected into every page ---------- */
const AUDIT = `() => {
  const out = { bad_text: [], overflow: [], offscreen: [], tiny: [], empty: [], mystery: [] };
  const BAD = /(undefined|NaN|\\[object Object\\]|\\{\\{|\\}\\}|�)/;
  // text sanity
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.nodeValue;
    if (!t || !t.trim()) continue;
    if (n.parentElement && n.parentElement.closest('.hexw, .cli, pre, code')) continue; // raw dumps are content
    if (BAD.test(t)) out.bad_text.push(t.trim().slice(0, 90));
  }
  // horizontal overflow inside the scroll container
  const view = document.getElementById('view');
  if (view && view.scrollWidth > view.clientWidth + 2) {
    out.overflow.push({ el: '#view', scrollWidth: view.scrollWidth, clientWidth: view.clientWidth });
  }
  document.querySelectorAll('.panel, .pcard, .gl, .explain, .canvas, table, .cli, .insp, .opts').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).overflowX === 'visible') {
      out.overflow.push({ el: el.className.slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth });
    }
  });
  // anything sticking out past the right edge of the window
  const vw = window.innerWidth;
  const inScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  };
  document.querySelectorAll('#view *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (inScroller(el)) return;              // deliberately pannable (mobile diagram)
    if (r.right > vw + 6 && getComputedStyle(el).position !== 'fixed') {
      out.offscreen.push({ el: (el.className || el.tagName).toString().slice(0, 44), right: Math.round(r.right), vw });
    }
  });
  // text clipped by a fixed height
  document.querySelectorAll('#view .nm, #view .info, #view h1, #view h2, #view h3, #view .t1, #view .fv, #view .pall, #view td').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflow === 'hidden' && el.clientHeight > 8) {
      out.tiny.push({ el: el.className.toString().slice(0, 30), text: el.textContent.trim().slice(0, 40), sh: el.scrollHeight, ch: el.clientHeight });
    }
  });
  // clickable things with no handler and no href
  const acts = new Set();
  document.querySelectorAll('[data-act]').forEach((el) => acts.add(el.getAttribute('data-act')));
  out.acts = [...acts];
  document.querySelectorAll('a[href]').forEach((a) => {
    const h = a.getAttribute('href');
    if (!h || h === '#' || h === 'javascript:void(0)') out.mystery.push('dead link: ' + a.textContent.trim().slice(0, 30));
  });
  // empty interactive regions
  out.empty = [...document.querySelectorAll('.panel > .bd, .panel > .hd, .explain')]
    .filter((el) => el.textContent.trim().length === 0).length;
  return out;
}`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  const runAudit = async (label) => {
    const a = await page.evaluate('(' + AUDIT + ')()');
    if (a.bad_text.length) note('bad-text', label, a.bad_text.slice(0, 3).join(' | '));
    if (a.overflow.length) note('overflow', label, JSON.stringify(a.overflow.slice(0, 3)));
    if (a.offscreen.length) note('offscreen', label, JSON.stringify(a.offscreen.slice(0, 3)));
    if (a.tiny.length) note('clipped', label, JSON.stringify(a.tiny.slice(0, 3)));
    if (a.empty) note('empty', label, a.empty + ' empty regions');
    if (a.mystery.length) note('deadlinks', label, a.mystery.slice(0, 3).join(' | '));
    return a;
  };

  const shot = async (name, full) => {
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: !!full });
  };

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  /* ---------- 1. every view ---------- */
  for (const v of ['tour', 'lab', 'library', 'glossary', 'cheatsheet', 'sources', 'exam', 'timeline']) {
    await page.evaluate((v) => { PE_UI.S.view = v; PE_UI.S.search = ''; PE_APP.render(); }, v);
    await page.waitForTimeout(320);
    await runAudit('view:' + v);
    await shot('view-' + v);
  }

  /* ---------- 2. lessons: first, middle, last, each track's first ---------- */
  const lessonIds = await page.evaluate(() => PE_UI.LESSONS.map((l) => l.id));
  const trackFirst = await page.evaluate(() => PE_UI.TRACKS.map((t) => PE_UI.LESSONS.find((l) => l.track === t.id).id));
  const sampled = [...new Set([
    lessonIds[0], lessonIds[1], lessonIds[lessonIds.length - 1],
    ...trackFirst,
    'dns', 'tcp-handshake', 'http', 'tls', 'nat', 'ipv6', 'quic', 'k8s', 'webrtc',
  ])].filter(Boolean);

  for (const id of sampled) {
    const steps = await page.evaluate((id) => PE_UI.byId[id].steps.length, id);
    for (const si of [0, Math.floor(steps / 2), steps - 1]) {
      await page.evaluate(([id, si]) => { PE_UI.S.playing = false; PE_APP.goLesson(id, si); }, [id, si]);
      await page.waitForTimeout(700);
      await runAudit('lesson:' + id + '#' + si);
      if (si === Math.floor(steps / 2)) await shot('lesson-' + id);
    }
  }

  /* ---------- 3. lab: every topology, several devices, every tab ---------- */
  const topos = await page.evaluate(() => Object.keys(PE_TOPO.TOPOLOGIES));
  for (const t of topos) {
    const devs = await page.evaluate((t) => PE_TOPO.TOPOLOGIES[t].devices.map((d) => d.id), t);
    // screenshot the topology overview once
    await page.evaluate(([t, d]) => {
      PE_UI.S.view = 'lab'; PE_UI.S.lab.topo = t; PE_UI.S.lab.device = d; PE_UI.S.lab.tab = 'overview'; PE_APP.render();
    }, [t, devs[0]]);
    await page.waitForTimeout(300);
    await shot('lab-' + t);
    for (const d of devs.slice(0, 3)) {
      for (const tab of ['overview', 'interfaces', 'routes', 'arp', 'services', 'activity', 'trace', 'cli']) {
        await page.evaluate(([t, d, tab]) => {
          PE_UI.S.view = 'lab'; PE_UI.S.lab.topo = t; PE_UI.S.lab.device = d; PE_UI.S.lab.tab = tab; PE_APP.render();
        }, [t, d, tab]);
        await page.waitForTimeout(70);
        await runAudit('lab:' + t + '/' + d + '/' + tab);
      }
    }
  }

  /* ---------- 4. protocol library detail ---------- */
  const protos = await page.evaluate(() => PE_DATA.PROTOCOLS.map((p) => p.id));
  for (const pid of protos) {
    await page.evaluate((pid) => { PE_UI.S.view = 'library'; PE_UI.S.lib = pid; PE_APP.render(); }, pid);
    await page.waitForTimeout(80);
    await runAudit('proto:' + pid);
    const drill = await page.evaluate(() => {
      const el = document.getElementById('proto-detail');
      return el ? el.textContent.trim().length : 0;
    });
    if (!drill) note('proto-detail', pid, 'clicking a protocol card renders no detail panel');
  }
  await page.evaluate(() => { PE_UI.S.view = 'library'; PE_UI.S.lib = 'tls'; PE_APP.render(); });
  await page.waitForTimeout(250);
  await shot('proto-tls');

  /* ---------- 5. exam: setup, running, result ---------- */
  await page.evaluate(() => { PE_UI.S.view = 'exam'; PE_APP.render(); });
  await page.waitForTimeout(250);
  await page.click('[data-act="exam-start"]');
  await page.waitForTimeout(400);
  await runAudit('exam:run');
  await shot('exam-run');
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(() => PE_UI.S.exam.stage);
    if (st !== 'run') break;
    const last = await page.evaluate(() => PE_UI.S.exam.i === PE_UI.S.exam.qs.length - 1);
    if (last) { await page.click('[data-act="exam-finish"]'); break; }
    await page.click('[data-act="exam-answer"][data-o="0"]');
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(350);
  await runAudit('exam:result');
  await shot('exam-result');

  /* ---------- 6. palette ---------- */
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(200);
  await page.fill('#palin', 'tls');
  await page.waitForTimeout(250);
  await runAudit('palette');
  await shot('palette');
  await page.keyboard.press('Escape');

  /* ---------- 7. handler coverage: every data-act must exist in app.js ---------- */
  const acts = await page.evaluate(() => {
    const set = new Set();
    const collect = () => document.querySelectorAll('[data-act]').forEach((el) => set.add(el.getAttribute('data-act')));
    collect();
    PE_UI.LESSONS.forEach((l) => { PE_APP.goLesson(l.id, 0); collect(); });
    ['tour', 'lab', 'library', 'glossary', 'cheatsheet', 'sources', 'exam', 'timeline'].forEach((v) => { PE_UI.S.view = v; PE_APP.render(); collect(); });
    return [...set];
  });
  const src = fs.readFileSync('/home/user/src/app.js', 'utf8');
  const missing = acts.filter((a) => !new RegExp("case '" + a + "'").test(src) && !/^(exam-|lab-|cli-|proto|dev|glossary)/.test(a));
  const missingHard = acts.filter((a) => !new RegExp("case '" + a + "'").test(src));
  if (missingHard.length) note('no-handler', 'app.js', missingHard.join(', '));

  /* ---------- 8. narrow + mobile ---------- */
  for (const [w, h, tag] of [[390, 844, 'mobile'], [820, 900, 'tablet']]) {
    const p2 = await ctx.newPage();
    await p2.setViewportSize({ width: w, height: h });
    const e2 = [];
    p2.on('pageerror', (e) => e2.push(e.message));
    await p2.goto(BASE, { waitUntil: 'load' });
    await p2.waitForTimeout(400);
    await p2.screenshot({ path: `${SHOTS}/${tag}-home.png` });
    await p2.evaluate(() => PE_APP.goLesson('dns', 2));
    await p2.waitForTimeout(1200);
    await p2.screenshot({ path: `${SHOTS}/${tag}-lesson.png` });
    const m = await p2.evaluate('(' + AUDIT + ')()');
    if (m.overflow.length) note('overflow', tag, JSON.stringify(m.overflow.slice(0, 3)));
    if (m.offscreen.length) note('offscreen', tag, JSON.stringify(m.offscreen.slice(0, 3)));
    if (e2.length) note('js-error', tag, e2.slice(0, 2).join(' | '));
    await p2.close();
  }

  /* ---------- 9. single file ---------- */
  const p3 = await ctx.newPage();
  const e3 = [];
  p3.on('pageerror', (e) => e3.push(e.message));
  await p3.goto('file:///home/user/protocol-explorer.html', { waitUntil: 'load' });
  await p3.waitForTimeout(600);
  const one = await p3.evaluate(() => ({ lessons: PE_UI.LESSONS.length, view: PE_UI.S.view }));
  if (e3.length) note('js-error', 'single-file', e3.slice(0, 2).join(' | '));
  await p3.close();

  await browser.close();

  /* ---------- report ---------- */
  console.log('\n=== js errors ===');
  console.log(errs.length ? errs.slice(0, 12).join('\n') : 'none');
  console.log('\n=== audit issues: ' + issues.length + ' ===');
  const byKind = {};
  issues.forEach((i) => { (byKind[i.kind] = byKind[i.kind] || []).push(i); });
  Object.keys(byKind).forEach((k) => {
    console.log('\n[' + k + '] x' + byKind[k].length);
    byKind[k].slice(0, 6).forEach((i) => console.log('  ' + i.where + ' → ' + i.detail));
  });
  console.log('\nsingle-file:', JSON.stringify(one));
  fs.writeFileSync('/home/user/shots/audit.json', JSON.stringify({ errs, issues }, null, 2));
})();
