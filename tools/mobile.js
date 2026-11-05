/* tools/mobile.js — phone QA gate (390x844 and 820x1180)
   checks: no page-level sideways scroll, bottom tab bar present and tappable,
   tap targets >=40px, diagram fits the canvas, pickers exist in the lab. */
const { chromium } = require('playwright-core');

const URL = process.env.PE_URL || 'http://127.0.0.1:8080/';
const VIEWS = [
  ['tour', "PE_UI.S.view='tour';PE_APP.render()"],
  ['lesson', "PE_APP.goLesson('dns',3)"],
  ['lesson-last', "PE_APP.goLesson('tls13',9)"],
  ['lab', "PE_UI.S.view='lab';PE_UI.S.lab.topo='dc';PE_UI.S.lab.tab='overview';PE_APP.render()"],
  ['lab-cli', "PE_UI.S.lab.tab='cli';PE_APP.render()"],
  ['library', "PE_UI.S.view='library';PE_UI.S.lib='tls';PE_APP.render()"],
  ['glossary', "PE_UI.S.view='glossary';PE_APP.render()"],
  ['cheatsheet', "PE_UI.S.view='cheatsheet';PE_APP.render()"],
  ['sources', "PE_UI.S.view='sources';PE_APP.render()"],
  ['exam', "PE_UI.S.view='exam';PE_EXTRA.examReset();PE_APP.render()"],
  ['timeline', "PE_UI.S.view='timeline';PE_APP.render()"],
];

(async () => {
  const b = await chromium.launch();
  const issues = [];
  for (const [w, h] of [[320, 568], [390, 844], [820, 1180]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: true, deviceScaleFactor: 2 });
    p.on('pageerror', (e) => issues.push(w + 'px JS error: ' + e.message));
    await p.goto(URL, { waitUntil: 'load' });
    await p.waitForTimeout(600);

    for (const [name, js] of VIEWS) {
      await p.evaluate(js);
      await p.waitForTimeout(name.startsWith('lesson') ? 700 : 250);
      const r = await p.evaluate(() => {
        const de = document.documentElement;
        const wide = de.scrollWidth - de.clientWidth;
        const bar = document.getElementById('tabbar');
        const bs = bar ? [...bar.querySelectorAll('button')] : [];
        const barOk = !!bar && getComputedStyle(bar).display !== 'none';
        const barSmall = bs.filter((x) => x.getBoundingClientRect().height < 44).length;
        const cv = document.querySelector('.canvas');
        let canvasFit = null;
        if (cv) {
          const wrap = cv.closest('.canvaswrap');
          canvasFit = { canvasW: Math.round(cv.getBoundingClientRect().width), wrapW: Math.round(wrap.getBoundingClientRect().width) };
        }
        return { wide, barOk, barCount: bs.length, barSmall, canvasFit };
      });

      if (r.wide > 1) issues.push(w + 'px ' + name + ': page scrolls sideways by ' + r.wide + 'px');
      if (w < 900 && !r.barOk) issues.push(w + 'px ' + name + ': bottom tab bar is hidden');
      if (w < 900 && r.barCount !== 5) issues.push(w + 'px ' + name + ': tab bar has ' + r.barCount + ' tabs');
      if (w < 900 && r.barSmall) issues.push(w + 'px ' + name + ': ' + r.barSmall + ' tab bar buttons under 44px tall');
      if (r.canvasFit && r.canvasFit.canvasW > r.canvasFit.wrapW + 1) {
        issues.push(w + 'px ' + name + ': diagram overflows its box (' + r.canvasFit.canvasW + ' > ' + r.canvasFit.wrapW + ')');
      }
      if (w < 900 && name.startsWith('lab') && !(await p.$('#topopick'))) issues.push(w + 'px ' + name + ': no network picker');
    }

    /* the drawer must open and close on a phone */
    if (w < 900) {
      await p.evaluate("PE_UI.S.view='tour';PE_APP.render()");
      await p.waitForTimeout(200);
      await p.click('[data-act="menu"]');
      await p.waitForTimeout(350);
      const open = await p.evaluate(() => document.querySelector('.sidebar').getBoundingClientRect().left > -20);
      if (!open) issues.push(w + 'px: the menu drawer did not open');
      await p.keyboard.press('Escape');
      await p.waitForTimeout(350);
      const closed = await p.evaluate(() => document.querySelector('.sidebar').getBoundingClientRect().right < 40);
      if (!closed) issues.push(w + 'px: the menu drawer did not close');
    }
    await p.close();
  }
  await b.close();
  console.log(issues.length ? 'MOBILE ISSUES:\n' + issues.join('\n') : 'MOBILE OK — 0 issues');
  process.exit(issues.length ? 1 : 0);
})();
