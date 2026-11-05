/* ============================================================
   interact.js — do the buttons actually do anything?
   Every check clicks something, then asserts the DOM changed.
   ============================================================ */
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8080/';
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const text = () => page.evaluate(() => document.getElementById('view').innerHTML.length);
  const state = () => page.evaluate(() => ({ view: PE_UI.S.view, lesson: PE_UI.S.lessonId, step: PE_UI.S.step, sel: PE_UI.S.sel, lib: PE_UI.S.lib, tab: PE_UI.S.lab.tab, dev: PE_UI.S.lab.device, topo: PE_UI.S.lab.topo, peek: PE_UI.S.peek, playing: PE_UI.S.playing }));

  /* --- sidebar: open a lesson from the tree --- */
  await page.click('.navitem[data-act="lesson"]');
  await page.waitForTimeout(400);
  let s = await state();
  ok('sidebar lesson opens', s.view === 'lesson', JSON.stringify(s));

  /* --- step pills --- */
  await page.evaluate(() => PE_APP.goLesson('dns', 0));
  await page.waitForTimeout(300);
  await page.click('.pip[data-i="2"]');
  await page.waitForTimeout(300);
  s = await state();
  ok('step pill jumps', s.step === 2, 'step=' + s.step);

  /* --- next/prev step buttons in the explanation --- */
  await page.click('.navrow .btn.primary');
  await page.waitForTimeout(250);
  s = await state();
  ok('Next button advances step', s.step === 3, 'step=' + s.step);
  await page.click('.navrow .btn:not(.primary)');
  await page.waitForTimeout(250);
  s = await state();
  ok('Back button goes back', s.step === 2, 'step=' + s.step);

  /* --- packet row click selects a different packet --- */
  await page.evaluate(() => { PE_UI.S.peek = true; PE_APP.render(); });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => PE_UI.S.sel);
  const rows = await page.$$('table.pcap tbody tr');
  if (rows.length > 1) {
    await rows[0].click();
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => PE_UI.S.sel);
    ok('packet row selects', after !== before || rows.length === 1, `${before} → ${after}`);
    const insp = await page.evaluate(() => document.querySelector('.insp') ? document.querySelector('.insp').textContent.length : 0);
    ok('inspector shows the packet', insp > 100, 'chars=' + insp);
  } else ok('packet row selects', false, 'no rows');

  /* --- field click highlights bytes --- */
  const f = await page.$$('.frow');
  if (f.length) {
    await f[1].click();
    await page.waitForTimeout(200);
    const hl = await page.evaluate(() => ({ hl: !!(PE_LESSON && document.querySelector('.hexw b')), note: document.body.innerText.includes('Highlighting') }));
    ok('field click highlights hex bytes', hl.hl || hl.note, JSON.stringify(hl));
  } else ok('field click highlights hex bytes', false, 'no fields');

  /* --- layer collapse --- */
  const lh = await page.$$('.layer > .lh');
  if (lh.length) {
    await lh[0].click();
    await page.waitForTimeout(150);
    const open = await page.evaluate(() => document.querySelectorAll('.layer.open').length);
    ok('layer row collapses/expands', open !== lh.length, 'open=' + open + '/' + lh.length);
  }

  /* --- replay / play / speed / peek --- */
  await page.click('[data-act="replay"]');
  await page.waitForTimeout(250);
  const dots = await page.evaluate(() => document.querySelectorAll('.pktdot').length);
  ok('Replay spawns a packet dot', dots >= 1, 'dots=' + dots);
  await page.click('[data-act="speed"][data-v="2"]');
  await page.waitForTimeout(150);
  ok('speed switch', (await page.evaluate(() => PE_UI.S.speed)) === 2);
  await page.click('[data-act="peek"]');
  await page.waitForTimeout(250);
  ok('peek toggles', (await page.evaluate(() => PE_UI.S.peek)) === false);

  /* --- quiz: answer and get feedback --- */
  await page.evaluate(() => { const l = PE_UI.byId['dns']; PE_UI.S.step = l.steps.length - 1; PE_APP.render(); });
  await page.waitForTimeout(400);
  const opt = await page.$('.quiz .opt');
  if (opt) {
    await opt.click();
    await page.waitForTimeout(300);
    const fb = await page.evaluate(() => ({ why: document.querySelectorAll('.quiz .why').length, right: document.querySelectorAll('.quiz .opt.right').length }));
    ok('quiz answer gives feedback', fb.why > 0 && fb.right > 0, JSON.stringify(fb));
  } else ok('quiz answer gives feedback', false, 'no quiz on last step');

  /* --- complete toggle --- */
  const doneBefore = await page.evaluate(() => !!PE_UI.isDone(PE_UI.byId['dns']));
  await page.click('[data-act="complete"]');
  await page.waitForTimeout(250);
  const doneAfter = await page.evaluate(() => !!PE_UI.isDone(PE_UI.byId['dns']));
  ok('mark complete toggles', doneBefore !== doneAfter, `${doneBefore} → ${doneAfter}`);

  /* --- lesson-to-lesson navigation --- */
  const idBefore = await page.evaluate(() => PE_UI.S.lessonId);
  await page.click('[data-act="nextLesson"]');
  await page.waitForTimeout(350);
  ok('next lesson button', (await page.evaluate(() => PE_UI.S.lessonId)) !== idBefore);

  /* --- device lab: switch topology, device, tab --- */
  await page.evaluate(() => { PE_UI.S.view = 'lab'; PE_UI.S.lab.topo = 'home'; PE_UI.S.lab.device = null; PE_APP.render(); });
  await page.waitForTimeout(300);
  await page.click('.seg button[data-v="k8s"]');
  await page.waitForTimeout(350);
  s = await state();
  ok('topology switcher', s.topo === 'k8s', 'topo=' + s.topo);
  const devRows = await page.$$('.devrow');
  ok('device list renders', devRows.length >= 5, 'rows=' + devRows.length);
  await devRows[2].click();
  await page.waitForTimeout(300);
  const devName = await page.evaluate(() => document.querySelector('.devrow.on') ? document.querySelector('.devrow.on').textContent.trim() : '');
  ok('device row selects a device', devName.length > 0, devName.slice(0, 30));
  for (const tab of ['interfaces', 'routes', 'arp', 'services', 'activity', 'trace', 'cli', 'overview']) {
    await page.click(`.tabs button[data-t="${tab}"]`);
    await page.waitForTimeout(120);
    const len = await text();
    ok('lab tab ' + tab, len > 200, 'html=' + len);
  }

  /* --- CLI: type a command, get output --- */
  await page.evaluate(() => { PE_UI.S.lab.tab = 'cli'; PE_APP.render(); });
  await page.waitForTimeout(250);
  await page.fill('#cliin', 'ip route');
  await page.press('#cliin', 'Enter');
  await page.waitForTimeout(300);
  const out1 = await page.evaluate(() => document.getElementById('cliout').textContent.length);
  ok('CLI submits and prints', out1 > 40, 'chars=' + out1);
  await page.fill('#cliin', 'ping 8.8.8.8');
  await page.press('#cliin', 'Enter');
  await page.waitForTimeout(300);
  const out2 = await page.evaluate(() => document.getElementById('cliout').textContent.length);
  ok('CLI ping', out2 > out1, `${out1} → ${out2}`);
  await page.click('.cli .hints button');
  await page.waitForTimeout(400);
  const out3 = await page.evaluate(() => document.getElementById('cliout').textContent.length);
  ok('CLI hint chips work', out3 > out2, `${out2} → ${out3}`);

  /* --- clicking a node in the diagram opens that device --- */
  await page.evaluate(() => PE_APP.goLesson('tls', 2));
  await page.waitForTimeout(700);
  const nodes = await page.$$('.node');
  if (nodes.length) {
    const label = await nodes[3].getAttribute('data-dev');
    await nodes[3].click();
    await page.waitForTimeout(500);
    const st2 = await state();
    ok('diagram node opens device lab', st2.view === 'lab' && st2.dev === label, `dev=${st2.dev} want=${label}`);
  }

  /* --- palette: search, arrow, enter --- */
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(250);
  ok('palette opens', await page.evaluate(() => document.getElementById('palette').classList.contains('on')));
  await page.fill('#palin', 'subnet');
  await page.waitForTimeout(250);
  const palN = await page.evaluate(() => document.querySelectorAll('.palitem').length);
  ok('palette finds results', palN > 0, 'items=' + palN);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const palClosed = await page.evaluate(() => !document.getElementById('palette').classList.contains('on'));
  ok('palette navigates and closes', palClosed);

  /* --- protocol card expands (and is visible without scrolling) --- */
  await page.evaluate(() => { PE_UI.S.view = 'library'; PE_UI.S.lib = null; PE_UI.S.search = ''; PE_APP.render(); });
  await page.waitForTimeout(300);
  await page.click('.pcard[data-act="proto"][data-id="bgp"]');
  await page.waitForTimeout(600);
  const det = await page.evaluate(() => {
    const d = document.getElementById('proto-detail');
    if (!d) return { ok: false };
    const r = d.getBoundingClientRect();
    return { ok: true, inView: r.top < window.innerHeight && r.bottom > 0, text: d.textContent.length };
  });
  ok('protocol card opens detail in view', det.ok && det.inView && det.text > 100, JSON.stringify(det));
  await page.click('#proto-detail [data-act="proto"]');
  await page.waitForTimeout(300);
  ok('protocol detail closes', await page.evaluate(() => !document.getElementById('proto-detail')));

  /* --- glossary search + cross-link --- */
  await page.evaluate(() => { PE_UI.S.view = 'glossary'; PE_UI.S.search = ''; PE_APP.render(); });
  await page.waitForTimeout(250);
  const glBefore = await page.evaluate(() => document.querySelectorAll('.gl').length);
  await page.fill('#glsearch', 'subnet');
  await page.waitForTimeout(400);
  const glAfter = await page.evaluate(() => document.querySelectorAll('.gl').length);
  ok('glossary search filters', glAfter > 0 && glAfter < glBefore, `${glBefore} → ${glAfter}`);
  const glBtn = await page.$('.gl button[data-act="openLesson"]');
  if (glBtn) {
    await glBtn.click();
    await page.waitForTimeout(400);
    ok('glossary term opens its lesson', (await state()).view === 'lesson');
  }

  /* --- library + sources search --- */
  await page.evaluate(() => { PE_UI.S.view = 'library'; PE_UI.S.search = ''; PE_APP.render(); });
  await page.waitForTimeout(250);
  await page.fill('#libsearch', 'tls');
  await page.waitForTimeout(350);
  const libN = await page.evaluate(() => document.querySelectorAll('.pcard').length);
  ok('protocol filter works', libN > 0 && libN < 30, 'cards=' + libN);
  await page.evaluate(() => { PE_UI.S.view = 'sources'; PE_UI.S.search = ''; PE_APP.render(); });
  await page.waitForTimeout(250);
  await page.fill('#srcsearch', 'tls');
  await page.waitForTimeout(350);
  const srcN = await page.evaluate(() => document.querySelectorAll('.gl').length);
  ok('sources filter works', srcN > 0 && srcN < 20, 'cards=' + srcN);
  const blank = await page.evaluate(() => [...document.querySelectorAll('#view a[target=_blank]')].every((a) => /^https?:/.test(a.href)));
  ok('all source links are absolute https', blank);

  /* --- exam flow --- */
  await page.evaluate(() => { PE_UI.S.view = 'exam'; PE_EXTRA.examReset(); });
  await page.waitForTimeout(300);
  await page.click('[data-act="exam-size"][data-v="8"]');
  await page.click('[data-act="exam-start"]');
  await page.waitForTimeout(400);
  const clock1 = await page.evaluate(() => PE_UI.S.exam.left);
  await page.waitForTimeout(1200);
  const clock2 = await page.evaluate(() => PE_UI.S.exam.left);
  ok('exam clock ticks', clock2 < clock1, `${clock1} → ${clock2}`);
  await page.click('[data-act="exam-answer"][data-o="1"]');
  await page.waitForTimeout(250);
  ok('exam advances on answer', (await page.evaluate(() => PE_UI.S.exam.i)) === 1);
  await page.click('[data-act="exam-back"]');
  await page.waitForTimeout(250);
  ok('exam back works', (await page.evaluate(() => PE_UI.S.exam.i)) === 0);
  const lastQ = await page.evaluate(() => { PE_UI.S.exam.i = PE_UI.S.exam.qs.length - 1; PE_APP.render(); return true; });
  await page.waitForTimeout(300);
  await page.click('[data-act="exam-finish"]');
  await page.waitForTimeout(400);
  const res = await page.evaluate(() => ({ stage: PE_UI.S.exam.stage, revs: document.querySelectorAll('.rev').length }));
  ok('exam finishes with review', res.stage === 'done' && res.revs > 0, JSON.stringify(res));

  /* --- reset progress --- */
  page.on('dialog', (d) => d.accept());
  const doneCount = await page.evaluate(() => Object.keys(PE_UI.S.done).length);
  await page.click('[data-act="reset"]');
  await page.waitForTimeout(400);
  const doneCount2 = await page.evaluate(() => Object.keys(PE_UI.S.done).length);
  ok('reset clears progress', doneCount2 < Math.max(1, doneCount), `${doneCount} → ${doneCount2}`);

  /* --- persistence --- */
  await page.evaluate(() => { PE_APP.goLesson('nat', 1); PE_UI.markStep(PE_UI.byId['nat'], 1); });
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  const persisted = await page.evaluate(() => ({ lesson: PE_UI.S.lessonId, done: Object.keys(PE_UI.S.done).length }));
  ok('progress survives reload', persisted.lesson === 'nat' && persisted.done > 0, JSON.stringify(persisted));

  /* --- mobile drawer --- */
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(BASE, { waitUntil: 'load' });
  await m.waitForTimeout(400);
  await m.click('[data-act="menu"]');
  await m.waitForTimeout(400);
  ok('mobile menu opens drawer', await m.evaluate(() => document.getElementById('sidebar').classList.contains('open')));
  await m.click('.navitem[data-act="lesson"]');
  await m.waitForTimeout(500);
  ok('mobile drawer lesson click works', (await m.evaluate(() => PE_UI.S.view)) === 'lesson');
  await m.close();

  await browser.close();

  /* ---------- report ---------- */
  const fail = results.filter((r) => !r.pass);
  console.log('\n=== interactions: ' + (results.length - fail.length) + '/' + results.length + ' passed ===');
  results.forEach((r) => console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.name + (r.detail ? '   [' + r.detail + ']' : '')));
  console.log('\njs errors: ' + (errs.length ? errs.slice(0, 6).join(' | ') : 'none'));
  process.exitCode = fail.length ? 1 : 0;
})();
