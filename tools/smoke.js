const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  p.on('requestfailed', r => errs.push('REQFAIL ' + r.url()));

  await p.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
  await p.waitForTimeout(600);
  const boot = await p.evaluate(() => ({
    view: PE_UI.S.view, tracks: PE_UI.TRACKS.length, lessons: PE_UI.LESSONS.length,
    protocols: PE_DATA.PROTOCOLS.length, topologies: Object.keys(PE_TOPO.TOPOLOGIES).length,
    packetsTotal: PE_UI.LESSONS.reduce((n, l) => n + PE_ENGINE.buildSession(l).packets.length, 0),
  }));

  // IPv6 lesson (new track) + inspector
  await p.evaluate(() => { PE_APP.goLesson('ipv6', 1); PE_UI.S.sel = 0; PE_APP.render(); });
  await p.waitForTimeout(600);
  const v6 = await p.evaluate(() => ({
    layers: [...document.querySelectorAll('.layer .nm')].map(e => e.textContent),
    hex: document.querySelectorAll('.hexline').length,
    refs: document.querySelectorAll('.explain a[target=_blank]').length,
  }));

  // device lab: CDN topology, shell
  await p.evaluate(() => { PE_UI.S.view='lab'; PE_UI.S.lab.topo='cdn'; PE_UI.S.lab.device='edge'; PE_UI.S.lab.tab='cli'; PE_APP.render(); });
  for (const c of ['ip route', 'ss -tulpn', 'traceroute 198.51.100.10']) await p.evaluate(c => PE_LAB.submit(c), c);
  const lab = await p.evaluate(() => ({ out: document.getElementById('cliout').textContent.length, switcher: document.querySelector('.seg').textContent }));

  // sources page
  await p.evaluate(() => { PE_UI.S.view='sources'; PE_APP.render(); });
  await p.waitForTimeout(250);
  const src = await p.evaluate(() => ({ cards: document.querySelectorAll('.gl').length, links: document.querySelectorAll('a[target=_blank]').length }));

  // single-file build
  const p2 = await b.newPage();
  p2.on('pageerror', e => errs.push('ONEFILE: ' + e.message));
  await p2.goto('http://127.0.0.1:8080/protocol-explorer.html');
  await p2.waitForTimeout(500);
  const one = await p2.evaluate(() => ({ lessons: PE_UI.LESSONS.length, view: PE_UI.S.view }));

  console.log(JSON.stringify({ boot, v6, lab, src, onefile: one, errors: errs }, null, 1));
  await b.close();
})();
