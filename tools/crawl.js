/* full crawl: lessons, steps, lab, exam, timeline, palette, CLI */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  await p.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const boot = await p.evaluate(() => ({
    tracks: PE_UI.TRACKS.length, lessons: PE_UI.LESSONS.length,
    protocols: PE_DATA.PROTOCOLS.length, timeline: PE_DATA.TIMELINE.length,
    topologies: Object.keys(PE_TOPO.TOPOLOGIES).length,
    packets: PE_UI.LESSONS.reduce((n, l) => n + PE_ENGINE.buildSession(l).packets.length, 0),
    steps: PE_UI.LESSONS.reduce((n, l) => n + l.steps.length, 0),
    quizzes: PE_UI.LESSONS.reduce((n, l) => n + (l.quiz || []).length, 0),
  }));
  console.log('boot', JSON.stringify(boot));

  // every lesson, every step, open a packet + a field
  const ids = await p.evaluate(() => PE_UI.LESSONS.map((l) => l.id));
  let stepCount = 0;
  for (const id of ids) {
    const n = await p.evaluate((id) => {
      PE_APP.goLesson(id, 0);
      return PE_UI.byId[id].steps.length;
    }, id);
    for (let i = 0; i < n; i++) {
      await p.evaluate((i) => { PE_UI.S.step = i; PE_APP.render(); }, i);
      stepCount++;
      const info = await p.evaluate(() => ({
        layers: document.querySelectorAll('.layer .nm').length,
        rows: document.querySelectorAll('table.pcap tbody tr').length,
      }));
      if (info.rows) {
        await p.click('table.pcap tbody tr');
        const f = await p.$$('.field');
        if (f.length) await f[0].click();
      }
    }
  }
  console.log('steps visited', stepCount);

  // ---- the diagram must never draw a packet off-graph ----
  const routing = await p.evaluate(() => {
    const bad = [];
    let checked = 0, segs = 0;
    const graph = {};
    PE_UI.LESSONS.forEach((l) => {
      const sess = PE_ENGINE.buildSession(l);
      const adj = {};
      sess.topo.devices.forEach((d) => { adj[d.id] = []; });
      (sess.topo.links || []).forEach(([a, b]) => { if (adj[a] && adj[b]) { adj[a].push(b); adj[b].push(a); } });
      const route = (A, B) => {
        if (A === B) return [A];
        if (!adj[A] || !adj[B]) return [];
        const prev = {}, seen = { [A]: 1 }, q = [A];
        while (q.length) { const c = q.shift(); if (c === B) break; (adj[c] || []).forEach((n) => { if (seen[n]) return; seen[n] = 1; prev[n] = c; q.push(n); }); }
        if (!seen[B]) return [];
        const out = [B]; let c = B; while (c !== A) { c = prev[c]; out.unshift(c); } return out;
      };
      sess.packets.forEach((pk) => {
        checked++;
        const r = route(pk.src, pk.dst);
        if (!r.length) bad.push(l.id + ': ' + pk.src + '→' + pk.dst);
        else {
          segs += r.length - 1;
          // every consecutive pair must be an actual link
          for (let i = 0; i < r.length - 1; i++) {
            if (!adj[r[i]].includes(r[i + 1])) bad.push(l.id + ': hop ' + r[i] + '→' + r[i + 1] + ' is not a link');
          }
        }
      });
    });
    return { checked, segs, bad: bad.slice(0, 10) };
  });
  console.log('routing', JSON.stringify(routing));
  if (routing.bad.length) errs.push('ROUTING: ' + routing.bad.join(' | '));

  // topologies x devices x tabs
  const topo = await p.evaluate(() => Object.keys(PE_TOPO.TOPOLOGIES));
  let devN = 0, tabN = 0;
  const TABS = ['overview', 'interfaces', 'routes', 'arp', 'services', 'activity', 'trace', 'cli'];
  for (const t of topo) {
    const devs = await p.evaluate((t) => PE_TOPO.TOPOLOGIES[t].devices.map((d) => d.id), t);
    for (const d of devs) {
      devN++;
      for (const tab of TABS) {
        await p.evaluate(([t, d, tab]) => {
          PE_UI.S.view = 'lab'; PE_UI.S.lab.topo = t; PE_UI.S.lab.device = d; PE_UI.S.lab.tab = tab;
          PE_APP.render();
        }, [t, d, tab]);
        tabN++;
      }
    }
  }
  console.log('devices', devN, 'tab renders', tabN);

  // CLI commands on every topology's router-ish device
  const cmds = ['help', 'ip addr', 'ip -6 addr', 'ip route', 'arp -a', 'ss -tulpn', 'show interfaces',
    'show interface counters', 'show ip route', 'show bgp summary', 'dig www.example.com',
    'dig +trace www.example.com', 'ping 8.8.8.8', 'traceroute 203.0.113.10', 'curl -v example.com',
    'tcpdump -c 5', 'conntrack -S', 'conntrack -L', 'iptables -t nat -L', 'bridge fdb', 'bridge link',
    'ethtool eth0', 'openssl s_client -connect example.com:443', 'dhcp', 'uname -a', 'nonsense'];
  for (const t of topo) {
    const d = await p.evaluate((t) => (PE_TOPO.TOPOLOGIES[t].devices.find((x) => x.kind === 'router') || PE_TOPO.TOPOLOGIES[t].devices[0]).id, t);
    await p.evaluate(([t, d]) => { PE_UI.S.view = 'lab'; PE_UI.S.lab.topo = t; PE_UI.S.lab.device = d; PE_UI.S.lab.tab = 'cli'; PE_APP.render(); }, [t, d]);
    for (const c of cmds) {
      const before = await p.evaluate(() => document.getElementById('cliout').textContent.length);
      await p.evaluate((c) => PE_LAB.submit(c), c);
      const after = await p.evaluate(() => document.getElementById('cliout').textContent.length);
      if (after <= before) errs.push('CLI empty output: ' + t + ' / ' + c);
    }
  }
  console.log('cli cmds x', cmds.length, 'x', topo.length);

  // exam mode
  await p.evaluate(() => { PE_UI.S.view = 'exam'; PE_APP.render(); });
  await p.click('[data-act="exam-scope"][data-v="ops"]');
  await p.click('[data-act="exam-size"][data-v="8"]');
  await p.click('[data-act="exam-start"]');
  await p.waitForTimeout(300);
  let guard = 0;
  while (guard++ < 40) {
    const stage = await p.evaluate(() => PE_UI.S.exam.stage);
    if (stage !== 'run') break;
    const last = await p.evaluate(() => PE_UI.S.exam.i === PE_UI.S.exam.qs.length - 1);
    if (last) {
      const fin = await p.$('[data-act="exam-finish"]');
      if (fin) { await p.click('[data-act="exam-finish"]'); break; }
    }
    const hasOpts = await p.$('[data-act="exam-answer"]');
    if (hasOpts) await p.click('[data-act="exam-answer"][data-o="1"]');
    else await p.click('[data-act="exam-skip"]');
  }
  const examState = await p.evaluate(() => ({ stage: PE_UI.S.exam.stage, score: PE_UI.S.exam.score, revs: document.querySelectorAll('.rev').length }));
  console.log('exam', JSON.stringify(examState));
  if (examState.stage !== 'done' || !examState.revs) errs.push('EXAM did not finish');
  await p.click('[data-act="exam-again"]');
  const resetOk = await p.evaluate(() => PE_UI.S.exam.stage);
  if (resetOk !== 'setup') errs.push('EXAM reset failed');

  // timeline
  await p.evaluate(() => { PE_UI.S.view = 'timeline'; PE_APP.render(); });
  const tl = await p.evaluate(() => document.querySelectorAll('.tli').length);
  console.log('timeline items', tl);
  if (!tl) errs.push('TIMELINE empty');

  // palette
  await p.keyboard.press('Control+k');
  await p.waitForTimeout(200);
  const palOpen = await p.evaluate(() => document.getElementById('palette').classList.contains('on'));
  await p.fill('#palin', 'conntrack');
  await p.waitForTimeout(200);
  const palItems = await p.evaluate(() => document.querySelectorAll('.palitem').length);
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const palClosed = await p.evaluate(() => !document.getElementById('palette').classList.contains('on'));
  console.log('palette', palOpen, palItems, palClosed);
  if (!palOpen || !palItems || !palClosed) errs.push('PALETTE broken');

  // palette -> lesson step jump
  await p.keyboard.press('Control+k');
  await p.fill('#palin', 'four-way handshake');
  await p.waitForTimeout(200);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const jumped = await p.evaluate(() => ({ view: PE_UI.S.view, id: PE_UI.S.lessonId, step: PE_UI.S.step }));
  console.log('palette jump', JSON.stringify(jumped));

  // free explore views
  for (const v of ['tour', 'library', 'glossary', 'cheatsheet', 'sources', 'lab', 'exam', 'timeline']) {
    await p.evaluate((v) => { PE_UI.S.view = v; PE_APP.render(); }, v);
  }

  // single-file build
  await p.goto('file:///home/user/protocol-explorer.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);
  const single = await p.evaluate(() => ({ lessons: PE_UI.LESSONS.length, tracks: PE_UI.TRACKS.length, view: PE_UI.S.view }));
  console.log('single-file', JSON.stringify(single));

  console.log('ERRORS', errs.length);
  errs.slice(0, 25).forEach((e) => console.log(' -', e));
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
